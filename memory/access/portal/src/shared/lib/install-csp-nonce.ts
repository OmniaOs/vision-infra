declare global {
  interface Window {
    __webpack_nonce__?: string
  }
}

/** Valor que el servidor puso en la pagina para esta respuesta, o undefined en desarrollo. */
export function readCspNonce(): string | undefined {
  const value = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? ''
  return value && !value.startsWith('__') ? value : undefined
}

/**
 * Algunas librerias (el bloqueo de scroll de los dialogos) crean etiquetas <style> en tiempo de
 * ejecucion. Leen el nonce de esta variable global; sin el, la politica de contenido las bloquearia.
 */
export function installCspNonce(): void {
  window.__webpack_nonce__ = readCspNonce()
}
