import './PainelEntrevistas.css'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import CardEsqueleto from '../ui/CardEsqueleto'
import EstadoDados from '../ui/EstadoDados'
import { useConfirmacao } from '../../hooks/useConfirmacao'
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
import { getFirebaseUid } from '../../services/identidadeFirebase'
import {
  montarDescricaoEntrevista,
  montarTituloMeet,
  montarUrlGoogleCalendarMeet,
  somarMinutosAoHorario
} from '../../utils/linksGoogleMeet'

const statusQueBloqueiamAgendamento = ['agendada', 'pendente']
const statusAgendaveis = ['entrevista', 'indicado']
const prioridadeStatus = {
  entrevista: 0,
  indicado: 1
}

const opcoesStatus = ['todos', 'agendada', 'pendente', 'realizada', 'cancelada']

const formatarChaveData = (data) => {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')

  return `${ano}-${mes}-${dia}`
}

const formatarData = (valor, locale, fallback) => {
  if (!valor) return fallback

  const data = new Date(`${valor}T12:00:00`)
  if (Number.isNaN(data.getTime())) return valor

  return data.toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  })
}

const formatarMes = (data, locale) => data.toLocaleDateString(locale, {
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

const obterNomeCandidato = (candidato, fallback = 'Candidato') => candidato?.nome || candidato?.candidatoNome || fallback

const obterNomeEmpresa = (candidato, empresa, fallback = 'Empresa Selectio') => (
  empresa?.nomeEmpresa || candidato?.empresaNome || candidato?.vagaEmpresa || fallback
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
  const { t, i18n } = useTranslation('common')
  const empresaId = getFirebaseUid(empresa)
  const toast = useToast()
  const confirm = useConfirmacao()
  const locale = i18n.resolvedLanguage || i18n.language
  const diasDaSemana = useMemo(() => Array.from({ length: 7 }, (_, index) => (
    new Intl.DateTimeFormat(locale, { weekday: 'short' })
      .format(new Date(2024, 0, 7 + index))
      .replace('.', '')
  )), [locale])
  const calendarLabels = {
    defaultTitle: t('interviews.calendar.defaultTitle'),
    candidate: t('interviews.calendar.candidate'),
    candidateLine: (value) => t('interviews.calendar.candidateLine', { value }),
    emailLine: (value) => t('interviews.calendar.emailLine', { value }),
    jobLine: (value) => t('interviews.calendar.jobLine', { value }),
    companyLine: (value) => t('interviews.calendar.companyLine', { value }),
    referrerLine: (value) => t('interviews.calendar.referrerLine', { value }),
    notesLine: (value) => t('interviews.calendar.notesLine', { value }),
    notProvided: t('interviews.calendar.notProvided'),
    notProvidedFemale: t('interviews.calendar.notProvidedFemale'),
    generated: t('interviews.calendar.generated'),
    fallbackDescription: t('interviews.calendar.fallbackDescription')
  }

  const hoje = useMemo(() => formatarChaveData(new Date()), [])
  const [mesAtual, setMesAtual] = useState(() => new Date())
  const [dataSelecionada, setDataSelecionada] = useState(hoje)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroVaga, setFiltroVaga] = useState('todos')
  const [entrevistas, setEntrevistas] = useState([])
  const [candidatos, setCandidatos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
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
        setErroCarregamento('')
        const [entrevistasDaEmpresa, candidatosDaEmpresa] = await Promise.all([
          listarEntrevistasPorEmpresa(empresaId),
          listarCandidatosPorEmpresa(empresaId)
        ])

        if (!ativo) return

        setEntrevistas(entrevistasDaEmpresa)
        setCandidatos(candidatosDaEmpresa)
      } catch {
        if (!ativo) return

        setErroCarregamento(t('interviews.loadError'))
        toast.error(t('interviews.loadError'))
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarDados()

    return () => {
      ativo = false
    }
  }, [empresaId, reloadKey, t, toast])

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
    ? montarTituloMeet(candidatoEmAgendamento.vagaTitulo, obterNomeCandidato(candidatoEmAgendamento, t('interviews.candidate')), calendarLabels)
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
    const titulo = montarTituloMeet(candidato.vagaTitulo, obterNomeCandidato(candidato, t('interviews.candidate')), calendarLabels)
    const descricao = montarDescricaoEntrevista({
      candidatoNome: obterNomeCandidato(candidato, t('interviews.candidate')),
      candidatoEmail: candidato.email,
      vagaTitulo: candidato.vagaTitulo,
      empresaNome: obterNomeEmpresa(candidato, empresa, t('interviews.company')),
      indicadorNome: candidato.indicadorNome,
      observacoes: formularioAgendamento.observacoes,
      labels: calendarLabels
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
        descricao,
        labels: calendarLabels
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
        candidatoNome: obterNomeCandidato(candidatoEmAgendamento, t('interviews.candidate')),
        candidatoEmail: candidatoEmAgendamento.email || '',
        vagaId: candidatoEmAgendamento.vagaId || '',
        vagaTitulo: candidatoEmAgendamento.vagaTitulo || '',
        empresaId,
        empresaNome: obterNomeEmpresa(candidatoEmAgendamento, empresa, t('interviews.company')),
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
      toast.success(t('interviews.scheduled'))
    } catch {
      toast.error(t('interviews.scheduleError'))
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
    const titulo = entrevista.meetTitulo || montarTituloMeet(entrevista.vagaTitulo, entrevista.candidatoNome, calendarLabels)
    const descricao = montarDescricaoEntrevista({
      candidatoNome: entrevista.candidatoNome,
      candidatoEmail: entrevista.candidatoEmail,
      vagaTitulo: entrevista.vagaTitulo,
      empresaNome: entrevista.empresaNome,
      indicadorNome: entrevista.indicadorNome,
      observacoes: entrevista.observacoes,
      labels: calendarLabels
    })

    return {
      titulo,
      url: montarUrlGoogleCalendarMeet({
        titulo,
        data: entrevista.data,
        horaInicio: entrevista.horaInicio,
        horaFim: entrevista.horaFim,
        duracaoMinutos: entrevista.duracaoMinutos,
        descricao,
        labels: calendarLabels
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
    } catch {
      toast.error(t('interviews.calendarError'))
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
      toast.success(t('interviews.statusUpdated'))
    } catch {
      toast.error(t('interviews.updateError'))
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  const cancelarEntrevistaAgendada = async (entrevista) => {
    const confirmado = await confirm({
      title: t('interviews.cancelTitle'),
      description: t('interviews.cancelDescription', { name: entrevista.candidatoNome || t('interviews.thisCandidate') }),
      confirmLabel: t('interviews.cancelInterview'),
      cancelLabel: t('interviews.back')
    })

    if (!confirmado) return

    setAcaoEmAndamento(`cancelar-${entrevista.id}`)

    try {
      await cancelarEntrevista(entrevista.id)
      setEntrevistas((entrevistasAtuais) => entrevistasAtuais.map((item) => (
        item.id === entrevista.id ? { ...item, status: 'cancelada', atualizadoEm: new Date().toISOString() } : item
      )))
      toast.success(t('interviews.cancelled'))
    } catch {
      toast.error(t('interviews.cancelError'))
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  if (carregando) {
    return (
      <section className="painel-entrevistas">
        <PageLoader label={t('interviews.loading')} compact />
        <div className="entrevistas-carregando-grid">
          <CardEsqueleto count={3} lines={3} />
        </div>
      </section>
    )
  }

  if (erroCarregamento) {
    return (
      <section className="painel-entrevistas">
        <EstadoDados
          actionLabel={t('interviews.retry')}
          description={erroCarregamento}
          onAction={() => {
            setCarregando(true)
            setReloadKey((value) => value + 1)
          }}
          title={navigator.onLine ? t('interviews.loadTitle') : t('interviews.offline')}
          tone={navigator.onLine ? 'error' : 'offline'}
        />
      </section>
    )
  }

  return (
    <section className="painel-entrevistas">
      <header className="entrevistas-cabecalho">
        <div>
          <span>{t('interviews.eyebrow')}</span>
          <h1>{t('interviews.title')}</h1>
          <p>{t('interviews.description')}</p>
        </div>

        <button
          type="button"
          className="entrevistas-acao-principal"
          onClick={() => candidatosParaAgendar[0] && abrirAgendamento(candidatosParaAgendar[0])}
          disabled={!candidatosParaAgendar.length}
        >
          <FaPlus /> {t('interviews.schedule')}
        </button>
      </header>

      <section className="entrevistas-metricas" aria-label={t('interviews.summary')}>
        <CartaoMetrica label={t('interviews.today')} value={metricas.hoje} />
        <CartaoMetrica label={t('interviews.scheduledMetric')} value={metricas.agendadas} />
        <CartaoMetrica label={t('interviews.completedMetric')} value={metricas.realizadas} />
        <CartaoMetrica label={t('interviews.readyMetric')} value={metricas.aguardando} />
      </section>

      <section className="entrevistas-filtros" aria-label={t('interviews.filters')}>
        <label>
          <FaFilter />
          <select value={filtroStatus} onChange={(event) => setFiltroStatus(event.target.value)}>
            {opcoesStatus.map((status) => (
              <option value={status} key={status}>{t(`statuses.interviews.${status}`, { defaultValue: status })}</option>
            ))}
          </select>
        </label>

        <label>
          <FaCalendarAlt />
          <select value={filtroVaga} onChange={(event) => setFiltroVaga(event.target.value)}>
            <option value="todos">{t('interviews.allJobs')}</option>
            {opcoesVaga.map((vaga) => (
              <option value={vaga.id} key={vaga.id}>{vaga.titulo}</option>
            ))}
          </select>
        </label>
      </section>

      <div className="entrevistas-grade-principal">
        <article className="entrevistas-calendario-card">
          <div className="entrevistas-calendario-cabecalho">
            <button type="button" onClick={() => mudarMes(-1)} aria-label={t('interviews.previousMonth')}>
              <FaChevronLeft />
            </button>
            <strong>{formatarMes(mesAtual, locale)}</strong>
            <button type="button" onClick={() => mudarMes(1)} aria-label={t('interviews.nextMonth')}>
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
            <span><FaClock /> {t('interviews.dayAgenda')}</span>
            <strong>{formatarData(dataSelecionada, locale, t('interviews.dateNotProvided'))}</strong>
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
              title={t('interviews.emptyDay')}
              description={t('interviews.emptyDayDescription')}
            />
          )}
        </article>
      </div>

      <article className="entrevistas-aguardando-card">
        <div className="entrevistas-titulo-secao">
          <span><FaUserFriends /> {t('interviews.readyTitle')}</span>
          <strong>{candidatosParaAgendar.length}</strong>
        </div>

        {candidatosParaAgendar.length ? (
          <div className="entrevistas-aguardando-lista">
            {candidatosParaAgendar.map((candidato) => (
              <div className="entrevistas-aguardando-item" key={candidato.id}>
                <div>
                  <strong>{obterNomeCandidato(candidato, t('interviews.candidate'))}</strong>
                  <span>{candidato.vagaTitulo || t('interviews.jobNotProvided')}</span>
                  <small>{t('interviews.candidateStatus', { status: t(`statuses.candidates.${normalizarStatusCandidato(candidato)}`) })}</small>
                </div>

                <button type="button" onClick={() => abrirAgendamento(candidato)}>
                  <FaCalendarAlt /> {t('interviews.scheduleAction')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EstadoVazio
            title={t('interviews.noReady')}
            description={t('interviews.noReadyDescription')}
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
  const { t } = useTranslation('common')
  const status = entrevista.status || 'agendada'
  const desabilitado = carregando || status === 'cancelada'

  return (
    <section className={`entrevistas-card ${status}`}>
      <div className="entrevistas-card-horario">
        <strong>{entrevista.horaInicio || '--:--'}</strong>
        <span>{entrevista.horaFim || '--:--'}</span>
      </div>

      <div className="entrevistas-card-conteudo">
        <strong>{entrevista.candidatoNome || t('interviews.unnamedCandidate')}</strong>
        <p>{entrevista.vagaTitulo || t('interviews.jobNotProvided')}</p>
        <span>{t(`statuses.interviews.${status}`, { defaultValue: status })}</span>
      </div>

      <div className="entrevistas-card-acoes">
        <button type="button" onClick={onAbrir} disabled={carregando}>
          <FaExternalLinkAlt /> {t('interviews.openCalendar')}
        </button>

        {status !== 'realizada' && status !== 'cancelada' && (
          <button type="button" className="secundario" onClick={onRealizada} disabled={desabilitado}>
            {t('interviews.completed')}
          </button>
        )}

        {status !== 'cancelada' && (
          <button type="button" className="perigo" onClick={onCancelar} disabled={carregando}>
            {t('interviews.cancel')}
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
  const { t } = useTranslation('common')

  return (
    <div className="entrevistas-modal-fundo" role="presentation" onMouseDown={onClose}>
      <section
        className="entrevistas-modal-agendamento"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entrevistas-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="entrevistas-modal-fechar" onClick={onClose} aria-label={t('interviews.close')}>
          <FaTimes />
        </button>

        <header>
          <span><FaVideo /> {t('interviews.newInterview')}</span>
          <h2 id="entrevistas-modal-title">{t('interviews.scheduleConversation')}</h2>
          <p>{t('interviews.modalDescription')}</p>
        </header>

        <form onSubmit={onSubmit}>
          <div className="entrevistas-candidato-resumo">
            <strong>{obterNomeCandidato(candidato, t('interviews.candidate'))}</strong>
            <span>{candidato.vagaTitulo || t('interviews.jobNotProvided')}</span>
          </div>

          <div className="entrevistas-formulario-grid">
            <label>
              {t('interviews.date')}
              <input
                type="date"
                value={formulario.data}
                onChange={(event) => onChange('data', event.target.value)}
                required
              />
            </label>

            <label>
              {t('interviews.start')}
              <input
                type="time"
                value={formulario.horaInicio}
                onChange={(event) => onChange('horaInicio', event.target.value)}
                required
              />
            </label>

            <label>
              {t('interviews.duration')}
              <select
                value={formulario.duracaoMinutos}
                onChange={(event) => onChange('duracaoMinutos', event.target.value)}
              >
                {[30, 45, 60, 90].map((minutes) => (
                  <option key={minutes} value={minutes}>{t('interviews.minutes', { count: minutes })}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="entrevistas-campo-inteiro">
            {t('interviews.notes')}
            <textarea
              value={formulario.observacoes}
              onChange={(event) => onChange('observacoes', event.target.value)}
              placeholder={t('interviews.notesPlaceholder')}
              rows="4"
            />
          </label>

          <div className="entrevistas-titulo-preview">
            <span>{t('interviews.calendarTitle')}</span>
            <strong>{tituloPreview}</strong>
          </div>

          <div className="entrevistas-modal-acoes">
            <button type="button" className="secundario" onClick={onClose}>
              {t('interviews.cancel')}
            </button>
            <button type="button" className="calendario" onClick={onAbrirPreview}>
              <FaExternalLinkAlt /> {t('interviews.openPreview')}
            </button>
            <button type="submit" disabled={carregando}>
              {carregando ? t('interviews.saving') : t('interviews.save')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default PainelEntrevistas
