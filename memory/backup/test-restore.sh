#!/bin/sh
# Prueba local de extremo a extremo: respalda un Qdrant con datos, restaura en otro LIMPIO
# y comprueba que los datos vuelven, que el archivo esta cifrado y que una clave mala falla.
#   sh memory/backup/test-restore.sh        (necesita Docker; no toca nada de produccion)
set -eu
cd "$(dirname "$0")"
N=omtest
PASS="clave-de-prueba-$$"
SECRET="texto-secreto-del-cliente-$$"

cleanup() {
  docker rm -f ${N}-qa ${N}-qb >/dev/null 2>&1 || true
  docker network rm ${N}-net >/dev/null 2>&1 || true
  docker volume rm ${N}-data ${N}-home ${N}-out ${N}-dest >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup
ok() { echo "  ok   $*"; }
fail() { echo "  FALLA $*" >&2; exit 1; }

docker build -q -t ${N}-img . >/dev/null
docker network create ${N}-net >/dev/null
docker run -d --name ${N}-qa --network ${N}-net qdrant/qdrant >/dev/null
docker run -d --name ${N}-qb --network ${N}-net qdrant/qdrant >/dev/null
for v in data home out dest; do docker volume create ${N}-$v >/dev/null; done

# T = contenedor de la imagen de respaldo con los volumenes de prueba
T() { docker run --rm --network ${N}-net -v ${N}-data:/data -v ${N}-home:/mem0home -v ${N}-out:/backups -v ${N}-dest:/dest \
  -e BACKUP_PASSPHRASE="${BP-$PASS}" -e QDRANT_URL="${QURL:-http://${N}-qa:6333}" "$@"; }

echo "== preparando datos"
for h in qa qb; do
  i=0; until T --entrypoint curl ${N}-img -sf http://${N}-$h:6333/healthz >/dev/null 2>&1; do i=$((i+1)); [ $i -lt 40 ] || fail "qdrant $h no arranca"; sleep 1; done
done
T --entrypoint curl ${N}-img -sf -X PUT http://${N}-qa:6333/collections/openmemory -H 'Content-Type: application/json' \
  -d '{"vectors":{"size":4,"distance":"Cosine"}}' >/dev/null
T --entrypoint curl ${N}-img -sf -X PUT "http://${N}-qa:6333/collections/openmemory/points?wait=true" -H 'Content-Type: application/json' \
  -d "{\"points\":[{\"id\":1,\"vector\":[0.1,0.2,0.3,0.4],\"payload\":{\"memory\":\"$SECRET\",\"user_id\":\"int-frutal\"}},{\"id\":2,\"vector\":[0.4,0.3,0.2,0.1],\"payload\":{\"memory\":\"dos\",\"user_id\":\"omnia-global\"}},{\"id\":3,\"vector\":[0.9,0.1,0.1,0.1],\"payload\":{\"memory\":\"tres\",\"user_id\":\"omnia-global\"}}]}" >/dev/null
T --entrypoint sh ${N}-img -c "sqlite3 /data/openmemory.db \"create table memories(id integer, texto text); insert into memories values (1,'$SECRET'),(2,'otro');\" && sqlite3 /mem0home/history.db 'create table history(id integer); insert into history values (1);'"
before="$(T --entrypoint curl ${N}-img -sf -X POST http://${N}-qa:6333/collections/openmemory/points/count -H 'Content-Type: application/json' -d '{"exact":true}' | grep -o '"count":[0-9]*')"
[ "$before" = '"count":3' ] || fail "datos de origen: $before"
ok "origen con 3 puntos y SQLite con 2 filas"

echo "== respaldo"
T -e BACKUP_DEST_DIR=/dest ${N}-img backup.sh once | tail -2
FILE="$(T --entrypoint sh ${N}-img -c 'ls /dest/mem0/*.tar.enc | head -1')"
[ -n "$FILE" ] || fail "no se genero el archivo"
ok "archivo en el destino: $(basename "$FILE")"
T --entrypoint sh ${N}-img -c "grep -c '$SECRET' $FILE" >/dev/null 2>&1 && fail "el archivo contiene texto legible (no esta cifrado)" || ok "el archivo no contiene texto legible"

echo "== restauracion en un Qdrant LIMPIO"
T --entrypoint curl ${N}-img -sf http://${N}-qb:6333/collections | grep -q '"collections":\[\]' || fail "el destino no estaba limpio"
QURL="http://${N}-qb:6333" T ${N}-img restore.sh "$FILE" /dest/restaurado | tail -5
after="$(T --entrypoint curl ${N}-img -sf -X POST http://${N}-qb:6333/collections/openmemory/points/count -H 'Content-Type: application/json' -d '{"exact":true}' | grep -o '"count":[0-9]*')"
[ "$after" = '"count":3' ] || fail "tras restaurar: $after"
ok "Qdrant restaurado con 3 puntos"
got="$(T --entrypoint curl ${N}-img -sf -X POST http://${N}-qb:6333/collections/openmemory/points/scroll -H 'Content-Type: application/json' -d '{"limit":10,"with_payload":true}' | grep -c "$SECRET")"
[ "$got" -ge 1 ] || fail "el payload original no volvio"
ok "el contenido original volvio intacto"
rows="$(T --entrypoint sqlite3 ${N}-img /dest/restaurado/openmemory.db 'select count(*) from memories;')"
[ "$rows" = "2" ] || fail "SQLite restaurado: $rows filas"
ok "SQLite restaurado con 2 filas"

echo "== clave equivocada"
if BP="clave-mala" QURL="http://${N}-qb:6333" T ${N}-img restore.sh "$FILE" /dest/malo >/dev/null 2>&1; then fail "restauro con clave equivocada"; else ok "con clave equivocada no restaura"; fi

echo "== sin clave no se respalda nada"
if BP="" T -e BACKUP_DEST_DIR=/dest ${N}-img backup.sh once >/dev/null 2>&1; then fail "respaldo sin clave"; else ok "sin BACKUP_PASSPHRASE se niega a respaldar"; fi
echo "TODO OK"
