# duyo.uz — landing'ni nginx'ga ulash (bir martalik ish)

`deploy-landing.yml` sayt fayllarini serverga **/opt/duyo/landing** ga chiqaradi
(admin uchun `/opt/duyo/admin` ishlatilgani kabi). Lekin nginx hozircha
`duyo.uz` uchun qattiq yozilgan javob qaytaradi:

```console
$ curl -s https://duyo.uz/
DUYO — AI Companion for Children. Tez orada (Faza 0 foundation OK).
```

70 baytlik bu javob fayl emas — nginx konfiguratsiyasidagi `return 200 "..."`.
Shuning uchun rsync o'zi yetarli emas: **konfiguratsiyani bir marta**
o'zgartirish kerak. Quyidagi qadamlardan keyin har bir `main` push avtomatik
chiqadi va bu hujjat kerak bo'lmaydi.

> Sertifikat allaqachon bor (`https://duyo.uz` 200 qaytaryapti), shuning uchun
> certbot qadami yo'q.

## 1. Papka bind mount qilinsin

`/opt/duyo/docker-compose.yml` dagi nginx servisiga (admin qatoriga o'xshab)
qo'shing:

```yaml
    volumes:
      - /opt/duyo/admin:/usr/share/nginx/admin:ro
      - /opt/duyo/landing:/usr/share/nginx/landing:ro   # ← yangi qator
```

## 2. duyo.uz server bloki papkaga qaratilsin

nginx konfiguratsiyasida `server_name duyo.uz` bo'lgan blokni toping
(`docker exec duyo-nginx grep -rn "duyo.uz" /etc/nginx/`). Ichidagi
placeholder `location / { return 200 "..."; }` ni almashtiring:

```nginx
server {
    listen 443 ssl http2;
    server_name duyo.uz www.duyo.uz;

    ssl_certificate     /etc/letsencrypt/live/duyo.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/duyo.uz/privkey.pem;

    root /usr/share/nginx/landing;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Rasm/CSS/JS — uzoq kesh, HTML — hech qachon keshlanmasin, aks holda
    # yangi deploy foydalanuvchida bir necha kun ko'rinmay qoladi.
    location ~* \.(png|jpg|jpeg|svg|webp|css|js|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

## 3. Qo'llash

```bash
cd /opt/duyo
docker compose up -d          # 1-qadamdagi volume uchun
docker exec duyo-nginx nginx -t && docker exec duyo-nginx nginx -s reload
```

## 4. Tekshirish

```bash
curl -s https://duyo.uz/ | grep -c sec-hero      # 0 dan katta bo'lishi kerak
curl -sI https://duyo.uz/assets/img/logo.png | head -1
```

So'ng GitHub'da **Actions → Deploy landing → Run workflow** ni bosing: smoke
test o'sha `sec-hero` belgisini qidiradi va endi yashil bo'lishi kerak.

## Nega APK havolasi admin.duyo.uz'da qoladi

Yuklab olish tugmalari `https://admin.duyo.uz/apk/duyo.apk` ga qaraydi — APK'ni
o'sha yerga `build-apk.yml` chiqaradi va har bir mobil push'da yangilaydi, ya'ni
havola har doim eng oxirgi versiyani beradi. Xohlasangiz keyinchalik shu blokka
qo'shib, `duyo.uz/apk/` ni ham o'sha papkaga ulashingiz mumkin:

```nginx
    location /apk/ {
        alias /usr/share/nginx/admin/apk/;
    }
```
