import { formatCurrency, formatDate } from './formatters'

const jobTypeKeys = {
  'Tempo Integral': 'company:jobForm.employment.fullTime',
  Freelance: 'company:jobForm.employment.freelance',
  'Meio Período': 'company:jobForm.employment.partTime',
  Remoto: 'company:jobForm.employment.remote',
  'Contrato temporário': 'company:jobForm.employment.temporary'
}

const companyIndustryKeys = {
  Tecnologia: 'auth:companyRegistration.industries.technology',
  Financeiro: 'auth:companyRegistration.industries.finance',
  Indústria: 'auth:companyRegistration.industries.industry',
  Serviços: 'auth:companyRegistration.industries.services',
  Varejo: 'auth:companyRegistration.industries.retail'
}

const companySizeKeys = {
  'Microempresa (ME)': 'auth:companyRegistration.sizes.micro',
  'Empresa de Pequeno Porte (EPP)': 'auth:companyRegistration.sizes.small',
  'Média empresa': 'auth:companyRegistration.sizes.medium',
  'Grande empresa': 'auth:companyRegistration.sizes.large'
}

const parseCurrencyAmount = (value) => {
  const text = String(value || '').trim()
  const digits = text.replace(/\D/g, '')
  if (!digits) return null

  const amount = Number(digits)
  return /k\b/i.test(text) ? amount * 1000 : amount
}

const isNegotiable = (value) => /^(a combinar|negotiable)$/i.test(String(value || '').trim())

const formatSalaryPart = (value, t) => {
  if (isNegotiable(value)) return t('common:domain.job.negotiable')
  const amount = parseCurrencyAmount(value)
  return amount ? formatCurrency(amount, { maximumFractionDigits: 0 }) : String(value || '').trim()
}

export function formatJobSalary(job, t) {
  const minimum = Number(job?.salarioMinValor || 0)
  const maximum = Number(job?.salarioMaxValor || 0)

  if (minimum || maximum) {
    return [
      minimum ? formatCurrency(minimum, { maximumFractionDigits: 0 }) : t('common:domain.job.negotiable'),
      maximum ? formatCurrency(maximum, { maximumFractionDigits: 0 }) : t('common:domain.job.negotiable')
    ].join(' – ')
  }

  const rawSalary = String(job?.salario || '').trim()
  if (!rawSalary || isNegotiable(rawSalary)) return t('common:domain.job.negotiable')

  const parts = rawSalary.split(/\s+[–-]\s+/)
  return parts.map((part) => formatSalaryPart(part, t)).join(' – ')
}

export function formatJobReward(job, t) {
  const fixedValue = Number(job?.recompensaValorFixo || 0)
  if (job?.recompensaTipo === 'fixo' && fixedValue) return formatCurrency(fixedValue)

  const rawReward = String(job?.recompensa || '').trim()
  if (job?.recompensaTipo === 'percentual' || /%/.test(rawReward)) {
    const percentage = rawReward.match(/[\d.,]+/)?.[0] || '10'
    return t('common:domain.reward.salaryPercentage', { value: percentage })
  }

  if (job?.recompensaTipo === 'personalizado' && !rawReward) {
    return t('common:domain.reward.consult')
  }
  if (/^(consultar|consult)$/i.test(rawReward)) return t('common:domain.reward.consult')

  const amount = parseCurrencyAmount(rawReward)
  return amount && /^(r\$|brl|\$|\d)/i.test(rawReward)
    ? formatCurrency(amount)
    : rawReward || t('common:domain.reward.notProvided')
}

export function formatJobType(job, t) {
  const rawType = String(job?.tipo || '').trim()
  const baseType = String(job?.tipoBase || rawType.split(/\s*\(/)[0] || '').trim()
  const label = jobTypeKeys[baseType] ? t(jobTypeKeys[baseType]) : baseType

  if (baseType !== 'Contrato temporário') return label || rawType

  if (job?.tipoDataInicio && job?.tipoDataFim) {
    const start = formatDate(`${job.tipoDataInicio}T12:00:00`, { dateStyle: 'short' })
    const end = formatDate(`${job.tipoDataFim}T12:00:00`, { dateStyle: 'short' })
    return `${label} (${start} – ${end})`
  }

  const savedPeriod = rawType.match(/\((.+)\)/)?.[1]
  if (!savedPeriod) return label

  const localizedPeriod = savedPeriod.replace(/(\d{2})\/(\d{2})\/(\d{4})/g, (_, day, month, year) => (
    formatDate(`${year}-${month}-${day}T12:00:00`, { dateStyle: 'short' })
  ))
  return `${label} (${localizedPeriod})`
}

export function formatCompanyIndustry(value, t) {
  return companyIndustryKeys[value] ? t(companyIndustryKeys[value]) : value
}

export function formatCompanySize(value, t) {
  return companySizeKeys[value] ? t(companySizeKeys[value]) : value
}
