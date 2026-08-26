# Constitution: vision-infra

## Metadata

```yaml
created: 2026-08-26
version: 1.0
```

## Descripción



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

- **Lenguaje**: [Lenguaje principal]
- **Framework**: [Framework principal]
- **Testing**: [Framework de testing]

---

## Convenciones

- [Convención de código 1]
- [Convención de código 2]

---

## Integración ClickUp

> Bloque opcional. Lo llena `/setup` cuando el usuario elige conectar Vision V2 con su workspace de ClickUp.
> Si `enabled` es `false` (o este bloque no existe), la skill `clickup-sync` se ejecuta como no-op silencioso y el resto del framework funciona normal.

```yaml
clickup:
  enabled: false
  workspace_id: ""
  list_id: ""
  status_map:
    pending: ""
    in-progress: ""
    done: ""
  task_match:
    method: "by-name"           # "by-name" o "by-custom-field"
    custom_field_name: null     # solo si method == "by-custom-field"
```

---

## Módulos Implementados

_Ningún módulo implementado aún._