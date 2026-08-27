# Constitution: vision-infra

## Metadata

```yaml
created: 2026-08-26
version: 1.0
```

## Descripción

Infraestructura compartida de Omnia: gateway de LLM, memoria de equipo y métricas cross-repo, desplegados en Coolify sobre un VPS dedicado.

**Tipo:** otro — infraestructura de plataforma (varios servicios Docker independientes, no una app con una sola interfaz).

**Arquitectura:** servicios independientes, uno por subcarpeta, cada uno un recurso Docker Compose separado en Coolify — no se comunican entre sí salvo por el gateway de LLM compartido.

---

## Principios del Proyecto

### 1. Feature-Driven Development

- Cada feature tiene su especificación completa
- Features son unidades independientes de trabajo
- Código se escribe después de la especificación

### 2. Estructura de Especificaciones

- `0_contract.md` - Contrato de la feature
- `1_spec.md` - Especificación técnica
- `2_acceptance-criteria.md` - Criterios de aceptación
- `3_test-plan.md` - Plan de testing

### 3. Flujo de Trabajo

1. Crear especificación de feature
2. Implementar según especificación
3. Testing según criterios
4. Marcar feature como done

---

## Stack Técnico

- **Lenguaje**: Python (LiteLLM, Mem0/OpenMemory) + Node.js (Hermes, metrics-hub)
- **Framework**: Docker Compose (orquestación), LiteLLM (gateway), Mem0/OpenMemory + Qdrant (memoria)
- **Testing**: ninguno configurado todavía

---

## Convenciones

- Puertos publicados solo en `127.0.0.1` — acceso remoto siempre por túnel SSH, nunca puerto abierto a internet (regla post-incidente 20-jul-2026).
- Config estática horneada en la imagen (`COPY` en el Dockerfile), no bind-mounts.
- Secrets solo como variables de entorno en Coolify — nunca committeados.

---

## Integración Plane

> Bloque opcional. Lo llena `/setup` cuando el usuario elige conectar Vision V2 con su workspace de Plane.
> Si `enabled` es `false` (o este bloque no existe), la skill `plane-sync` se ejecuta como no-op silencioso y el resto del framework funciona normal.

```yaml
plane:
  enabled: true
  project_id: "ca75c562-081c-4236-904d-b403484dcf7d"
  status_map:
    pending: "Todo"
    in-progress: "In Progress"
    done: "Done"
  task_match:
    method: "by-name"
    custom_field_name: null
```

---

## Módulos Implementados

_Ningún módulo implementado aún._
