# Respaldo cifrado de Mem0 (Qdrant + SQLite). Ver README.md.
FROM alpine:3.20
RUN apk add --no-cache sqlite curl openssl rclone tar
COPY backup.sh restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh
# Sano si hubo un respaldo correcto en las ultimas 2 rondas (con margen de arranque de 1 dia)
HEALTHCHECK --interval=10m --timeout=5s --start-period=24h \
  CMD [ -f /backups/last-ok ] && [ $(( $(date +%s) - $(cat /backups/last-ok) )) -lt $(( ${BACKUP_INTERVAL_SECONDS:-86400} * 2 )) ] || exit 1
CMD ["backup.sh"]
