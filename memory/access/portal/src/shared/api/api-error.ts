/** Error de la API con el codigo estable que devuelve el servidor (campo `error`). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly detail?: string

  constructor(status: number, code: string, detail?: string) {
    super(code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}
