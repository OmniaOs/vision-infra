#!/usr/bin/env bash
# Conecta esta maquina a la memoria compartida de Omnia (Mem0 + Basic Memory).
#
#   OMNIA_TOKEN='omnia_...' bash -c "$(curl -fsSL https://memory.omniaos.ai/setup.sh)"
#
# El token te lo da el admin. Idempotente. Comprueba las dos rutas y guarda
# OMNIA_MEMORY_TOKEN en tu shell; no abre tuneles ni toca ningun repo.
set -euo pipefail

token="${OMNIA_TOKEN:-}"
if [ -z "$token" ]; then
  read -r -s -p "Pega tu token de Omnia: " token
  echo
fi
case "$token" in omnia_*) ;; *) echo "Ese token no tiene el formato esperado (omnia_...)." >&2; exit 1 ;; esac

echo "== Comprobando las dos rutas =="
for host in memory.omniaos.ai kb.omniaos.ai; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -H "Authorization: Bearer $token" "https://$host/whoami" || true)
  if [ "$code" = "401" ]; then echo "$host rechazo el token (401). Pide uno nuevo al admin; no se cambio nada." >&2; exit 1; fi
  if [ "$code" != "200" ]; then echo "No pude llegar a $host (HTTP $code). No se cambio nada." >&2; exit 1; fi
  echo "  ok  $host"
done

# Un archivo propio, cargado desde el rc de tu shell, para poder actualizarlo sin duplicar lineas.
mkdir -p "$HOME/.omnia"
umask 077
printf "export OMNIA_MEMORY_TOKEN='%s'\n" "$token" > "$HOME/.omnia/env"
for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
  [ -f "$rc" ] || continue
  grep -q '\.omnia/env' "$rc" || printf '\n[ -f "$HOME/.omnia/env" ] && . "$HOME/.omnia/env"\n' >> "$rc"
done

echo
echo "Listo. Abre una terminal nueva (o: . ~/.omnia/env) y reinicia tu IDE / Claude Code."
