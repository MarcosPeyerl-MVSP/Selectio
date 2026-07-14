import './styles/EmpresaModoEmpresarial.css'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FaCheckCircle,
  FaCommentDots,
  FaLock,
  FaRedo,
  FaRocket,
  FaTimesCircle,
  FaUsersCog
} from 'react-icons/fa'

import CardEsqueleto from '../../components/ui/CardEsqueleto'
import EstadoDados from '../../components/ui/EstadoDados'
import {
  atualizarFluxoAprovacaoVaga,
  listarVagasPorEmpresa,
  statusAprovacaoVagaLabels
} from '../../services/firestoreVagas'
import { atualizarSetoresEmpresariais } from '../../services/firestoreUsers'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useToast } from '../../hooks/useToast'
import {
  SETOR_ADMIN_EMPRESA,
  SETOR_CHEFE_DEPARTAMENTO,
  SETOR_REITORIA_AUDITORIA,
  SETOR_RH,
  hashSenhaSetor,
  obterSetorAtual,
  setoresEmpresariais
} from '../../utils/modoEmpresarial'

const getStatusAprovacao = (vaga) => (
  vaga.statusAprovacao || (vaga.status === 'aberta' ? 'publicada' : 'solicitada')
)

const formatDate = (value) => {
  if (!value) return 'Sem prazo'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace('.', '')
}

