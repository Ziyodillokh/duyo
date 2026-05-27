---
title: "DUYO Server Setup Playbook"
type: runbook
status: ready
created: 2026-05-26
target_phase: "Bosqich B Hafta 4 — Faza 1 birinchi server"
target_provider: "UCloud.uz / Bestcloud.uz / EVO Cloud"
estimated_time: "5-7 soat (yangi DevOps), 2-3 soat (tajribali)"
prerequisites:
  - Server sotib olingan (2 vCPU, 4GB RAM, 50GB SSD, Ubuntu 22.04)
  - Domain ro'yxatdan o'tgan (duyo.uz)
  - Mac'da Bosqich A AI core tayyor
  - Anthropic API key bor
tags: [duyo, ops, server, deployment, runbook]
---

# DUYO Server Setup — Bosqich B Playbook

> Bu siz **birinchi marta** server'ga ulanganingizdan to **beta oilalar ro'yxatdan o'tishigacha** to'liq jarayon.

## 🎯 Maqsad

Hafta 4 oxirida sizda quyidagilar bo'lishi kerak:
- ✅ HTTPS bilan `api.duyo.uz` ishlamoqda
- ✅ FastAPI backend Docker'da
- ✅ PostgreSQL + Redis + MinIO ishlamoqda
- ✅ Crisis Detection endpoint live (`POST /api/v1/crisis/check`)
- ✅ Avtomatik backup
- ✅ Basic monitoring (uptime + error)
- ✅ Beta oilani ro'yxatdan o'tkazish tayyor

## ⏱️ Vaqt taqsimoti

| Phase | Vaqt |
|-------|------|
| 0. Pre-flight | 30 daq |
| 1. Server hardening | 45 daq |
| 2. Docker | 15 daq |
| 3. Domain & DNS | 15 daq + 24 soat kutish |
| 4. Nginx + SSL | 30 daq |
| 5. Databases (PostgreSQL/Redis/MinIO) | 45 daq |
| 6. DUYO app deploy | 60 daq |
| 7. Smoke tests | 30 daq |
| 8. Backup | 30 daq |
| 9. Monitoring | 30 daq |
| **TOTAL** | **~5 soat** (DNS kutmasdan) |

---

## Phase 0: Pre-flight (Mac'da, server'ga tegmasdan)

### 0.1 SSH key yaratish

Agar sizda hali SSH key yo'q bo'lsa:

```bash
# Mac'da:
ssh-keygen -t ed25519 -C "duyo-server-key" -f ~/.ssh/duyo_server

# Public key'ni ko'rish (server'ga qo'shish uchun):
cat ~/.ssh/duyo_server.pub
```

### 0.2 Provider dashboard'da SSH key qo'shish

UCloud / Bestcloud panel'da:
1. Dashboard → SSH Keys → Add new
2. Yuqoridagi `.pub` mazmuni paste qiling
3. Nom: "DUYO main key"

### 0.3 Server yaratish (provider panel'da)

| Parametr | Qiymat |
|----------|--------|
| OS | Ubuntu 22.04 LTS |
| vCPU | 2 |
| RAM | 4 GB |
| SSD | 50 GB |
| Region | Toshkent (default) |
| SSH Key | "DUYO main key" |
| Hostname | `duyo-staging-01` |
| Tariff | ~$12-25/oy |

### 0.4 Server IP yozib olish

Server tayyor bo'lgach, panel'dan:
```
Server IP: ___________ (masalan: 92.46.xxx.xxx)
```

### 0.5 Birinchi SSH ulanish sinovi

```bash
# Mac'dan:
ssh -i ~/.ssh/duyo_server root@SERVER_IP

# Agar so'rasa: yes
# Login muvaffaqiyatli bo'lsa → keyingi phase'ga o'ting
# Login error bo'lsa → SSH key panel'da qo'shilganini tekshiring
```

---

## Phase 1: Server hardening (45 daqiqa)

⚠️ **CRITICAL:** Bu phase'siz server'ni internet'ga qoldirmang. 24 soat ichida brute-force hujum keladi.

