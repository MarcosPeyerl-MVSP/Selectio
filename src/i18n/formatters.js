import { getCurrentLanguage } from './index'

export const formatCurrency = (value, options = {}) => {
  const { currency = 'BRL', ...numberOptions } = options

  return new Intl.NumberFormat(getCurrentLanguage(), {
    style: 'currency',
    currency,
    ...numberOptions
  }).format(Number(value || 0))
}

export const formatDate = (value, options = {}) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(getCurrentLanguage(), options).format(date)
}

export const formatNumber = (value, options = {}) => (
  new Intl.NumberFormat(getCurrentLanguage(), options).format(Number(value || 0))
)

export const formatPercent = (value, options = {}) => (
  new Intl.NumberFormat(getCurrentLanguage(), {
    style: 'percent',
    maximumFractionDigits: 1,
    ...options
  }).format(Number(value || 0) / 100)
)