export function EmpresaFluxoEmpresarial({ empresa }) {
  const toast = useToast()
  const empresaUid = getFirebaseUid(empresa)
  const setorAtual = obterSetorAtual(empresa)
  const setorId = setorAtual?.id
  const [vagas, setVagas] = useState([])
  const [comentarios, setComentarios] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')

  useEffect(() => {
    let ativo = true

    const carregarVagas = async () => {
      if (!empresaUid) {
        setLoading(false)
        return
      }

      try {
        setError('')
        const data = await listarVagasPorEmpresa(empresaUid)
        if (ativo) setVagas(data)
      } catch (err) {
        if (ativo) setError(err.message)
      } finally {
        if (ativo) setLoading(false)
      }
    }

    carregarVagas()

    return () => {
      ativo = false
    }
  }, [empresaUid])

  const vagasFluxo = useMemo(() => (
    vagas
      .filter((vaga) => vaga.modoEmpresa === 'empresarial' || vaga.statusAprovacao)
      .sort((a, b) => {
        const order = { solicitada: 1, devolvida: 2, aprovada: 3, publicada: 4 }
        return (order[getStatusAprovacao(a)] || 9) - (order[getStatusAprovacao(b)] || 9)
      })
  ), [vagas])

  const atualizarComentario = (vagaId, value) => {
    setComentarios((current) => ({
      ...current,
      [vagaId]: value
    }))
  }

  const moverVaga = async ({ vaga, statusAprovacao, status, sucesso, exigeComentario = false }) => {
    const comentario = comentarios[vaga.id] || ''

    if (exigeComentario && !comentario.trim()) {
      toast.warning('Inclua um comentario para devolver a vaga ao departamento.')
      return
    }

    try {
      setUpdatingId(vaga.id)
      await atualizarFluxoAprovacaoVaga({
        vagaId: vaga.id,
        statusAprovacao,
        status,
        comentario,
        setor: setorAtual?.nome || '',
        usuario: empresa.nomeEmpresa || empresa.nome || ''
      })

      setVagas((current) => current.map((item) => (
        item.id === vaga.id
          ? {
            ...item,
            statusAprovacao,
            status: status || item.status,
            comentarioAuditoria: comentario.trim() || item.comentarioAuditoria
          }
          : item
      )))
      atualizarComentario(vaga.id, '')
      toast.success(sucesso)
    } catch {
      toast.error('Nao foi possivel atualizar o fluxo da vaga.')
    } finally {
      setUpdatingId('')
    }
  }

  const tentarNovamente = () => {
    setLoading(true)
    setError('')
    listarVagasPorEmpresa(empresaUid)
      .then(setVagas)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const podeAuditar = setorId === SETOR_REITORIA_AUDITORIA
  const podePublicar = setorId === SETOR_RH
  const podeReenviar = setorId === SETOR_CHEFE_DEPARTAMENTO

  return (
    <section className="empresa-flow">
      <header className="empresa-flow-header">
        <span>Modo empresarial</span>
        <h1>Fluxo de aprovacao de vagas</h1>
        <p>Pedidos criados pelo departamento passam por auditoria financeira antes de serem publicados pelo RH.</p>
      </header>

      {loading && (
        <div className="empresa-flow-grid">
          <CardEsqueleto count={4} />
        </div>
      )}

      {!loading && error && (
        <EstadoDados
          actionLabel="Tentar novamente"
          description={error}
          onAction={tentarNovamente}
          title="Nao foi possivel carregar as solicitacoes"
          tone="error"
        />
      )}

      {!loading && !error && !vagasFluxo.length && (
        <EstadoDados
          title="Nenhuma solicitacao empresarial"
          description="Quando um Chefe de departamento pedir uma vaga, ela aparecera aqui."
        />
      )}

      {!loading && !error && vagasFluxo.length > 0 && (
        <div className="empresa-flow-grid">
          {vagasFluxo.map((vaga) => {
            const statusAprovacao = getStatusAprovacao(vaga)
            const isUpdating = updatingId === vaga.id

            return (
              <article className={`empresa-flow-card status-${statusAprovacao}`} key={vaga.id}>
                <header>
                  <span>{statusAprovacaoVagaLabels[statusAprovacao] || statusAprovacao}</span>
                  <h2>{vaga.titulo}</h2>
                  <p>{vaga.area || 'Area nao informada'} - {vaga.localizacao || 'Local nao informado'}</p>
                </header>

                <dl>
                  <div>
                    <dt>Salario</dt>
                    <dd>{vaga.salario || 'A combinar'}</dd>
                  </div>
                  <div>
                    <dt>Premiacao</dt>
                    <dd>{vaga.recompensa || 'Nao informada'}</dd>
                  </div>
                  <div>
                    <dt>Prazo</dt>
                    <dd>{formatDate(vaga.dataLimite || vaga.expiraEm)}</dd>
                  </div>
                </dl>

                {vaga.comentarioAuditoria && (
                  <div className="empresa-flow-comment">
                    <FaCommentDots />
                    <p>{vaga.comentarioAuditoria}</p>
                  </div>
                )}

                {podeAuditar && statusAprovacao === 'solicitada' && (
                  <div className="empresa-flow-actions">
                    <textarea
                      placeholder="Comentarios ou ressalvas da auditoria"
                      value={comentarios[vaga.id] || ''}
                      onChange={(event) => atualizarComentario(vaga.id, event.target.value)}
                    />
                    <div>
                      <button
                        type="button"
                        className="flow-approve"
                        disabled={isUpdating}
                        onClick={() => moverVaga({
                          vaga,
                          statusAprovacao: 'aprovada',
                          status: 'pausada',
                          sucesso: 'Vaga aprovada e enviada ao Setor RH.'
                        })}
                      >
                        <FaCheckCircle /> Aprovar
                      </button>
                      <button
                        type="button"
                        className="flow-return"
                        disabled={isUpdating}
                        onClick={() => moverVaga({
                          vaga,
                          statusAprovacao: 'devolvida',
                          status: 'pausada',
                          sucesso: 'Vaga devolvida ao Chefe de departamento.',
                          exigeComentario: true
                        })}
                      >
                        <FaTimesCircle /> Devolver
                      </button>
                    </div>
                  </div>
                )}

                {podePublicar && statusAprovacao === 'aprovada' && (
                  <div className="empresa-flow-actions compact">
                    <button
                      type="button"
                      className="flow-publish"
                      disabled={isUpdating}
                      onClick={() => moverVaga({
                        vaga,
                        statusAprovacao: 'publicada',
                        status: 'aberta',
                        sucesso: 'Vaga publicada para indicadores.'
                      })}
                    >
                      <FaRocket /> Publicar vaga
                    </button>
                  </div>
                )}

                {podeReenviar && statusAprovacao === 'devolvida' && (
                  <div className="empresa-flow-actions compact">
                    <Link to={`/editar-vaga/empresa/${vaga.id}`}>Editar pedido</Link>
                    <button
                      type="button"
                      className="flow-approve"
                      disabled={isUpdating}
                      onClick={() => moverVaga({
                        vaga,
                        statusAprovacao: 'solicitada',
                        status: 'pausada',
                        sucesso: 'Pedido reenviado para Reitoria ou Auditoria.'
                      })}
                    >
                      <FaRedo /> Reenviar
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function EmpresaSetoresEmpresariais({ empresa, onUserUpdate }) {
  const toast = useToast()
  const empresaUid = getFirebaseUid(empresa)
  const setorAtual = obterSetorAtual(empresa)
  const [senhas, setSenhas] = useState(() => setoresEmpresariais.reduce((mapa, setor) => ({
    ...mapa,
    [setor.id]: ''
  }), {}))
  const [loading, setLoading] = useState(false)

  if (setorAtual?.id !== SETOR_ADMIN_EMPRESA) {
    return (
      <EstadoDados
        title="Acesso restrito"
        description="Somente o Administrador Empresa pode redefinir senhas dos setores."
      />
    )
  }

  const handleChange = (setorId, value) => {
    setSenhas((current) => ({
      ...current,
      [setorId]: value
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      setLoading(true)
      const setoresAtuais = empresa.setoresEmpresariais || {}
      const entradas = await Promise.all(setoresEmpresariais.map(async (setor) => {
        const senha = senhas[setor.id]?.trim()
        const senhaHashAtual = setoresAtuais[setor.id]?.senhaHash || ''

        return [
          setor.id,
          {
            id: setor.id,
            nome: setor.nome,
            resumo: setor.resumo,
            senhaHash: senha ? await hashSenhaSetor(senha, empresaUid) : senhaHashAtual,
            senhaDefinida: Boolean(senha || senhaHashAtual)
          }
        ]
      }))
      const setoresEmpresariaisAtualizados = Object.fromEntries(entradas)

      await atualizarSetoresEmpresariais({
        uid: empresaUid,
        setoresEmpresariais: setoresEmpresariaisAtualizados
      })

      const empresaAtualizada = {
        ...empresa,
        setoresEmpresariais: setoresEmpresariaisAtualizados
      }

      localStorage.setItem('empresaUser', JSON.stringify(empresaAtualizada))
      onUserUpdate?.(empresaAtualizada)
      setSenhas(setoresEmpresariais.reduce((mapa, setor) => ({
        ...mapa,
        [setor.id]: ''
      }), {}))
      toast.success('Senhas dos setores atualizadas.')
    } catch {
      toast.error('Nao foi possivel atualizar as senhas dos setores.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="empresa-setores">
      <header className="empresa-flow-header">
        <span>Administrador Empresa</span>
        <h1>Setores e acessos</h1>
        <p>Redefina as senhas usadas apos o login principal da empresa.</p>
      </header>

      <form className="empresa-setores-grid" onSubmit={handleSubmit}>
        {setoresEmpresariais.map((setor) => {
          const senhaDefinida = empresa.setoresEmpresariais?.[setor.id]?.senhaDefinida

          return (
            <article className="empresa-setor-card" key={setor.id}>
              <FaUsersCog />
              <div>
                <h2>{setor.nome}</h2>
                <p>{setor.resumo}</p>
                <span>{senhaDefinida ? 'Senha definida' : 'Senha pendente'}</span>
              </div>

              <label>
                <FaLock />
                <input
                  type="password"
                  placeholder="Nova senha do setor"
                  value={senhas[setor.id]}
                  onChange={(event) => handleChange(setor.id, event.target.value)}
                />
              </label>
            </article>
          )
        })}

        <button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar senhas dos setores'}
        </button>
      </form>
    </section>
  )
}
