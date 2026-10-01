export interface McpCommands {
  windows: string
  unix: string
}

export interface PortalInvitation {
  link: string
  expiresAt: string
}

/** Lo que el servidor entrega UNA sola vez: ni el token ni el enlace se pueden volver a pedir. */
export interface IssuedCredentials {
  userId: string
  mcpToken?: string
  commands?: McpCommands
  invitation?: PortalInvitation
}
