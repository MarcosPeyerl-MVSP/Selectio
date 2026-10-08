import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { chamarAssistente } from '../../services/assistenteCandidatos'
import { buscarCandidatoPorId } from '../../services/firestoreCandidatos'
import ModalPerfilCandidato from '../../components/ui/ModalPerfilCandidato'
import './styles/EmpresaAssistenteCandidatos.css'

const MAX_QUESTION = 1200
function EmpresaAssistenteCandidatos() {
  const { t, i18n } = useTranslation('assistant')
  const [jobs, setJobs] = useState([])
  const [jobId, setJobId] = useState('')
  const [context, setContext] = useState(null)
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState('loading')
  const [error, setError] = useState('')
  const [candidate, setCandidate] = useState(null)
  const [truncated, setTruncated] = useState(false)
  const epoch = useRef(0)
  const mounted = useRef(false)
  const transcript = useRef(null)
  const input = useRef(null)
  const language = i18n.resolvedLanguage || 'pt-BR'
  const erroKey = (err) => `errors.${err?.details?.motivo || (err?.code === 'functions/resource-exhausted' ? 'limite_uso' : 'provider_indisponivel')}`
  useEffect(() => {
    mounted.current = true
    chamarAssistente({ acao: 'vagas' }).then((result) => {
      if (mounted.current) { setJobs(result.vagas); setTruncated(result.truncated) }
    }).catch((err) => { if (mounted.current) setError(erroKey(err)) })
      .finally(() => { if (mounted.current) setBusy('') })
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function preparar(id = jobId) {
    const requestEpoch = ++epoch.current
    setJobId(id); setMessages([]); setQuestion(''); setCandidate(null); setContext(null); setError('')
    if (!id) { setBusy(''); return }
    setBusy('indexing')
    try {
      let result = await chamarAssistente({ acao: 'contexto', vagaId: id })
      if (!mounted.current || epoch.current !== requestEpoch) return
      setContext(result)
      let remaining = result.pending
      while (remaining > 0) {
        result = await chamarAssistente({ acao: 'indexar', vagaId: id })
        if (!mounted.current || epoch.current !== requestEpoch) return
        setContext(result)
        if (result.pending >= remaining) throw new Error('Indexing stalled')
        remaining = result.pending
      }
    } catch (err) { if (mounted.current && epoch.current === requestEpoch) setError(erroKey(err)) }
    finally { if (mounted.current && epoch.current === requestEpoch) setBusy('') }
  }
  async function send(text = question) {
    if (busy || !jobId || !context?.count || context.pending || !text.trim() || text.length > MAX_QUESTION) return
    const requestEpoch = epoch.current
    const history = messages.filter((m) => m.role === 'user').slice(-4).map(({ content }) => ({ role: 'user', content }))
    setMessages((previous) => [...previous, { role: 'user', content: text.trim() }])
    setQuestion(''); setBusy('sending'); setError('')
    try {
      const result = await chamarAssistente({ acao: 'perguntar', vagaId: jobId, question: text.trim(), history, language })
      if (mounted.current && epoch.current === requestEpoch) setMessages((previous) => [...previous, { role: 'assistant', result }])
    } catch (err) { if (mounted.current && epoch.current === requestEpoch) setError(erroKey(err)) }
    finally {
      if (mounted.current && epoch.current === requestEpoch) { setBusy(''); input.current?.focus() }
    }
  }
  async function openCandidate(id) {
    const requestEpoch = epoch.current
    try {
      const value = await buscarCandidatoPorId(id)
      if (mounted.current && epoch.current === requestEpoch && value?.vagaId === jobId) setCandidate(value)
    } catch { if (mounted.current && epoch.current === requestEpoch) setError('errors.acesso_negado') }
  }
  const canChat = Boolean(jobId && context?.count && !context.pending && !busy)
  return (
    <section className="candidate-assistant">
      <header><h1>{t('title')}</h1><p>{t('intro')}</p></header>
      <p className="assistant-notice">{t('review')}</p>
      <div className="assistant-toolbar">
        <label htmlFor="assistant-job">{t('selectJob')}</label>
        <select id="assistant-job" value={jobId} disabled={busy === 'loading'} onChange={(event) => preparar(event.target.value)}>
          <option value="">{t('chooseJob')}</option>
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </select>
        <button type="button" disabled={Boolean(busy)} onClick={() => { epoch.current++; setMessages([]); setQuestion(''); setError(''); input.current?.focus() }}>{t('newConversation')}</button>
        {jobId && <button type="button" disabled={Boolean(busy)} onClick={() => preparar()}>{t('refresh')}</button>}
      </div>
      {truncated && <p>{t('jobsLimit')}</p>}
      {!busy && !jobs.length && !error && <p>{t('noJobs')}</p>}
      {!jobId && jobs.length > 0 && <p>{t('selectFirst')}</p>}
      {context && <p>{t('candidateCount', { count: context.count })}</p>}
      {context?.count === 0 && <p>{t('noCandidates')}</p>}
      {context?.candidates.some((c) => c.indexed && c.resumeStatus !== 'ready') && <p className="assistant-notice">{t('partialSources')}</p>}
      {busy && <p role="status" aria-live="polite">{t(busy)}{busy === 'indexing' && context ? ` (${context.count - context.pending}/${context.count})` : ''}</p>}
      {error && <p role="alert">{t(error, { defaultValue: t('errors.provider_indisponivel') })}</p>}
      <div className="assistant-transcript" ref={transcript} role="log" aria-label={t('conversation')} aria-live="polite" aria-relevant="additions">
        {messages.map((message, index) => <article className={`assistant-message assistant-message--${message.role}`} key={index}>
          <h2>{t(message.role)}</h2>
          {message.role === 'user' ? <p>{message.content}</p> : <>
            {message.result.claims.map((claim, claimIndex) => <p key={claimIndex}>
              <strong>{message.result.candidates.find((c) => c.id === claim.candidateId)?.name}: </strong>{claim.text}{' '}
              {claim.citationIds.map((id) => <a href={`#citation-${index}-${id}`} key={id} aria-label={t('sourceLink', { id })}>[{message.result.citations.findIndex((s) => s.id === id) + 1}] </a>)}
            </p>)}
            {message.result.limitations.map((key) => <p className="assistant-limitation" key={key}>{t(`limitations.${key}`)}</p>)}
            {!!message.result.candidates.length && <div className="assistant-profile-links">{message.result.candidates.map((c) => <button type="button" key={c.id} onClick={() => openCandidate(c.id)}>{t('viewCandidate', { name: c.name })}</button>)}</div>}
            {!!message.result.citations.length && <section aria-label={t('sources')}>
              <h3>{t('sources')}</h3>
              {message.result.citations.map((source, sourceIndex) => <details key={source.id} id={`citation-${index}-${source.id}`}>
                <summary>[{sourceIndex + 1}] {source.candidateName} — {t(`sourceTypes.${source.sourceType}`)} — {t(`fields.${source.field}`, { defaultValue: t('fields.resume') })}</summary>
                <blockquote>{source.excerpt}</blockquote>
              </details>)}
            </section>}
          </>}
        </article>)}
      </div>
      {messages.length === 0 && canChat && <div className="assistant-suggestions" aria-label={t('suggestionsLabel')}>
        {['technical', 'experience', 'leadership', 'missing', 'differences'].map((key) => <button key={key} type="button" onClick={() => send(t(`suggestions.${key}`))}>{t(`suggestions.${key}`)}</button>)}
      </div>}
      <form onSubmit={(event) => { event.preventDefault(); send() }}>
        <label htmlFor="assistant-question">{t('question')}</label>
        <textarea id="assistant-question" ref={input} value={question} maxLength={MAX_QUESTION} disabled={!canChat}
          onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() }
          }} aria-describedby="assistant-input-help" rows={3} />
        <p id="assistant-input-help">{t('inputHelp')} ({question.length}/{MAX_QUESTION})</p>
        <button type="submit" disabled={!canChat || !question.trim()}>{t('send')}</button>
      </form>
      {candidate && <ModalPerfilCandidato candidato={candidate} onClose={() => setCandidate(null)} editableStatus={false} />}
    </section>
  )
}
export default EmpresaAssistenteCandidatos
