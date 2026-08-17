const PESOS_PADRAO = Object.freeze({
  hardSkills: 35,
  experiencia: 20,
  escolaridade: 10,
  idiomas: 10,
  modeloTrabalho: 10,
  responsabilidades: 15
})

const normalizarTexto = (valor) => String(valor ?? '').trim()

export const textoParaLista = (valor) => String(valor ?? '')
  .split(/[,;\n]/)
  .map((item) => item.trim())
  .filter(Boolean)

export const listaParaTexto = (valor) => Array.isArray(valor) ? valor.join(', ') : ''

export const criarRubricaCompatibilidadePadrao = ({ ativa = true } = {}) => ({
  ativa,
  perfilIdeal: '',
  requisitosObrigatorios: '',
  requisitosDesejaveis: '',
  criteriosEliminatorios: '',
  experienciaMinima: '',
  escolaridadeMinima: '',
  idiomasExigidos: '',
  modeloTrabalho: '',
  pesos: { ...PESOS_PADRAO },
  versao: 0
})

export const normalizarRubricaDaVaga = (rubrica) => {
  if (!rubrica || typeof rubrica !== 'object' || Array.isArray(rubrica)) {
    return criarRubricaCompatibilidadePadrao({ ativa: false })
  }

  return {
    ativa: rubrica.ativa !== false,
    perfilIdeal: normalizarTexto(rubrica.perfilIdeal),
    requisitosObrigatorios: listaParaTexto(rubrica.requisitosObrigatorios),
    requisitosDesejaveis: listaParaTexto(rubrica.requisitosDesejaveis),
    criteriosEliminatorios: listaParaTexto(rubrica.criteriosEliminatorios),
    experienciaMinima: rubrica.experienciaMinima === null || rubrica.experienciaMinima === undefined
      ? ''
      : String(rubrica.experienciaMinima),
    escolaridadeMinima: normalizarTexto(rubrica.escolaridadeMinima),
    idiomasExigidos: listaParaTexto(rubrica.idiomasExigidos),
    modeloTrabalho: normalizarTexto(rubrica.modeloTrabalho),
    pesos: {
      ...PESOS_PADRAO,
      ...(rubrica.pesos && typeof rubrica.pesos === 'object' ? rubrica.pesos : {})
    },
    versao: Number(rubrica.versao || 0)
  }
}

export const prepararRubricaParaSalvar = (rubrica, versaoAnterior = 0) => {
  if (!rubrica?.ativa) return null

  return {
    ativa: true,
    versao: Math.max(1, Number(versaoAnterior || rubrica.versao || 0) + 1),
    perfilIdeal: normalizarTexto(rubrica.perfilIdeal),
    requisitosObrigatorios: textoParaLista(rubrica.requisitosObrigatorios),
    requisitosDesejaveis: textoParaLista(rubrica.requisitosDesejaveis),
    criteriosEliminatorios: textoParaLista(rubrica.criteriosEliminatorios),
    experienciaMinima: Number(rubrica.experienciaMinima || 0),
    escolaridadeMinima: normalizarTexto(rubrica.escolaridadeMinima),
    idiomasExigidos: textoParaLista(rubrica.idiomasExigidos),
    modeloTrabalho: normalizarTexto(rubrica.modeloTrabalho),
    pesos: Object.fromEntries(
      Object.entries(PESOS_PADRAO).map(([chave]) => [chave, Number(rubrica.pesos?.[chave] || 0)])
    )
  }
}

export const somarPesosRubrica = (rubrica) => Object.values(rubrica?.pesos || {})
  .reduce((total, peso) => total + Number(peso || 0), 0)

export const validarRubricaCompatibilidade = (rubrica) => {
  if (!rubrica?.ativa) return { valida: true, motivo: '' }

  const possuiBase = normalizarTexto(rubrica.perfilIdeal)
    || textoParaLista(rubrica.requisitosObrigatorios).length
    || textoParaLista(rubrica.requisitosDesejaveis).length

  if (!possuiBase) return { valida: false, motivo: 'sem_criterios' }
  if (somarPesosRubrica(rubrica) !== 100) return { valida: false, motivo: 'pesos' }

  const pesosValidos = Object.values(rubrica.pesos || {})
    .every((peso) => Number.isFinite(Number(peso)) && Number(peso) >= 0 && Number(peso) <= 100)

  if (!pesosValidos) return { valida: false, motivo: 'pesos' }
  if (Number(rubrica.experienciaMinima || 0) < 0) return { valida: false, motivo: 'experiencia' }

  return { valida: true, motivo: '' }
}

export const pesosPadraoRubrica = PESOS_PADRAO
