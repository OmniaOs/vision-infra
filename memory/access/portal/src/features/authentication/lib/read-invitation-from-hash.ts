const INVITATION_HASH = /^#invitacion=([\w-]{20,})$/

/** El enlace de invitacion lleva el codigo tras el # para que nunca viaje al servidor ni a un registro. */
export function readInvitationFromHash(hash: string): string | null {
  const match = INVITATION_HASH.exec(hash)
  return match ? match[1] : null
}
