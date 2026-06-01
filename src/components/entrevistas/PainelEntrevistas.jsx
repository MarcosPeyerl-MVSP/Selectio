import './PainelEntrevistas.css'

import { useEffect, useMemo, useState } from 'react'
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaExternalLinkAlt,
  FaFilter,
  FaPlus,
  FaTimes,
  FaUserFriends,
  FaVideo
} from 'react-icons/fa'

import PageLoader from '../ui/PageLoader'
import SkeletonCard from '../ui/SkeletonCard'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'
import {
  atualizarEntrevista,
  atualizarStatusEntrevista,
  cancelarEntrevista,
  criarEntrevista,
  listarEntrevistasPorEmpresa
} from '../../services/firestoreEntrevistas'
import {
  atualizarStatusCandidato,
  listarCandidatosPorEmpresa
} from '../../services/firestoreCandidatos'
import { getFirebaseUid } from '../../services/firebaseIdentity'
import {
  montarDescricaoEntrevista,
  montarTituloMeet,
  montarUrlGoogleCalendarMeet,
  somarMinutosAoHorario
} from '../../utils/linksGoogleMeet'

const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const statusQueBloqueiamAgendamento = ['agendada', 'pendente']
const statusAgendaveis = ['entrevista', 'indicado']
const prioridadeStatus = {
  entrevista: 0,
  indicado: 1
}

const rotulosStatus = {
  todos: 'Todos',
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  pendente: 'Pendente'
}

const opcoesStatus = ['todos', 'agendada', 'pendente', 'realizada', 'cancelada']

const formatarChaveData = (data) => {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')

  return `${ano}-${mes}-${dia}`
}

const formatarData = (valor) => {
  if (!valor) return 'Data não informada'

  const data = new Date(`${valor}T12:00:00`)
  if (Number.isNaN(data.getTime())) return valor

  return data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  })
}

const formatarMes = (data) => data.toLocaleDateString('pt-BR', {
  month: 'long',
  year: 'numeric'
})

const ordenarPorAgenda = (primeiraEntrevista, segundaEntrevista) => {
  const dataA = new Date(`${primeiraEntrevista.data || '2100-01-01'}T${primeiraEntrevista.horaInicio || '23:59'}:00`).getTime()
  const dataB = new Date(`${segundaEntrevista.data || '2100-01-01'}T${segundaEntrevista.horaInicio || '23:59'}:00`).getTime()

  return dataA - dataB
}

const normalizarStatusCandidato = (candidato) => {
  if (candidato?.status === 'recusado') return 'cancelado'
  return candidato?.status || 'indicado'
}

const obterNomeCandidato = (candidato) => candidato?.nome || candidato?.candidatoNome || 'Candidato'

const obterNomeEmpresa = (candidato, empresa) => (
  empresa?.nomeEmpresa || candidato?.empresaNome || candidato?.vagaEmpresa || 'Empresa Selectio'
)

const ordenarCandidatosAgendaveis = (primeiroCandidato, segundoCandidato) => {
  const prioridadeA = prioridadeStatus[normalizarStatusCandidato(primeiroCandidato)] ?? 9
  const prioridadeB = prioridadeStatus[normalizarStatusCandidato(segundoCandidato)] ?? 9

  if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB

  const dataA = new Date(primeiroCandidato.aplicadoEm || primeiroCandidato.criadoEm || 0).getTime()
  const dataB = new Date(segundoCandidato.aplicadoEm || segundoCandidato.criadoEm || 0).getTime()

  return dataB - dataA
}

