import './ModalPerfilCandidato.css'

import { useEffect } from 'react'
import {
  FaBriefcase,
  FaCalendarAlt,
  FaEnvelope,
  FaFileAlt,
  FaLink,
  FaMoneyBillWave,
  FaPhone,
  FaTimes,
  FaUser,
  FaUserTie
} from 'react-icons/fa'

import LinhaStatusCandidato from './LinhaStatusCandidato'

const emptyValue = 'Não informado'

const statusLabels = {
  indicado: 'Indicado',
  entrevista: 'Entrevista',
  contratado: 'Contratado',
  cancelado: 'Cancelado',
  recusado: 'Recusado'
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value : null
  return value || emptyValue
}

function formatDate(value) {
  if (!value) return emptyValue
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace('.', '')
}

function ModalPerfilCandidato({
  candidato,
  onClose,
  editableStatus = false,
  onChangeStatus,
  loadingStatus = false
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!candidato) return null

  const status = candidato.status || 'indicado'
  const details = [
    { icon: FaEnvelope, label: 'E-mail', value: candidato.email },
    { icon: FaPhone, label: 'Telefone', value: candidato.telefone },
    { icon: FaLink, label: 'LinkedIn', value: candidato.linkedin },
    { icon: FaBriefcase, label: 'Cargo atual', value: candidato.cargoAtual },
    { icon: FaUserTie, label: 'Experiência', value: candidato.anosExperiencia },
    { icon: FaFileAlt, label: 'Escolaridade', value: candidato.escolaridade },
    { icon: FaMoneyBillWave, label: 'Expectativa salarial', value: candidato.expectativaSalarial },
    { icon: FaBriefcase, label: 'Modelo de trabalho', value: candidato.modeloTrabalho },
    { icon: FaCalendarAlt, label: 'Aviso previo', value: candidato.avisoPrevio },
    { icon: FaBriefcase, label: 'Vaga relacionada', value: candidato.vagaTitulo },
    { icon: FaBriefcase, label: 'Empresa', value: candidato.vagaEmpresa || candidato.empresaNome },
    { icon: FaUser, label: 'Indicador', value: candidato.indicadorNome },
    { icon: FaCalendarAlt, label: 'Data da indicação', value: formatDate(candidato.aplicadoEm || candidato.criadoEm) },
    { icon: FaFileAlt, label: 'Currículo', value: candidato.curriculoNome }
  ]

  return (
    <div className="candidate-profile-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="candidate-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-profile-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="candidate-profile-close" onClick={onClose} aria-label="Fechar perfil">
          <FaTimes />
        </button>

        <header className="candidate-profile-header">
          <span>Perfil do candidato</span>
          <h2 id="candidate-profile-title">{candidato.nome || emptyValue}</h2>
          <p>{candidato.cargoAtual || candidato.vagaTitulo || 'Candidato indicado'}</p>
          <strong>{statusLabels[status] || statusLabels.indicado}</strong>
        </header>

        <section className="candidate-profile-section">
          <div className="candidate-profile-section-title">
            <span>Status</span>
            <p>Acompanhamento do processo seletivo</p>
          </div>
          <LinhaStatusCandidato
            status={status}
            editable={editableStatus}
            loading={loadingStatus}
            onChangeStatus={onChangeStatus}
          />
        </section>

        <section className="candidate-profile-grid">
          {details.map((item) => {
            const Icon = item.icon
            const value = formatValue(item.value)

            return (
              <div className="candidate-profile-detail" key={item.label}>
                <Icon />
                <span>{item.label}</span>
                {item.label === 'LinkedIn' && item.value ? (
                  <a href={String(item.value).startsWith('http') ? item.value : `https://${item.value}`} target="_blank" rel="noreferrer">
                    {item.value}
                  </a>
                ) : (
                  <strong>{value}</strong>
                )}
              </div>
            )
          })}
        </section>

        <ProfileText title="Pontos fortes" value={candidato.pontosFortes} />
        <ProfileText title="Fit cultural" value={candidato.fitCultural} />
        <ProfileText title="Narrativa" value={candidato.narrativa || candidato.mensagem} />
        <ProfileTags title="Hard skills" values={candidato.hardSkills} />
        <ProfileTags title="Soft skills" values={candidato.softSkills} />
      </aside>
    </div>
  )
}

function ProfileText({ title, value }) {
  if (!value) return null

  return (
    <section className="candidate-profile-section">
      <div className="candidate-profile-section-title">
        <span>{title}</span>
      </div>
      <p className="candidate-profile-text">{value}</p>
    </section>
  )
}

function ProfileTags({ title, values }) {
  if (!Array.isArray(values) || !values.length) return null

  return (
    <section className="candidate-profile-section">
      <div className="candidate-profile-section-title">
        <span>{title}</span>
      </div>
      <div className="candidate-profile-tags">
        {values.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
    </section>
  )
}

export default ModalPerfilCandidato