### 1.1 Server yangilash

```bash
# Server'da (SSH ulangan holda):
apt update && apt upgrade -y
apt install -y curl wget vim ufw fail2ban htop git unzip
```

### 1.2 Non-root user yaratish

```bash
# Server'da:
adduser duyo
# Parol qo'ying (yozib oling — password manager)

# Sudo huquqi:
usermod -aG sudo duyo

# SSH key'ni copy qilish:
mkdir -p /home/duyo/.ssh
cp /root/.ssh/authorized_keys /home/duyo/.ssh/
chown -R duyo:duyo /home/duyo/.ssh
chmod 700 /home/duyo/.ssh
chmod 600 /home/duyo/.ssh/authorized_keys
```

### 1.3 Sinash — yangi SSH ulanish

**MUHIM:** Bu terminal'ni yopmang! Yangi terminal oching va sinab ko'ring:

```bash
# Mac'da, YANGI terminal:
ssh -i ~/.ssh/duyo_server duyo@SERVER_IP

# Ishladi'mi? Yaxshi.
# Yo'q'mi? Eski terminal'da xato'ni tuzating.
```

### 1.4 SSH konfiguratsiyasi

```bash
# Server'da (duyo user bilan):
sudo vim /etc/ssh/sshd_config

# Shu qatorlarni o'zgartiring/qo'shing:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 22                  # ixtiyoriy: o'zgartiring (masalan 2222) extra security uchun
```

```bash
# SSH service'ni restart:
sudo systemctl restart ssh

# YAna sinab ko'ring (yangi terminal):
ssh -i ~/.ssh/duyo_server duyo@SERVER_IP
```

### 1.5 UFW firewall

```bash
# Server'da:
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp       # SSH (agar port o'zgartirilgan bo'lsa: 2222/tcp)
sudo ufw allow 80/tcp       # HTTP (Let's Encrypt uchun)
sudo ufw allow 443/tcp      # HTTPS
sudo ufw enable

# Status tekshirish:
sudo ufw status verbose
```

### 1.6 Fail2ban (brute-force himoya)

```bash
# Server'da:
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Status:
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

### 1.7 Automatic security updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
# Yes tanlang
```

### 1.8 Verification

```bash
# Hardening checklist:
[ ] root SSH disabled ✓ (PermitRootLogin no)
[ ] Password auth disabled ✓ (PasswordAuthentication no)
[ ] UFW active ✓ (sudo ufw status)
[ ] Fail2ban running ✓ (sudo systemctl status fail2ban)
[ ] Automatic updates ✓
```

---

## Phase 2: Docker installation (15 daqiqa)

### 2.1 Docker o'rnatish

```bash
# Server'da (duyo user):
# Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Docker repo
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# O'rnatish
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# duyo user'ni docker group'iga qo'shish (sudo'siz docker ishlatish)
sudo usermod -aG docker duyo
```

### 2.2 Sinash

```bash
# Logout va qayta login (group o'zgarishi uchun)
exit
ssh -i ~/.ssh/duyo_server duyo@SERVER_IP

# Sinov:
docker run hello-world

# "Hello from Docker!" yozuvini ko'rishingiz kerak
```

### 2.3 Disk monitoring sozlash (Docker tezda joy egallaydi)

```bash
# Crontab'ga qo'shish:
crontab -e

# Qo'shing:
0 3 * * 0 docker system prune -af --volumes --filter "until=168h" > /var/log/docker-cleanup.log 2>&1
```

---

## Phase 3: Domain & DNS (15 daqiqa + 24 soat kutish)

### 3.1 DNS records sozlash

Domain registrar'ingiz (Uzinfocom yoki boshqa)'da DNS panel'ga kiring:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `api` | `SERVER_IP` | 300 |
| A | `staging` | `SERVER_IP` | 300 |
| CNAME | `www` | `duyo.uz` | 3600 |

**Eslatma:** TTL kichik (300 sek) qiling — kelajakda IP o'zgartirish kerak bo'lsa.

### 3.2 DNS propagation tekshirish