function PainelEntrevistas({ empresa }) {
  const empresaId = getFirebaseUid(empresa)
  const toast = useToast()
  const confirm = useConfirm()

  const hoje = useMemo(() => formatarChaveData(new Date()), [])
  const [mesAtual, setMesAtual] = useState(() => new Date())
  const [dataSelecionada, setDataSelecionada] = useState(hoje)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroVaga, setFiltroVaga] = useState('todos')
  const [entrevistas, setEntrevistas] = useState([])
  const [candidatos, setCandidatos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(null)
  const [candidatoEmAgendamento, setCandidatoEmAgendamento] = useState(null)
  const [formularioAgendamento, setFormularioAgendamento] = useState({
    data: hoje,
    horaInicio: '09:00',
    duracaoMinutos: '45',
    observacoes: ''
  })

  useEffect(() => {
    let ativo = true

    const carregarDados = async () => {
      setCarregando(true)

      if (!empresaId) {
        setEntrevistas([])
        setCandidatos([])
        setCarregando(false)
        return
      }

      try {
        const [entrevistasDaEmpresa, candidatosDaEmpresa] = await Promise.all([
          listarEntrevistasPorEmpresa(empresaId),
          listarCandidatosPorEmpresa(empresaId)
        ])

        if (!ativo) return

        setEntrevistas(entrevistasDaEmpresa)
        setCandidatos(candidatosDaEmpresa)
      } catch (error) {
        if (!ativo) return

        toast.error(error.message || 'Não foi possível carregar entrevistas.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarDados()

    return () => {
      ativo = false
    }
  }, [empresaId, toast])

  const entrevistasPorData = useMemo(() => entrevistas.reduce((acumulador, entrevista) => {
    if (!entrevista.data) return acumulador

    acumulador[entrevista.data] = (acumulador[entrevista.data] || 0) + 1
    return acumulador
  }, {}), [entrevistas])

  const diasDoMes = useMemo(() => {
    const primeiraData = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1)
    const totalDias = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0).getDate()
    const espacos = Array.from({ length: primeiraData.getDay() }, (_, index) => ({
      chave: `espaco-${index}`,
      vazio: true
    }))
    const dias = Array.from({ length: totalDias }, (_, index) => {
      const dia = index + 1
      const data = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), dia)
      const chave = formatarChaveData(data)

      return {
        chave,
        data: chave,
        dia
      }
    })

    return [...espacos, ...dias]
  }, [mesAtual])

  const opcoesVaga = useMemo(() => {
    const opcoes = new Map()

    candidatos.forEach((candidato) => {
      if (candidato.vagaId && candidato.vagaTitulo) opcoes.set(candidato.vagaId, candidato.vagaTitulo)
    })

    entrevistas.forEach((entrevista) => {
      if (entrevista.vagaId && entrevista.vagaTitulo) opcoes.set(entrevista.vagaId, entrevista.vagaTitulo)
    })

    return Array.from(opcoes, ([id, titulo]) => ({ id, titulo }))
  }, [candidatos, entrevistas])

  const entrevistasDoDiaSelecionado = useMemo(() => (
    entrevistas
      .filter((entrevista) => entrevista.data === dataSelecionada)
      .filter((entrevista) => filtroStatus === 'todos' || entrevista.status === filtroStatus)
      .filter((entrevista) => filtroVaga === 'todos' || entrevista.vagaId === filtroVaga)
      .sort(ordenarPorAgenda)
  ), [dataSelecionada, entrevistas, filtroStatus, filtroVaga])

  const candidatosComEntrevistaAtiva = useMemo(() => new Set(
    entrevistas
      .filter((entrevista) => statusQueBloqueiamAgendamento.includes(entrevista.status || 'agendada'))
      .map((entrevista) => entrevista.candidatoId)
  ), [entrevistas])

  const candidatosParaAgendar = useMemo(() => (
    candidatos
      .filter((candidato) => !candidatosComEntrevistaAtiva.has(candidato.id))
      .filter((candidato) => statusAgendaveis.includes(normalizarStatusCandidato(candidato)))
      .sort(ordenarCandidatosAgendaveis)
      .slice(0, 12)
  ), [candidatos, candidatosComEntrevistaAtiva])

  const metricas = useMemo(() => ({
    hoje: entrevistas.filter((entrevista) => entrevista.data === hoje && entrevista.status !== 'cancelada').length,
    agendadas: entrevistas.filter((entrevista) => entrevista.status === 'agendada').length,
    realizadas: entrevistas.filter((entrevista) => entrevista.status === 'realizada').length,
    aguardando: candidatosParaAgendar.length
  }), [candidatosParaAgendar.length, entrevistas, hoje])

  const tituloPreview = candidatoEmAgendamento
    ? montarTituloMeet(candidatoEmAgendamento.vagaTitulo, obterNomeCandidato(candidatoEmAgendamento))
    : ''

  const mudarMes = (offset) => {
    setMesAtual((dataAtual) => new Date(dataAtual.getFullYear(), dataAtual.getMonth() + offset, 1))
  }

  const abrirAgendamento = (candidato) => {
    setCandidatoEmAgendamento(candidato)
    setFormularioAgendamento({
      data: dataSelecionada || hoje,
      horaInicio: '09:00',
      duracaoMinutos: '45',
      observacoes: ''
    })
  }

  const atualizarFormulario = (campo, valor) => {
    setFormularioAgendamento((formularioAtual) => ({
      ...formularioAtual,
      [campo]: valor
    }))
  }

  const montarCalendarDoCandidato = (candidato) => {
    const horaFim = somarMinutosAoHorario(
      formularioAgendamento.data,
      formularioAgendamento.horaInicio,
      formularioAgendamento.duracaoMinutos
    )
    const titulo = montarTituloMeet(candidato.vagaTitulo, obterNomeCandidato(candidato))
    const descricao = montarDescricaoEntrevista({
      candidatoNome: obterNomeCandidato(candidato),
      candidatoEmail: candidato.email,
      vagaTitulo: candidato.vagaTitulo,
      empresaNome: obterNomeEmpresa(candidato, empresa),
      indicadorNome: candidato.indicadorNome,
      observacoes: formularioAgendamento.observacoes
    })

    return {
      titulo,
      horaFim,
      descricao,
      url: montarUrlGoogleCalendarMeet({
        titulo,
        data: formularioAgendamento.data,
        horaInicio: formularioAgendamento.horaInicio,
        horaFim,
        duracaoMinutos: formularioAgendamento.duracaoMinutos,
        descricao
      })
    }
  }

  const salvarEntrevista = async (event) => {
    event.preventDefault()

    if (!candidatoEmAgendamento || !empresaId) return

    setAcaoEmAndamento(`criar-${candidatoEmAgendamento.id}`)

    try {
      const calendario = montarCalendarDoCandidato(candidatoEmAgendamento)
      const entrevista = await criarEntrevista({
        candidatoId: candidatoEmAgendamento.id,
        candidatoNome: obterNomeCandidato(candidatoEmAgendamento),
        candidatoEmail: candidatoEmAgendamento.email || '',
        vagaId: candidatoEmAgendamento.vagaId || '',
        vagaTitulo: candidatoEmAgendamento.vagaTitulo || '',
        empresaId,
        empresaNome: obterNomeEmpresa(candidatoEmAgendamento, empresa),
        indicadorId: candidatoEmAgendamento.indicadorId || candidatoEmAgendamento.indicadorUid || '',
        indicadorNome: candidatoEmAgendamento.indicadorNome || '',
        data: formularioAgendamento.data,
        horaInicio: formularioAgendamento.horaInicio,
        horaFim: calendario.horaFim,
        duracaoMinutos: Number(formularioAgendamento.duracaoMinutos || 45),
        status: 'agendada',
        meetTitulo: calendario.titulo,
        meetUrl: calendario.url,
        calendarUrl: calendario.url,
        observacoes: formularioAgendamento.observacoes
      })

      if (normalizarStatusCandidato(candidatoEmAgendamento) !== 'entrevista') {
        await atualizarStatusCandidato({
          candidatoId: candidatoEmAgendamento.id,
          status: 'entrevista',
          empresaId
        })
      }

      setEntrevistas((entrevistasAtuais) => [...entrevistasAtuais, entrevista].sort(ordenarPorAgenda))
      setCandidatos((candidatosAtuais) => candidatosAtuais.map((candidato) => (
        candidato.id === candidatoEmAgendamento.id ? { ...candidato, status: 'entrevista' } : candidato
      )))
      setCandidatoEmAgendamento(null)
      toast.success('Entrevista agendada com sucesso.')
    } catch (error) {
      toast.error(error.message || 'Não foi possível agendar a entrevista.')
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  const abrirPreviewCalendar = () => {
    if (!candidatoEmAgendamento) return

    const calendario = montarCalendarDoCandidato(candidatoEmAgendamento)
    window.open(calendario.url, '_blank', 'noopener,noreferrer')
  }

  const montarCalendarDaEntrevista = (entrevista) => {
    const titulo = entrevista.meetTitulo || montarTituloMeet(entrevista.vagaTitulo, entrevista.candidatoNome)
    const descricao = montarDescricaoEntrevista({
      candidatoNome: entrevista.candidatoNome,
      candidatoEmail: entrevista.candidatoEmail,
      vagaTitulo: entrevista.vagaTitulo,
      empresaNome: entrevista.empresaNome,
      indicadorNome: entrevista.indicadorNome,
      observacoes: entrevista.observacoes
    })

    return {
      titulo,
      url: montarUrlGoogleCalendarMeet({
        titulo,
        data: entrevista.data,
        horaInicio: entrevista.horaInicio,
        horaFim: entrevista.horaFim,
        duracaoMinutos: entrevista.duracaoMinutos,
        descricao
      })
    }
  }

  const abrirEntrevista = async (entrevista) => {
    const urlExistente = entrevista.meetUrl || entrevista.calendarUrl

    if (urlExistente) {
      window.open(urlExistente, '_blank', 'noopener,noreferrer')
      return
    }

    setAcaoEmAndamento(`abrir-${entrevista.id}`)

    try {
      const calendario = montarCalendarDaEntrevista(entrevista)

      await atualizarEntrevista(entrevista.id, {
        meetTitulo: calendario.titulo,
        meetUrl: calendario.url,
        calendarUrl: calendario.url
      })

      setEntrevistas((entrevistasAtuais) => entrevistasAtuais.map((item) => (
        item.id === entrevista.id
          ? { ...item, meetTitulo: calendario.titulo, meetUrl: calendario.url, calendarUrl: calendario.url }
          : item
      )))
      window.open(calendario.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(error.message || 'Não foi possível abrir o Google Calendar.')
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  const atualizarStatusDaEntrevista = async (entrevista, status) => {
    setAcaoEmAndamento(`${status}-${entrevista.id}`)

    try {
      await atualizarStatusEntrevista(entrevista.id, status)
      setEntrevistas((entrevistasAtuais) => entrevistasAtuais.map((item) => (
        item.id === entrevista.id ? { ...item, status, atualizadoEm: new Date().toISOString() } : item
      )))
      toast.success('Status da entrevista atualizado.')
    } catch (error) {
      toast.error(error.message || 'Não foi possível atualizar a entrevista.')
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  const cancelarEntrevistaAgendada = async (entrevista) => {
    const confirmado = await confirm({
      title: 'Cancelar entrevista',
      description: `Deseja cancelar a entrevista com ${entrevista.candidatoNome || 'este candidato'}?`,
      confirmLabel: 'Cancelar entrevista',
      cancelLabel: 'Voltar'
    })

    if (!confirmado) return

    setAcaoEmAndamento(`cancelar-${entrevista.id}`)

    try {
      await cancelarEntrevista(entrevista.id)
      setEntrevistas((entrevistasAtuais) => entrevistasAtuais.map((item) => (
        item.id === entrevista.id ? { ...item, status: 'cancelada', atualizadoEm: new Date().toISOString() } : item
      )))
      toast.success('Entrevista cancelada.')
    } catch (error) {
      toast.error(error.message || 'Não foi possível cancelar a entrevista.')
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  if (carregando) {
    return (
      <section className="painel-entrevistas">
        <PageLoader label="Carregando entrevistas..." compact />
        <div className="entrevistas-carregando-grid">
          <SkeletonCard count={3} lines={3} />
        </div>
      </section>
    )
  }

  return (
    <section className="painel-entrevistas">
      <header className="entrevistas-cabecalho">
        <div>
          <span>Agenda inteligente</span>
          <h1>Painel de Entrevistas</h1>
          <p>Agende conversas com candidatos das suas vagas e acompanhe o dia pelo calendário.</p>
        </div>

        <button
          type="button"
          className="entrevistas-acao-principal"
          onClick={() => candidatosParaAgendar[0] && abrirAgendamento(candidatosParaAgendar[0])}
          disabled={!candidatosParaAgendar.length}
        >
          <FaPlus /> Agendar entrevista
        </button>
      </header>

      <section className="entrevistas-metricas" aria-label="Resumo de entrevistas">
        <CartaoMetrica label="Hoje" value={metricas.hoje} />
        <CartaoMetrica label="Agendadas" value={metricas.agendadas} />
        <CartaoMetrica label="Realizadas" value={metricas.realizadas} />
        <CartaoMetrica label="Prontos para agenda" value={metricas.aguardando} />
      </section>

      <section className="entrevistas-filtros" aria-label="Filtros de entrevistas">
        <label>
          <FaFilter />
          <select value={filtroStatus} onChange={(event) => setFiltroStatus(event.target.value)}>
            {opcoesStatus.map((status) => (
              <option value={status} key={status}>{rotulosStatus[status]}</option>
            ))}
          </select>
        </label>

        <label>
          <FaCalendarAlt />
          <select value={filtroVaga} onChange={(event) => setFiltroVaga(event.target.value)}>
            <option value="todos">Todas as vagas</option>
            {opcoesVaga.map((vaga) => (
              <option value={vaga.id} key={vaga.id}>{vaga.titulo}</option>
            ))}
          </select>
        </label>
      </section>

      <div className="entrevistas-grade-principal">
        <article className="entrevistas-calendario-card">
          <div className="entrevistas-calendario-cabecalho">
            <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
              <FaChevronLeft />
            </button>
            <strong>{formatarMes(mesAtual)}</strong>
            <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mes">
              <FaChevronRight />
            </button>
          </div>

          <div className="entrevistas-dias-semana">
            {diasDaSemana.map((label) => <span key={label}>{label}</span>)}
          </div>

          <div className="entrevistas-calendario-grid">
            {diasDoMes.map((dia) => (
              dia.vazio ? (
                <span className="entrevistas-calendario-dia vazio" key={dia.chave} />
              ) : (
                <button
                  type="button"
                  key={dia.chave}
                  className={[
                    'entrevistas-calendario-dia',
                    dia.data === hoje ? 'hoje' : '',
                    dia.data === dataSelecionada ? 'selecionado' : '',
                    entrevistasPorData[dia.data] ? 'com-entrevistas' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => setDataSelecionada(dia.data)}
                >
                  <strong>{dia.dia}</strong>
                  {entrevistasPorData[dia.data] ? <span>{entrevistasPorData[dia.data]}</span> : null}
                </button>
              )
            ))}
          </div>
        </article>

        <article className="entrevistas-agenda-card">
          <div className="entrevistas-titulo-secao">
            <span><FaClock /> Agenda do dia</span>
            <strong>{formatarData(dataSelecionada)}</strong>
          </div>

          {entrevistasDoDiaSelecionado.length ? (
            <div className="entrevistas-agenda-lista">
              {entrevistasDoDiaSelecionado.map((entrevista) => (
                <CartaoEntrevista
                  key={entrevista.id}
                  entrevista={entrevista}
                  carregando={Boolean(acaoEmAndamento?.endsWith(entrevista.id))}
                  onAbrir={() => abrirEntrevista(entrevista)}
                  onRealizada={() => atualizarStatusDaEntrevista(entrevista, 'realizada')}
                  onCancelar={() => cancelarEntrevistaAgendada(entrevista)}
                />
              ))}
            </div>
          ) : (
            <EstadoVazio
              title="Nenhuma entrevista neste dia"
            description="Escolha outro dia no calendário ou agende uma nova conversa com um candidato."
            />
          )}
        </article>
      </div>

      <article className="entrevistas-aguardando-card">
        <div className="entrevistas-titulo-secao">
          <span><FaUserFriends /> Prontos para agendamento</span>
          <strong>{candidatosParaAgendar.length}</strong>
        </div>

        {candidatosParaAgendar.length ? (
          <div className="entrevistas-aguardando-lista">
            {candidatosParaAgendar.map((candidato) => (
              <div className="entrevistas-aguardando-item" key={candidato.id}>
                <div>
                  <strong>{obterNomeCandidato(candidato)}</strong>
                  <span>{candidato.vagaTitulo || 'Vaga não informada'}</span>
                  <small>{normalizarStatusCandidato(candidato) === 'entrevista' ? 'Status: entrevista' : 'Status: indicado'}</small>
                </div>

                <button type="button" onClick={() => abrirAgendamento(candidato)}>
                  <FaCalendarAlt /> Agendar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EstadoVazio
            title="Sem candidatos prontos para agendar"
            description="Candidatos com status entrevista aparecem aqui quando ainda não possuem entrevista agendada ou pendente."
          />
        )}
      </article>

      {candidatoEmAgendamento && (
        <ModalAgendamento
          carregando={acaoEmAndamento === `criar-${candidatoEmAgendamento.id}`}
          candidato={candidatoEmAgendamento}
          formulario={formularioAgendamento}
          tituloPreview={tituloPreview}
          onChange={atualizarFormulario}
          onClose={() => setCandidatoEmAgendamento(null)}
          onAbrirPreview={abrirPreviewCalendar}
          onSubmit={salvarEntrevista}
        />
      )}
    </section>
  )
}

function CartaoMetrica({ label, value }) {
  return (
    <div className="entrevistas-metrica-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EstadoVazio({ title, description }) {
  return (
    <div className="entrevistas-estado-vazio">
      <FaCalendarAlt />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function CartaoEntrevista({ entrevista, carregando, onAbrir, onRealizada, onCancelar }) {
  const status = entrevista.status || 'agendada'
  const desabilitado = carregando || status === 'cancelada'

  return (
    <section className={`entrevistas-card ${status}`}>
      <div className="entrevistas-card-horario">
        <strong>{entrevista.horaInicio || '--:--'}</strong>
        <span>{entrevista.horaFim || '--:--'}</span>
      </div>

      <div className="entrevistas-card-conteudo">
        <strong>{entrevista.candidatoNome || 'Candidato sem nome'}</strong>
        <p>{entrevista.vagaTitulo || 'Vaga não informada'}</p>
        <span>{rotulosStatus[status] || status}</span>
      </div>

      <div className="entrevistas-card-acoes">
        <button type="button" onClick={onAbrir} disabled={carregando}>
          <FaExternalLinkAlt /> Abrir no Google Calendar
        </button>

        {status !== 'realizada' && status !== 'cancelada' && (
          <button type="button" className="secundario" onClick={onRealizada} disabled={desabilitado}>
            Realizada
          </button>
        )}

        {status !== 'cancelada' && (
          <button type="button" className="perigo" onClick={onCancelar} disabled={carregando}>
            Cancelar
          </button>
        )}
      </div>
    </section>
  )
}

function ModalAgendamento({
  carregando,
  candidato,
  formulario,
  tituloPreview,
  onChange,
  onClose,
  onAbrirPreview,
  onSubmit
}) {
  return (
    <div className="entrevistas-modal-fundo" role="presentation" onMouseDown={onClose}>
      <section
        className="entrevistas-modal-agendamento"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entrevistas-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="entrevistas-modal-fechar" onClick={onClose} aria-label="Fechar agendamento">
          <FaTimes />
        </button>

        <header>
          <span><FaVideo /> Nova entrevista</span>
          <h2 id="entrevistas-modal-title">Agendar conversa</h2>
          <p>O Google Calendar será aberto com os dados preenchidos. O Meet pode ser criado ao salvar o evento.</p>
        </header>

        <form onSubmit={onSubmit}>
          <div className="entrevistas-candidato-resumo">
            <strong>{obterNomeCandidato(candidato)}</strong>
            <span>{candidato.vagaTitulo || 'Vaga não informada'}</span>
          </div>

          <div className="entrevistas-formulario-grid">
            <label>
              Data
              <input
                type="date"
                value={formulario.data}
                onChange={(event) => onChange('data', event.target.value)}
                required
              />
            </label>

            <label>
              Início
              <input
                type="time"
                value={formulario.horaInicio}
                onChange={(event) => onChange('horaInicio', event.target.value)}
                required
              />
            </label>

            <label>
              Duração
              <select
                value={formulario.duracaoMinutos}
                onChange={(event) => onChange('duracaoMinutos', event.target.value)}
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </label>
          </div>

          <label className="entrevistas-campo-inteiro">
            Observações
            <textarea
              value={formulario.observacoes}
              onChange={(event) => onChange('observacoes', event.target.value)}
              placeholder="Pontos para abordar, contexto da vaga ou combinados..."
              rows="4"
            />
          </label>

          <div className="entrevistas-titulo-preview">
            <span>Título no Google Calendar</span>
            <strong>{tituloPreview}</strong>
          </div>

          <div className="entrevistas-modal-acoes">
            <button type="button" className="secundario" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="calendario" onClick={onAbrirPreview}>
              <FaExternalLinkAlt /> Abrir preview
            </button>
            <button type="submit" disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar entrevista'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default PainelEntrevistas
