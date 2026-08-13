export function obterRedirectInterno(valor) {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//')) {
    return null
  }

  let normalizado = valor

  try {
    for (let i = 0; i < 2; i += 1) {
      const decodificado = decodeURIComponent(normalizado)
      if (decodificado === normalizado) break
      normalizado = decodificado
    }
  } catch {
    return null
  }

  if (
    !normalizado.startsWith('/')
    || normalizado.startsWith('//')
    || normalizado.includes('\\')
    || [...normalizado].some((caractere) => {
      const codigo = caractere.charCodeAt(0)
      return codigo <= 31 || codigo === 127
    })
  ) {
    return null
  }

  return valor
}
