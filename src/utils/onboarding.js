// users e a fonte atual; flags antigas no perfil so servem como fallback.
export function mesclarEstadoOnboarding(usuario = {}, perfil = {}) {
  const estado = { onboardingTour: { ...perfil.onboardingTour, ...usuario.onboardingTour } }
  for (const [field, nested] of [
    ['tourEmpresaConcluido', 'empresaConcluido'],
    ['tourIndicadorConcluido', 'indicadorConcluido']
  ]) {
    const value = [usuario.onboardingTour?.[nested], usuario[field], perfil.onboardingTour?.[nested], perfil[field]]
      .find((valor) => typeof valor === 'boolean')
    if (value !== undefined) {
      estado[field] = value
      estado.onboardingTour[nested] = value
    }
  }
  return estado
}
