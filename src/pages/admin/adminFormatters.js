import i18n, { getCurrentLanguage } from '../../i18n'
import {
  formatCurrency as formatLocalizedCurrency,
  formatDate as formatLocalizedDate,
  formatNumber as formatLocalizedNumber
} from '../../i18n/formatters'

export function formatCurrency(value) {
  return formatLocalizedCurrency(value, { maximumFractionDigits: 2 })
}

export function formatCompactCurrency(value) {
  return formatLocalizedCurrency(value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

export function formatNumber(value) {
  return formatLocalizedNumber(value)
}

export function formatMonthKey(value) {
  const [year, month] = String(value || '').split('-').map(Number)
  if (!year || !month) return ''

  return new Intl.DateTimeFormat(getCurrentLanguage(), { month: 'short' })
    .format(new Date(year, month - 1, 1))
    .replace('.', '')
    .toLocaleUpperCase(getCurrentLanguage())
}

export function formatDate(value) {
  if (!value) return i18n.t('generic.notProvided', { ns: 'common' })
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return i18n.t('generic.notProvided', { ns: 'common' })

  return formatLocalizedDate(date, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replace('.', '')
}

export function formatDateTime(value) {
  if (!value) return i18n.t('generic.notProvided', { ns: 'common' })
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return i18n.t('generic.notProvided', { ns: 'common' })

  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date).replace('.', '')
}

export function formatRelativeDate(value) {
  if (!value) return i18n.t('generic.dateNotProvided', { ns: 'common' })
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return i18n.t('generic.dateNotProvided', { ns: 'common' })

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))
  const relative = new Intl.RelativeTimeFormat(getCurrentLanguage(), { numeric: 'auto' })
  if (minutes < 1) return relative.format(0, 'minute')
  if (minutes < 60) return relative.format(-minutes, 'minute')

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')

  const days = Math.floor(hours / 24)
  if (days < 30) return relative.format(-days, 'day')

  return formatDate(value)
}

export function initials(value) {
  return String(value || 'NA')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
