#!/bin/sh
# Restaura un respaldo de Mem0 (generado por backup.sh).
#
#   restore.sh <archivo.tar.enc> [carpeta-destino-sqlite]
#
# Requiere BACKUP_PASSPHRASE (la misma con que se cifro) y QDRANT_URL.
# - Qdrant: sube cada instantanea a su coleccion (reemplaza su contenido).
# - SQLite: deja openmemory.db e history.db en la carpeta destino; hay que PARAR
#   openmemory-mcp antes de copiarlos al volumen y arrancarlo despues.
set -eu

FILE="${1:?uso: restore.sh <archivo.tar.enc> [carpeta-destino-sqlite]}"
SQLITE_OUT="${2:-./restaurado-sqlite}"
QDRANT="${QDRANT_URL:-http://mem0_store:6333}"
[ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "falta BACKUP_PASSPHRASE" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" | tar -C "$work" -xf -
echo "--- contenido del respaldo"; cat "$work/MANIFEST.txt"

for s in "$work"/qdrant/*.snapshot; do
  [ -f "$s" ] || continue
  c="$(basename "$s" .snapshot)"
  curl -sf -X POST "$QDRANT/collections/$c/snapshots/upload?priority=snapshot" -F "snapshot=@$s" >/dev/null
  echo "Qdrant: coleccion $c restaurada"
done

mkdir -p "$SQLITE_OUT"
for d in "$work"/sqlite/*.db; do
  [ -f "$d" ] || continue
  [ "$(sqlite3 "$d" 'pragma integrity_check;')" = "ok" ] || { echo "ERROR: $d esta corrupto" >&2; exit 1; }
  cp "$d" "$SQLITE_OUT/"
  echo "SQLite: $(basename "$d") copiado a $SQLITE_OUT (integridad ok)"
done
echo "Listo. Copia los .db al volumen con openmemory-mcp PARADO y vuelve a arrancarlo."
