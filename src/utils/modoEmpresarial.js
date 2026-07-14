export const MODO_EMPRESA_CLASSICO = 'classico'
export const MODO_EMPRESA_EMPRESARIAL = 'empresarial'

export const SETOR_ADMIN_EMPRESA = 'admin_empresa'
export const SETOR_CHEFE_DEPARTAMENTO = 'chefe_departamento'
export const SETOR_REITORIA_AUDITORIA = 'reitoria_auditoria'
export const SETOR_RH = 'setor_rh'

export const setoresEmpresariais = [
  {
    id: SETOR_ADMIN_EMPRESA,
    nome: 'Administrador Empresa',
    resumo: 'Observa todos os setores, acompanha o funcionamento da empresa e acessa o dashboard geral.',
  },
  {
    id: SETOR_CHEFE_DEPARTAMENTO,
    nome: 'Chefe de departamento',
    resumo: 'Solicita vagas da area, preenchendo dados da oportunidade, salario e premiacao.',
  },
  {
    id: SETOR_REITORIA_AUDITORIA,
    nome: 'Reitoria ou Auditoria',
    resumo: 'Analisa a solicitacao, revisa principalmente salario e premiacao, aprova ou devolve com comentarios.',
  },
  {
    id: SETOR_RH,
    nome: 'Setor RH',
    resumo: 'Recebe vagas aprovadas, publica oportunidades e administra candidatos no software.',
  },
]

export const setoresEmpresariaisMap = setoresEmpresariais.reduce((mapa, setor) => ({
  ...mapa,
  [setor.id]: setor,
}), {})

export const isModoEmpresarial = (perfil) => (
  perfil?.modoEmpresa === MODO_EMPRESA_EMPRESARIAL
  || perfil?.modoOperacao === MODO_EMPRESA_EMPRESARIAL
  || perfil?.fluxoEmpresarialAtivo === true
)

export const perfilExigeSetorEmpresarial = (perfil) => (
  perfil?.tipo === 'empresa' && isModoEmpresarial(perfil)
)

export const obterSetorEmpresarial = (setorId) => (
  setoresEmpresariaisMap[setorId] || null
)

export const obterSetorAtual = (perfil) => (
  obterSetorEmpresarial(perfil?.setorEmpresarial?.id)
)

export const perfilTemSetorEmpresarial = (perfil) => (
  Boolean(obterSetorAtual(perfil))
)

export const obterHashSenhaSetor = (perfil, setorId) => (
  perfil?.setoresEmpresariais?.[setorId]?.senhaHash
  || perfil?.senhasSetores?.[setorId]
  || ''
)

export const podeGerenciarCandidatosEmpresa = (perfil) => {
  if (!isModoEmpresarial(perfil)) return true

  const setorId = perfil?.setorEmpresarial?.id
  return setorId === SETOR_RH || setorId === SETOR_ADMIN_EMPRESA
}

export const podeSolicitarVagaEmpresarial = (perfil) => {
  if (!isModoEmpresarial(perfil)) return true

  return perfil?.setorEmpresarial?.id === SETOR_CHEFE_DEPARTAMENTO
}

export const podePublicarVagaEmpresarial = (perfil) => {
  if (!isModoEmpresarial(perfil)) return true

  return perfil?.setorEmpresarial?.id === SETOR_RH
}

export const hashSenhaSetor = async (senha, uid = '') => {
  const senhaNormalizada = String(senha || '').trim()
  if (!senhaNormalizada) return ''

  const salt = String(uid || '').trim()
  const payload = `${salt}:${senhaNormalizada}`

  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    const data = new TextEncoder().encode(payload)
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)

    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  let hash = 0
  for (let index = 0; index < payload.length; index += 1) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(index)
    hash |= 0
  }

  return String(hash)
}

export const criarPayloadSetoresEmpresariais = async (senhasPorSetor, uid) => {
  const entradas = await Promise.all(setoresEmpresariais.map(async (setor) => ([
    setor.id,
    {
      id: setor.id,
      nome: setor.nome,
      resumo: setor.resumo,
      senhaHash: await hashSenhaSetor(senhasPorSetor?.[setor.id], uid),
      senhaDefinida: Boolean(String(senhasPorSetor?.[setor.id] || '').trim()),
    }
  ])))

  return Object.fromEntries(entradas)
}