```bash
# Mac'da:
dig api.duyo.uz +short
# Server IP'ni ko'rishingiz kerak

# Yoki online tool:
# https://dnschecker.org/#A/api.duyo.uz
```

DNS propagation 5 daqiqadan 24 soatgacha vaqt oladi. Davom etish uchun **kamida `api.duyo.uz` ishlashi kerak**.

---

## Phase 4: Nginx + SSL (30 daqiqa)

### 4.1 Nginx o'rnatish

```bash
# Server'da:
sudo apt install -y nginx certbot python3-certbot-nginx

# Service start
sudo systemctl enable nginx
sudo systemctl start nginx

# Status:
sudo systemctl status nginx
```

### 4.2 Nginx config — DUYO API

```bash
sudo vim /etc/nginx/sites-available/duyo-api
```

Mazmuni:

```nginx
upstream duyo_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name api.duyo.uz;

    # Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Hammasini HTTPS'ga redirect
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.duyo.uz;

    # SSL certs — Certbot keyin to'ldiradi
    ssl_certificate /etc/letsencrypt/live/api.duyo.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.duyo.uz/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Body size (audio uploads uchun)
    client_max_body_size 10M;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    location / {
        proxy_pass http://duyo_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (kelajak)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 4.3 Enable site va sinash

```bash
# Symlink
sudo ln -s /etc/nginx/sites-available/duyo-api /etc/nginx/sites-enabled/

# Test config (xato bo'lsa to'g'rilang):
sudo nginx -t

# Reload (faqat test o'tgan bo'lsa):
sudo systemctl reload nginx
```

### 4.4 SSL sertifikat olish (Let's Encrypt)

```bash
# Certbot orqali:
sudo certbot --nginx -d api.duyo.uz --non-interactive --agree-tos -m your-email@duyo.uz

# Avtomatik renewal sinash:
sudo certbot renew --dry-run
```

### 4.5 Verification

```bash
# Mac'da:
curl -I https://api.duyo.uz

# HTTP/2 200 yoki 502 (502 yaxshi — backend hali yo'q)
```

---

## Phase 5: Databases (PostgreSQL + Redis + MinIO) (45 daqiqa)

### 5.1 Project folder yaratish

```bash
# Server'da:
sudo mkdir -p /opt/duyo
sudo chown -R duyo:duyo /opt/duyo
cd /opt/duyo
```

### 5.2 docker-compose.yml

```bash
vim /opt/duyo/docker-compose.yml
```

Mazmuni:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: duyo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: duyo
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: duyo
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups/postgres:/backups
    ports:
      - "127.0.0.1:5432:5432"   # FAQAT localhost'dan
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U duyo"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: duyo-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"   # FAQAT localhost'dan
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: duyo-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: duyo
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "127.0.0.1:9000:9000"   # API
      - "127.0.0.1:9001:9001"   # Console (web UI)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 5

  duyo-api:
    image: duyo-backend:latest
    container_name: duyo-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://duyo:${POSTGRES_PASSWORD}@postgres:5432/duyo
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      APP_ENV: staging
      APP_SECRET_KEY: ${APP_SECRET_KEY}
    ports:
      - "127.0.0.1:8000:8000"   # Nginx orqali ochiladi
    volumes:
      - ./logs:/app/logs

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 5.3 .env fayl yaratish

```bash
vim /opt/duyo/.env
```

```bash
# Strong password'lar — har birini alohida generate qiling:
# openssl rand -base64 32

POSTGRES_PASSWORD=GENERATE_STRONG_PASSWORD_HERE
REDIS_PASSWORD=GENERATE_STRONG_PASSWORD_HERE
MINIO_PASSWORD=GENERATE_STRONG_PASSWORD_HERE
APP_SECRET_KEY=GENERATE_STRONG_PASSWORD_HERE
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
# Permissions
chmod 600 /opt/duyo/.env
```

**MUHIM:** Bu fayl'ni hech qachon git'ga qo'shmang!

### 5.4 Databases ishga tushirish

```bash
cd /opt/duyo
docker compose up -d postgres redis minio

