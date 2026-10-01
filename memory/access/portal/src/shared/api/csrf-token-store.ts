// La marca CSRF vive solo en memoria: nunca en localStorage ni en la URL.
let currentToken: string | undefined

export function getCsrfToken(): string | undefined {
  return currentToken
}

export function setCsrfToken(token: string | undefined): void {
  currentToken = token
}
