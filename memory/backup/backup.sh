#!/bin/sh
# Respaldo de Mem0: Qdrant (vectores) + SQLite de OpenMemory (usuarios, categorias, historial).
# Siempre CIFRADO (AES-256) antes de salir del contenedor: contiene datos de clientes.
# Destino: S3/R2 (BACKUP_S3_*) o un directorio (BACKUP_DEST_DIR). Restauracion: restore.sh.
set -eu

QDRANT="${QDRANT_URL:-http://mem0_store:6333}"
DATA_DIR="${DATA_DIR:-/data}"             # volumen openmemory_data (OpenMemory)
MEM0_HOME_DIR="${MEM0_HOME_DIR:-/mem0home}" # volumen de /root/.mem0 (history.db)
OUT="${BACKUP_DIR:-/backups}"             # copia local reciente
KEEP_LOCAL="${BACKUP_KEEP_LOCAL:-3}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
PREFIX="${BACKUP_PREFIX:-mem0}"

log() { echo "[backup $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

dest_ready() {
  if [ -n "${BACKUP_S3_BUCKET:-}" ] && [ -n "${BACKUP_S3_ENDPOINT:-}" ] && [ -n "${BACKUP_S3_KEY_ID:-}" ] && [ -n "${BACKUP_S3_SECRET:-}" ]; then
    export RCLONE_CONFIG_REMOTE_TYPE=s3 RCLONE_CONFIG_REMOTE_PROVIDER="${BACKUP_S3_PROVIDER:-Cloudflare}" \
      RCLONE_CONFIG_REMOTE_ENDPOINT="$BACKUP_S3_ENDPOINT" RCLONE_CONFIG_REMOTE_ACCESS_KEY_ID="$BACKUP_S3_KEY_ID" \
      RCLONE_CONFIG_REMOTE_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET" RCLONE_CONFIG_REMOTE_NO_CHECK_BUCKET=true
    DEST="REMOTE:${BACKUP_S3_BUCKET}/${PREFIX}"
    return 0
  fi
  if [ -n "${BACKUP_DEST_DIR:-}" ]; then DEST="$BACKUP_DEST_DIR/$PREFIX"; mkdir -p "$DEST"; return 0; fi
  return 1
}

sqlite_copy() { # origen destino
  [ -f "$1" ] || { log "no existe $1, se omite"; return 0; }
  sqlite3 -readonly "$1" ".backup '$2'"
  [ "$(sqlite3 "$2" 'pragma integrity_check;')" = "ok" ] || { log "ERROR: copia corrupta de $1"; return 1; }
}

run_once() {
  if [ -z "${BACKUP_PASSPHRASE:-}" ]; then log "BACKUP_PASSPHRASE no esta definida: no se respalda (nunca se sube nada sin cifrar)"; return 1; fi
  if ! dest_ready; then log "sin destino (BACKUP_S3_* o BACKUP_DEST_DIR): solo se genera la copia local"; DEST=""; fi

  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT
  mkdir -p "$work/qdrant" "$work/sqlite"

  # 1) Qdrant: una instantanea por coleccion (consistente, sin parar el servicio)
  cols="$(curl -sf "$QDRANT/collections" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || true)"
  ncol=0
  for c in $cols; do
    snap="$(curl -sf -X POST "$QDRANT/collections/$c/snapshots" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)"
    [ -n "$snap" ] || { log "ERROR: no se pudo crear la instantanea de $c"; return 1; }
    curl -sf "$QDRANT/collections/$c/snapshots/$snap" -o "$work/qdrant/$c.snapshot"
    curl -sf -X DELETE "$QDRANT/collections/$c/snapshots/$snap" >/dev/null || true
    ncol=$((ncol + 1))
  done
  [ "$ncol" -gt 0 ] || log "AVISO: Qdrant no tiene colecciones todavia"

  # 2) SQLite de OpenMemory
  sqlite_copy "$DATA_DIR/openmemory.db" "$work/sqlite/openmemory.db"
  sqlite_copy "$MEM0_HOME_DIR/history.db" "$work/sqlite/history.db"

  # 2b) Usuarios del panel (solo hashes, nunca tokens). Si no hay archivo todavia, se omite.
  for f in users.json portal.json aliases.json; do
    if [ -f "${ACCESS_DIR:-/accessdata}/$f" ]; then cp "${ACCESS_DIR:-/accessdata}/$f" "$work/$f"; fi
  done

  # 3) Manifiesto, empaquetado y cifrado
  { echo "creado=$stamp"; echo "colecciones=$ncol"; ls -l "$work/qdrant" "$work/sqlite" | sed 's/^/  /'; } > "$work/MANIFEST.txt"
  mkdir -p "$OUT"
  file="$OUT/${PREFIX}-$stamp.tar.enc"
  tar -C "$work" -cf - . | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$file"
  size="$(wc -c < "$file")"

  # 4) Subida y verificacion por tamano
  if [ -n "$DEST" ]; then
    case "$DEST" in
      REMOTE:*) rclone copyto "$file" "$DEST/$(basename "$file")" ;;
      *) cp "$file" "$DEST/" ;;
    esac
    remote_size="$(case "$DEST" in REMOTE:*) rclone lsl "$DEST/$(basename "$file")" | awk '{print $1}';; *) wc -c < "$DEST/$(basename "$file")";; esac)"
    [ "$remote_size" = "$size" ] || { log "ERROR: el destino tiene $remote_size bytes y el local $size"; return 1; }
    case "$DEST" in
      REMOTE:*) rclone delete --min-age "${KEEP_DAYS}d" "$DEST" || log "AVISO: no se pudo aplicar la retencion remota" ;;
      *) find "$DEST" -name "${PREFIX}-*.tar.enc" -mtime "+$KEEP_DAYS" -delete ;;
    esac
  fi

  # 5) Retencion local y marca de ultimo exito (la usa el healthcheck)
  ls -1t "$OUT"/${PREFIX}-*.tar.enc 2>/dev/null | tail -n "+$((KEEP_LOCAL + 1))" | while read -r old; do rm -f "$old"; done
  date -u +%s > "$OUT/last-ok"
  log "OK $(basename "$file") ($size bytes, $ncol colecciones, destino: ${DEST:-solo local})"
  trap - EXIT; rm -rf "$work"
}

if [ "${1:-}" = "once" ] || [ "${ONCE:-}" = "1" ]; then run_once; exit $?; fi

log "servicio de respaldo iniciado (cada ${INTERVAL}s, retencion ${KEEP_DAYS} dias)"
while true; do
  run_once || log "El respaldo FALLO; se reintenta en la proxima ronda"
  sleep "$INTERVAL"
done
