#!/usr/bin/env bash
# Daily PostgreSQL backup → /opt/duyo/backups/postgres/, encrypted.
# Retention: 14 daily, 8 weekly, 12 monthly.
#
# Runs from the duyo user's crontab at 03:30. Lives here as well as on the
# server so it is reviewable and survives the server — it previously existed
# only at /opt/duyo/scripts/backup_postgres.sh, which meant a lost VPS also
# lost the thing that backs the VPS up.
#
# ## Why the dumps are encrypted, and why with a PUBLIC key
#
# A pg_dump of this database is every child's chat history in plain SQL. The
# dumps sat unencrypted on the same disk as the database, going back a year —
# so anything that read the disk read a year of children's conversations, and
# the backup directory was a strictly easier target than the running database.
#
# The recipient key is a PUBLIC key, and the matching private key is not on
# this machine (verify: `gpg --list-secret-keys` returns nothing). This server
# can therefore WRITE backups it can never READ. That property is the whole
# point: it holds even if the server is fully compromised, which is the case
# ordinary disk encryption does not cover, because a running server has its
# disk mounted and decrypted.
#
# Restoring requires the private key, which lives off-server. If that key is
# lost, every backup is permanently unreadable — there is no recovery path and
# no support line. It is the single most important file in this system.
#
#   Restore:  gpg --decrypt duyo_YYYYMMDD_HHMMSS.sql.gz.gpg | gunzip \
#               | docker exec -i duyo-postgres psql -U duyo -d duyo

set -euo pipefail

BACKUP_DIR=/opt/duyo/backups/postgres
RECIPIENT=backup@duyo.uz
DATE=$(date +%Y%m%d_%H%M%S)
DOW=$(date +%u)        # 1=Mon..7=Sun
DOM=$(date +%d)
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"

OUT="$BACKUP_DIR/daily/duyo_${DATE}.sql.gz.gpg"

# Refuse to run rather than silently write a plaintext dump: if the key is
# missing, the safe outcome is a loud failure in the log, not a year of
# unprotected children's messages accumulating unnoticed.
if ! gpg --list-keys "$RECIPIENT" >/dev/null 2>&1; then
  echo "[$(date -Is)] FATAL: gpg key $RECIPIENT not found — refusing to write an unencrypted backup" >&2
  exit 1
fi

# --trust-model always: the key is imported directly by an operator, and there
# is no web of trust on a server. pipefail (set above) is what makes a pg_dump
# failure fail the whole pipeline instead of leaving a valid, empty .gz.
docker exec duyo-postgres pg_dump -U duyo -d duyo --no-owner --no-privileges \
  | gzip -9 \
  | gpg --batch --yes --trust-model always --encrypt --recipient "$RECIPIENT" \
  > "$OUT"

# A dump of this database is tens of megabytes. Anything under a megabyte
# means the pipeline produced something wrong, and a truncated backup that
# looks fine in `ls` is worse than no backup, because it is trusted.
SIZE=$(stat -c %s "$OUT")
if [ "$SIZE" -lt 1000000 ]; then
  echo "[$(date -Is)] FATAL: backup is only ${SIZE} bytes — removing it" >&2
  rm -f "$OUT"
  exit 1
fi

# Hard-link weekly (Sunday) and monthly (1st) — same inode, so the retention
# rules below expire copies independently without storing the bytes twice.
if [ "$DOW" = "7" ]; then
  ln -f "$OUT" "$BACKUP_DIR/weekly/duyo_${DATE}.sql.gz.gpg"
fi
if [ "$DOM" = "01" ]; then
  ln -f "$OUT" "$BACKUP_DIR/monthly/duyo_${DATE}.sql.gz.gpg"
fi

# Retention. Both extensions are matched so the plaintext dumps written before
# encryption was introduced still age out on their original schedule.
for d in daily:14 weekly:56 monthly:365; do
  sub=${d%%:*}; days=${d##*:}
  find "$BACKUP_DIR/$sub" -name "*.sql.gz.gpg" -mtime "+$days" -delete
  find "$BACKUP_DIR/$sub" -name "*.sql.gz"     -mtime "+$days" -delete
done

echo "[$(date -Is)] Backup OK: $OUT ($(du -h "$OUT" | cut -f1), encrypted to $RECIPIENT)"