# Status:
docker compose ps

# Logs:
docker compose logs -f
# Ctrl+C exit
```

### 5.5 PostgreSQL sinash

```bash
# Container ichidan:
docker exec -it duyo-postgres psql -U duyo -d duyo

# psql'da:
\l    # databases ro'yxati
\dt   # tables (bo'sh bo'lishi kerak)
\q    # chiqish
```

---

## Phase 6: DUYO app deploy (60 daqiqa)

### 6.1 Backend kod'ni server'ga ko'chirish

**Variant A — Git (tavsiya, kelajakda CI/CD uchun):**

```bash
# Server'da:
cd /opt/duyo
git clone git@github.com:polvonuzb/DUYO.git source
# Yoki HTTPS:
git clone https://github.com/polvonuzb/DUYO.git source

cd source/duyo-backend
```

**Variant B — Rsync (Mac'dan):**

```bash
# Mac'da:
rsync -avz --exclude '__pycache__' --exclude '.venv' --exclude '*.pyc' \
  /Users/raxmonjon/DUYO/duyo-backend/ \
  duyo@SERVER_IP:/opt/duyo/source/duyo-backend/
```

### 6.2 Docker image build

```bash
# Server'da:
cd /opt/duyo/source/duyo-backend

# Dockerfile yaratish (agar yo'q bo'lsa):
cat > Dockerfile <<'EOF'
FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir uv && \
    uv pip install --system -e .

# App code
COPY src/ ./src/

# Non-root user
RUN useradd -m duyo
USER duyo

EXPOSE 8000

