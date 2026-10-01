# Respaldo cifrado de Mem0

Una copia diaria de lo que Mem0 guarda, cifrada antes de salir del contenedor y subida a un bucket
**fuera del servidor**. Sin esto, un fallo del disco o un volumen borrado por error perdería todo.

## Qué respalda y qué no

| Se respalda | Dónde vive |
|---|---|
| **Qdrant**: los vectores y el texto de cada recuerdo (una instantánea por colección) | volumen `qdrant_storage` |
| **`openmemory.db`**: usuarios, apps, categorías y metadatos de OpenMemory | volumen `openmemory_data` |
| **`history.db`**: historial de cambios de mem0 | volumen `openmemory_mem0home` |

| No lo cubre este respaldo | Dónde está su copia |
|---|---|
| Notas de Basic Memory | GitHub (`omnia-knowledge`), por el ciclo de `sync` |
| Usuarios del gateway (`ACCESS_DEVS`, archivo de usuarios) | Coolify (variables); el archivo de usuarios del panel tendrá su propio respaldo |
| Estado de Hermes (`hermes_state`, ~280 MB) | Sin respaldo: se reconstruye clonando los repos |
| Configuración de Coolify | Coolify |

> **Importante, corregido el 2026-10-01:** hasta ese día `openmemory.db` e `history.db` vivían en la capa
> del contenedor y **se perdían en cada redeploy** (solo sobrevivían los vectores). Ahora van a volúmenes.
> Los recuerdos que ya existían quedaron sin fila en `openmemory.db`: **se buscan con normalidad, pero no
> aparecen en la API de listado ni en las categorías** hasta volver a cargarlos (la migración de nombres lo hará).

## Lo que te toca configurar (una vez)

1. **Bucket de R2** (Cloudflare) **exclusivo para esto**, p. ej. `omnia-mem0-backups`. No reutilices un bucket de otra cosa.
2. **Token de API de R2 limitado a ese bucket** (permiso Object Read & Write). No reutilices el token de Coolify.
3. **Clave de cifrado:** genera una larga y guárdala **fuera del servidor** (gestor de contraseñas).
   **Sin ella los respaldos no se pueden abrir, y no hay forma de recuperarla.**
   ```bash
   openssl rand -base64 36 | tr -d '\r\n'
   ```
4. En Coolify → recurso `memory-mem0` → Environment Variables, añade (como secretos):

   | Variable | Valor |
   |---|---|
   | `BACKUP_PASSPHRASE` | la clave del paso 3 |
   | `BACKUP_S3_ENDPOINT` | `https://<id-de-cuenta>.r2.cloudflarestorage.com` |
   | `BACKUP_S3_BUCKET` | el nombre del bucket |
   | `BACKUP_S3_KEY_ID` | Access Key ID del token |
   | `BACKUP_S3_SECRET` | Secret Access Key del token |
   | `BACKUP_KEEP_DAYS` | `30` (opcional) |

5. Redeploy de `memory-mem0`.

## Comprobar que funciona

El servicio respalda al arrancar y luego cada 24 horas. En los logs de `backup` debe aparecer:

```
[backup ...] OK mem0-20261001T192104Z.tar.enc (102432 bytes, 1 colecciones, destino: REMOTE:bucket/mem0)
```

- Si dice `BACKUP_PASSPHRASE no esta definida`, no respalda nada (nunca sube algo sin cifrar).
- Si dice `sin destino`, solo hay copia local (3 más recientes en el volumen `backup_local`, que está en el **mismo
  disco** que los datos y no sirve como respaldo real).
- Si falla, se reintenta en la siguiente ronda y el contenedor queda **unhealthy** en Coolify a las 48 horas.
- Comprueba el archivo en el bucket (`mem0/mem0-<fecha>.tar.enc`). La retención borra los de más de `BACKUP_KEEP_DAYS`.

## Restaurar (probado en local)

Hay que **parar `openmemory-mcp`** mientras se copian las bases.

```bash
# 1) Descarga el archivo del bucket (rclone, el panel de R2 o la CLI de S3) al servidor.
# 2) Restaura desde un contenedor de la imagen de respaldo, en la red del stack:
docker run --rm -it --network <red-del-stack> -v <volumen-backup>:/backups \
  -e BACKUP_PASSPHRASE='<la clave>' -e QDRANT_URL=http://mem0_store:6333 \
  omnia/memory-backup:latest restore.sh /backups/mem0-<fecha>.tar.enc /backups/restaurado
# 3) Copia openmemory.db al volumen openmemory_data e history.db al volumen openmemory_mem0home.
# 4) Arranca openmemory-mcp y comprueba con una búsqueda.
```

Qdrant se restaura solo (sube cada colección con `priority=snapshot`, que reemplaza su contenido).
Con una clave equivocada la restauración falla sin tocar nada.

## Prueba automática

`sh memory/backup/test-restore.sh` levanta dos Qdrant reales en Docker, respalda uno con datos, restaura en el
otro **limpio** y comprueba: los puntos y su contenido vuelven, SQLite vuelve íntegro, el archivo no contiene texto
legible, una clave equivocada no restaura y sin clave no se respalda. No toca nada de producción.

**Haz un simulacro de restauración real** cuando el primer respaldo llegue al bucket, y repítelo cada cierto tiempo:
un respaldo que nunca se ha restaurado no es una garantía.

## Límites que conviene conocer

- Es un respaldo **diario**: un fallo justo antes de la copia pierde hasta 24 horas de recuerdos nuevos.
- Cifrado AES-256-CBC con PBKDF2 (200 000 iteraciones). Protege el archivo, no al servicio que lo genera: quien tenga la
  clave y el archivo puede leer todo.
- Las instantáneas de Qdrant se toman en caliente; Mem0 puede estar escribiendo. Qdrant garantiza que cada instantánea
  es consistente, pero SQLite y Qdrant no se copian en el mismo instante exacto.
- Las copias antiguas se borran por antigüedad; no hay versiones inmutables. Si el token del bucket se filtrara, alguien
  podría borrarlas: por eso debe estar limitado a ese bucket.
