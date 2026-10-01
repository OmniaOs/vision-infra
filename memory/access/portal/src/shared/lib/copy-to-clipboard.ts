/** Copia texto al portapapeles. Devuelve false si el navegador lo rechaza (permisos o contexto no seguro). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
