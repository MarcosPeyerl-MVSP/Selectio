import './RubricaCompatibilidadeForm.css'
import { useTranslation } from 'react-i18next'
import { somarPesosRubrica } from '../../utils/rubricaCompatibilidade'

const CAMPOS_PESO = [
  'hardSkills',
  'experiencia',
  'escolaridade',
  'idiomas',
  'modeloTrabalho',
  'responsabilidades'
]

function RubricaCompatibilidadeForm({ rubrica, onChange }) {
  const { t } = useTranslation('company')
  const totalPesos = somarPesosRubrica(rubrica)

  const atualizarCampo = (event) => {
    const { name, value } = event.target
    onChange({ ...rubrica, [name]: value })
  }

  const atualizarPeso = (event) => {
    const { name, value } = event.target
    onChange({
      ...rubrica,
      pesos: { ...rubrica.pesos, [name]: value === '' ? '' : Number(value) }
    })
  }

  return (
    <section className="vaga-step compatibilidade-rubrica-form">
      <div className="step-header">
        <div>
          <h2>{t('compatibilityRubric.title')}</h2>
          <p>{t('compatibilityRubric.description')}</p>
        </div>
        <label className="compatibilidade-switch">
          <input
            type="checkbox"
            checked={Boolean(rubrica.ativa)}
            onChange={(event) => onChange({ ...rubrica, ativa: event.target.checked })}
          />
          <span>{t('compatibilityRubric.enable')}</span>
        </label>
      </div>

      {rubrica.ativa && (
        <>
          <label>{t('compatibilityRubric.idealProfile')}</label>
          <textarea
            name="perfilIdeal"
            value={rubrica.perfilIdeal}
            onChange={atualizarCampo}
            placeholder={t('compatibilityRubric.idealProfilePlaceholder')}
          />

          <div className="form-grid two">
            <div>
              <label>{t('compatibilityRubric.required')}</label>
              <textarea
                className="small"
                name="requisitosObrigatorios"
                value={rubrica.requisitosObrigatorios}
                onChange={atualizarCampo}
                placeholder={t('compatibilityRubric.listPlaceholder')}
              />
            </div>
            <div>
              <label>{t('compatibilityRubric.desirable')}</label>
              <textarea
                className="small"
                name="requisitosDesejaveis"
                value={rubrica.requisitosDesejaveis}
                onChange={atualizarCampo}
                placeholder={t('compatibilityRubric.listPlaceholder')}
              />
            </div>
          </div>

          <label>{t('compatibilityRubric.eliminatory')}</label>
          <textarea
            className="small"
            name="criteriosEliminatorios"
            value={rubrica.criteriosEliminatorios}
            onChange={atualizarCampo}
            placeholder={t('compatibilityRubric.eliminatoryPlaceholder')}
          />

          <div className="form-grid two compatibilidade-criteria-grid">
            <div>
              <label>{t('compatibilityRubric.minimumExperience')}</label>
              <input
                min="0"
                max="60"
                name="experienciaMinima"
                type="number"
                value={rubrica.experienciaMinima}
                onChange={atualizarCampo}
              />
            </div>
            <div>
              <label>{t('compatibilityRubric.minimumEducation')}</label>
              <select name="escolaridadeMinima" value={rubrica.escolaridadeMinima} onChange={atualizarCampo}>
                <option value="">{t('compatibilityRubric.notRequired')}</option>
                <option value="medio">{t('compatibilityRubric.education.highSchool')}</option>
                <option value="tecnico">{t('compatibilityRubric.education.technical')}</option>
                <option value="superior_cursando">{t('compatibilityRubric.education.higherOngoing')}</option>
                <option value="superior_completo">{t('compatibilityRubric.education.higherComplete')}</option>
                <option value="pos_graduacao">{t('compatibilityRubric.education.postgraduate')}</option>
              </select>
            </div>
            <div>
              <label>{t('compatibilityRubric.languages')}</label>
              <input
                name="idiomasExigidos"
                value={rubrica.idiomasExigidos}
                onChange={atualizarCampo}
                placeholder={t('compatibilityRubric.languagesPlaceholder')}
              />
            </div>
            <div>
              <label>{t('compatibilityRubric.workModel')}</label>
              <select name="modeloTrabalho" value={rubrica.modeloTrabalho} onChange={atualizarCampo}>
                <option value="">{t('compatibilityRubric.notRequired')}</option>
                <option value="presencial">{t('compatibilityRubric.models.onsite')}</option>
                <option value="hibrido">{t('compatibilityRubric.models.hybrid')}</option>
                <option value="remoto">{t('compatibilityRubric.models.remote')}</option>
              </select>
            </div>
          </div>

          <div className="compatibilidade-weights-heading">
            <div>
              <h3>{t('compatibilityRubric.weights')}</h3>
              <p>{t('compatibilityRubric.weightsHelp')}</p>
            </div>
            <strong className={totalPesos === 100 ? 'valid' : 'invalid'}>
              {t('compatibilityRubric.total', { total: totalPesos })}
            </strong>
          </div>

          <div className="compatibilidade-weights-grid">
            {CAMPOS_PESO.map((campo) => (
              <label key={campo}>
                <span>{t(`compatibilityRubric.weightLabels.${campo}`)}</span>
                <input
                  name={campo}
                  type="number"
                  min="0"
                  max="100"
                  value={rubrica.pesos[campo]}
                  onChange={atualizarPeso}
                />
              </label>
            ))}
          </div>

          <p className="compatibilidade-human-review">{t('compatibilityRubric.humanReview')}</p>
        </>
      )}
    </section>
  )
}

export default RubricaCompatibilidadeForm