CMD ["uvicorn", "duyo.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

# Build:
docker build -t duyo-backend:latest .
```

### 6.3 Migration (kelajak — hozircha skip)

Hozir kerak emas (auth/users skeleton bo'sh). Faza 1 davomida Alembic migration qo'shilgach:

```bash
docker compose exec duyo-api alembic upgrade head
```

### 6.4 API ishga tushirish

```bash
cd /opt/duyo
docker compose up -d duyo-api

# Logs:
docker compose logs -f duyo-api
# Ctrl+C
```

### 6.5 Healthcheck

```bash
# Server'da:
curl http://localhost:8000/health

# Expected:
# {"status":"ok","version":"0.1.0","env":"staging"}
```

### 6.6 Tashqaridan tekshirish

```bash
# Mac'da:
curl https://api.duyo.uz/health

# Yoki browser'da:
# https://api.duyo.uz/health
# https://api.duyo.uz/docs  (Swagger UI)
```

---

## Phase 7: Smoke tests (30 daqiqa)

### 7.1 Crisis Detection endpoint

```bash
# Mac'da:
curl -X POST https://api.duyo.uz/api/v1/crisis/check \
  -H "Content-Type: application/json" \
  -d '{"text": "Salom DUYO, bugun yaxshi kun"}'

# Expected: {"level":"GREEN","is_safe":true,"matches":[]}

curl -X POST https://api.duyo.uz/api/v1/crisis/check \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Men o'zimni o'ldiraman\"}"

# Expected: {"level":"RED","is_safe":false,"matches":[...]}
```

### 7.2 To'liq sinov ro'yxati

```
[ ] /health → 200 OK, version + env
[ ] /docs → Swagger UI ochiladi
[ ] /api/v1/crisis/check (safe text) → GREEN
[ ] /api/v1/crisis/check (uz suicidal) → RED
[ ] /api/v1/crisis/check (ru suicidal) → RED
[ ] /api/v1/crisis/check (en suicidal) → RED
[ ] /api/v1/crisis/check (abuse victim) → ORANGE
[ ] HTTPS valid certificate (browser yashil qulf)
[ ] HTTP → HTTPS redirect ishlaydi
[ ] Container'lar restart bo'lsa avtomatik tiklanadi:
    docker restart duyo-api && sleep 5 && curl https://api.duyo.uz/health
```

### 7.3 Performance baseline

```bash
# Mac'da, basic latency:
time curl -s https://api.duyo.uz/api/v1/crisis/check \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}' > /dev/null

# Real: 100-300ms acceptable (Toshkent-Toshkent latency)
# Real: 500ms+ — istinaolib qiling (network issue)
```

---

## Phase 8: Backup (30 daqiqa)

### 8.1 PostgreSQL daily backup script

```bash
sudo vim /opt/duyo/scripts/backup-postgres.sh
```

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR=/opt/duyo/backups/postgres
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Dump
docker exec duyo-postgres pg_dump -U duyo duyo | gzip > "$BACKUP_DIR/duyo_${TIMESTAMP}.sql.gz"

# Eski backup'larni o'chirish (30 kundan eski)
find "$BACKUP_DIR" -name "duyo_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# Log
echo "[$(date)] Backup completed: duyo_${TIMESTAMP}.sql.gz ($(du -h $BACKUP_DIR/duyo_${TIMESTAMP}.sql.gz | cut -f1))" >> /var/log/duyo-backup.log
```

```bash
chmod +x /opt/duyo/scripts/backup-postgres.sh

# Sinov:
/opt/duyo/scripts/backup-postgres.sh
ls -la /opt/duyo/backups/postgres/
```

### 8.2 Cron orqali avtomatik

```bash
crontab -e

# Qo'shing (har kuni 03:00 da):
0 3 * * * /opt/duyo/scripts/backup-postgres.sh
```

### 8.3 Off-site backup (kelajak — Hafta 5+)

Bootstrap'da hozircha:
- Local backup (server'da)
- Haftalik manual download Mac'ga (`scp`)
- Kelajakda: Hetzner Storage Box ($3/oy) yoki AWS S3 Glacier

### 8.4 Restore sinash

⚠️ **KRITIK:** Backup ishlashini test qilmaguncha — backup yo'q.

```bash
# Test database yaratish va restore:
docker exec duyo-postgres createdb -U duyo duyo_test
gunzip -c /opt/duyo/backups/postgres/duyo_*.sql.gz | docker exec -i duyo-postgres psql -U duyo duyo_test

# Tables tekshirish:
docker exec duyo-postgres psql -U duyo -d duyo_test -c "\dt"

# Tozalash:
docker exec duyo-postgres dropdb -U duyo duyo_test
```

---

## Phase 9: Basic monitoring (30 daqiqa)

### 9.1 Uptime monitoring — bepul

**UptimeRobot** (https://uptimerobot.com):
1. Hisob oching (bepul tier — 50 monitor)
2. Add monitor:
   - Type: HTTPS
   - URL: `https://api.duyo.uz/health`
   - Interval: 5 daqiqa
   - Alert: sizning email + Telegram
3. Status page yarating (public): `status.duyo.uz`

### 9.2 Error tracking — Sentry

1. https://sentry.io hisob oching (bepul tier: 5K events/oy)
2. Project yarating: "duyo-backend"
3. DSN ni `.env`'ga qo'shing:
   ```bash
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```
4. Code'ga qo'shing (`main.py`):
   ```python
   import sentry_sdk
   sentry_sdk.init(dsn=os.environ.get("SENTRY_DSN"))
   ```

### 9.3 Server resource monitoring

```bash
# Server'da o'rnatish:
sudo apt install -y prometheus-node-exporter

# Yoki oddiyroq — htop:
htop
# Memory, CPU, disk har vaqt ko'rinadi
```

### 9.4 Telegram alert (DevOps incident uchun)

```bash
# Bot yaratish: @BotFather
# Bot token oling
# Chat ID: @userinfobot

# Server'da alert script:
vim /opt/duyo/scripts/telegram-alert.sh
```

```bash
#!/bin/bash
TOKEN="YOUR_BOT_TOKEN"
CHAT_ID="YOUR_CHAT_ID"
MESSAGE=$1

curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "text=${MESSAGE}" \
  -d "parse_mode=Markdown"
```

```bash
# Sinov:
chmod +x /opt/duyo/scripts/telegram-alert.sh
/opt/duyo/scripts/telegram-alert.sh "DUYO server alive ✅"
```

---

## 📋 Yakuniy checklist

Hammasi bajarilgandan keyin:

### Functional
- [ ] `https://api.duyo.uz/health` → 200 OK
- [ ] `https://api.duyo.uz/docs` → Swagger UI
- [ ] Crisis check endpoint barcha til'lar va kategoriya'larda ishlaydi
- [ ] SSL valid (browser yashil qulf)
- [ ] HTTP → HTTPS redirect

### Security
- [ ] Root SSH disabled
- [ ] Password SSH disabled
- [ ] UFW firewall active (faqat 22, 80, 443)
- [ ] Fail2ban running
- [ ] Strong DB passwords
- [ ] `.env` file 600 permission
- [ ] PostgreSQL/Redis/MinIO faqat localhost (port 127.0.0.1 bind)

### Reliability
- [ ] Daily PostgreSQL backup (cron)
- [ ] Backup restore sinangan
- [ ] Container restart policy: `unless-stopped`
- [ ] Docker auto-cleanup (haftalik)

### Observability
- [ ] UptimeRobot active
- [ ] Sentry error tracking
- [ ] Telegram alert bot ishlaydi
- [ ] Logs collected (`docker compose logs`)

---

## 🚨 Emergency procedures

### Server javob bermayapti
```bash
# Mac'dan:
ssh -i ~/.ssh/duyo_server duyo@SERVER_IP

# Agar SSH ham ishlamasa:
# 1. Provider panel'dan VNC ulanish
# 2. fail2ban siz lock bo'lganmisiz: cat /var/log/fail2ban.log
# 3. UFW rule'lar to'g'rimi: sudo ufw status
```

### API 502/503 qaytaryapti
```bash
# Container status:
docker compose ps

# Logs:
docker compose logs --tail=100 duyo-api

# Restart:
docker compose restart duyo-api
```

### Database connection xato
```bash
# PostgreSQL alive?
docker exec duyo-postgres pg_isready -U duyo

# Logs:
docker compose logs --tail=50 postgres

# Restart:
docker compose restart postgres
sleep 10
docker compose restart duyo-api
```

### SSL cert expired
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Disk full
```bash
df -h
# Docker cleanup:
docker system prune -af --volumes

# Old backups cleanup:
find /opt/duyo/backups -mtime +30 -delete
```

### Crisis Detection ishlamayapti
```bash
# Bu KRITIK — darhol javob bering:

# 1. API alive?
curl https://api.duyo.uz/health

# 2. Crisis endpoint sinash
curl -X POST https://api.duyo.uz/api/v1/crisis/check \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}'

# 3. Logs:
docker compose logs --tail=200 duyo-api | grep -i crisis

# 4. Agar ishlamasa — DARHOL:
#    a) Telegram channel'da fallback javob (oilalarga)
#    b) Manual review boshlash
#    c) Provider'ga incident report
```

---

## 📚 Foydali resurslar

- **UCloud docs:** https://ucloud.uz/docs (rus tilida)
- **Bestcloud:** https://bestcloud.uz
- **Docker docs:** https://docs.docker.com/compose/
- **Nginx config:** https://www.digitalocean.com/community/tools/nginx
- **Let's Encrypt:** https://letsencrypt.org/getting-started/
- **PostgreSQL backup:** https://www.postgresql.org/docs/16/backup.html

---

## 🔄 Versiya nazorati

| Sana | Versiya | O'zgarish |
|------|---------|-----------|
| 2026-05-26 | 1.0 | Birinchi versiya, Bosqich B Hafta 4 uchun |

## Bog'langan hujjatlar

- [[decisions.md]] — D-006 (mahalliy hosting qarori)
- [[30-kunlik-reja-v2.md]] — Hafta 4 deployment context
- [TZ §3.2](../../DUYO_TZ_v1.0.docx) — Tech stack
- [TZ §13.1](../../DUYO_TZ_v1.0.docx) — Performance SLA
- [TZ §16](../../DUYO_TZ_v1.0.docx) — Deployment va DevOps
