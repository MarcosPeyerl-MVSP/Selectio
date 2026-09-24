import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mesclarEstadoOnboarding } from '../src/utils/onboarding.js'

test('repetir tour salvo em users prevalece sobre perfil antigo concluido', () => {
  const result = mesclarEstadoOnboarding(
    { tourIndicadorConcluido: false, onboardingTour: { indicadorConcluido: false } },
    { tourIndicadorConcluido: true, onboardingTour: { indicadorConcluido: true } }
  )
  assert.equal(result.tourIndicadorConcluido, false)
  assert.equal(result.onboardingTour.indicadorConcluido, false)
})

test('conclusao remota prevalece sobre copia desatualizada do perfil', () => {
  const result = mesclarEstadoOnboarding({ tourEmpresaConcluido: true }, { tourEmpresaConcluido: false })
  assert.equal(result.tourEmpresaConcluido, true)
  assert.equal(result.onboardingTour.empresaConcluido, true)
})

test('contas legadas preservam estado e cada tipo de tour permanece independente', () => {
  const result = mesclarEstadoOnboarding({ onboardingTour: { empresaConcluido: false } },
    { tourEmpresaConcluido: true, tourIndicadorConcluido: true })
  assert.equal(result.tourEmpresaConcluido, false)
  assert.equal(result.tourIndicadorConcluido, true)
  assert.deepEqual(mesclarEstadoOnboarding(), { onboardingTour: {} })
})
