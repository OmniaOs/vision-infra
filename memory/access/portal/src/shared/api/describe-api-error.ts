import { ApiError } from './api-error'

const MESSAGES: Record<string, string> = {
  credenciales: 'Usuario o contraseña incorrectos.',
  demasiados_intentos: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  too_many_requests: 'Demasiadas peticiones. Espera un momento.',
  invitacion_invalida: 'La invitación no es válida o ya caducó. Pide una nueva a un administrador.',
  contrasena_debil: 'La contraseña no cumple los requisitos.',
  contrasena_actual_incorrecta: 'La contraseña actual no es correcta.',
  ya_existe: 'Ya existe una persona con ese usuario.',
  no_existe: 'Esa persona ya no existe.',
  forbidden: 'No tienes permiso para hacer esto.',
  csrf: 'La sesión no es válida para esta acción. Recarga la página.',
  gestionado_por_variable_de_entorno: 'Esta persona se gestiona en Coolify, no desde el portal.',
  no_puedes_darte_de_baja_a_ti_mismo: 'No puedes darte de baja a ti mismo.',
  no_puedes_quitarte_el_rol_admin: 'No puedes quitarte el rol de administrador a ti mismo.',
  limite_de_tokens: 'Ya tiene el máximo de tokens activos. Revoca alguno para crear otro.',
  requiere_sesion_del_portal: 'Para crear tokens entra al portal con tu usuario y contraseña.',
  gestionado_en_coolify: 'Ese token se quita en Coolify, no desde el portal.',
  no_aplica: 'Esta acción no se puede hacer con esta persona.',
  sin_archivo_de_usuarios: 'El servidor aún no tiene activado el archivo de usuarios.',
  unauthorized: 'Tu sesión terminó. Vuelve a entrar.',
}

/** Texto en espanol, listo para mostrar a una persona. */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const known = MESSAGES[error.code]
    if (known && error.detail && error.code === 'contrasena_debil') return error.detail
    if (known) return known
    if (error.detail) return error.detail
    return 'No se pudo completar la acción.'
  }
  return 'No se pudo conectar con el servidor.'
}
