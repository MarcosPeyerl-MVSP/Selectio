import { useTranslation } from 'react-i18next'
import './ValidacaoIndicacao.css'

export default function ValidacaoIndicacao({ analise, atual, analisando, erro, onAnalisar, saving }) {
  const { t, i18n } = useTranslation('referrer')
  const resultado = analise?.resultado
  // Não mostrar 45% arredondados para uma nota que acaba de superar o limite.
  const nota = resultado?.notaPrecisa
  const formatada = Number.isFinite(nota) ? new Intl.NumberFormat(i18n.resolvedLanguage, {
    maximumFractionDigits: nota > 45 && nota < 45.01 ? 12 : 2
  }).format(nota) : ''
  const estado = analisando ? 'analisando' : erro ? 'erro' : analise && !atual ? 'analise_desatualizada'
    : resultado?.motivo || 'aguardando'
  return (
    <section className="validacao-indicacao" aria-labelledby="compatibilidade-indicacao-titulo" aria-busy={analisando}>
      <h2 id="compatibilidade-indicacao-titulo">{t('referralCompatibility.title')}</h2>
      <p>{t('referralCompatibility.rule')}</p>
      <div role="status" aria-live="polite" className={`validacao-indicacao-status ${estado}`}>
        {atual && resultado?.analiseValida && <strong className="validacao-indicacao-nota">{formatada}%</strong>}
        <p>{erro || t(`referralCompatibility.states.${estado}`, { nota: formatada })}</p>
      </div>
      {atual && resultado?.criterios && (
        <details>
          <summary>{t('referralCompatibility.details')}</summary>
          <ul className="validacao-indicacao-criterios">
            {resultado.criterios.filter((c) => c.peso > 0 && c.resultado !== 'nao_aplicavel').map((criterio) => (
              <li key={criterio.id}>
                <strong>{t(`company:compatibilityRubric.weightLabels.${criterio.id}`)}</strong>
                <span>{t(`company:compatibility.results.${criterio.resultado}`)}</span>
                {criterio.detalhes?.filter((d) => d.descricao).map((d, i) => (
                  <p key={i}>{d.descricao}: {t(`company:compatibility.results.${d.resultado}`)}</p>
                ))}
                {criterio.evidencias?.map((evidencia, i) => <p key={i}>{evidencia}</p>)}
              </li>
            ))}
          </ul>
          {resultado.alertas?.length > 0 && <>
            <h3>{t('company:compatibility.alerts')}</h3>
            <ul>{resultado.alertas.map((alerta, i) => <li key={i}>{alerta.descricao}{alerta.evidencia ? `: ${alerta.evidencia}` : ''}</li>)}</ul>
          </>}
          {resultado.discrepancias?.length > 0 && <>
            <h3>{t('company:compatibility.discrepancies')}</h3>
            <ul>{resultado.discrepancias.map((d, i) => <li key={i}>{t('company:compatibility.discrepancyLine', { field: d.campo, form: d.formulario, resume: d.curriculo })}</li>)}</ul>
          </>}
          {resultado.requerRevisao && <p>{t('referralCompatibility.review')}</p>}
        </details>
      )}
      <button type="button" className="draft-button" disabled={saving || analisando} onClick={onAnalisar}>
        {analisando ? t('referralCompatibility.analyzing') : analise ? t('referralCompatibility.reanalyze') : t('referralCompatibility.analyze')}
      </button>
    </section>
  )
}
