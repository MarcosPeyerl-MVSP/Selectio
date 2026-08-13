import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enAuth from './locales/en-US/auth.json'
import enAdmin from './locales/en-US/admin.json'
import enCommon from './locales/en-US/common.json'
import enCompany from './locales/en-US/company.json'
import enPublic from './locales/en-US/public.json'
import enReferrer from './locales/en-US/referrer.json'
import ptAuth from './locales/pt-BR/auth.json'
import ptAdmin from './locales/pt-BR/admin.json'
import ptCommon from './locales/pt-BR/common.json'
import ptCompany from './locales/pt-BR/company.json'
import ptPublic from './locales/pt-BR/public.json'
import ptReferrer from './locales/pt-BR/referrer.json'

export const supportedLanguages = ['pt-BR', 'en-US']
export const defaultLanguage = 'pt-BR'

const resources = {
  'pt-BR': {
    admin: ptAdmin,
    auth: ptAuth,
    common: ptCommon,
    company: ptCompany,
    public: ptPublic,
    referrer: ptReferrer
  },
  'en-US': {
    admin: enAdmin,
    auth: enAuth,
    common: enCommon,
    company: enCompany,
    public: enPublic,
    referrer: enReferrer
  }
}

const normalizeDetectedLanguage = (language = '') => (
  String(language).toLowerCase().startsWith('en') ? 'en-US' : 'pt-BR'
)

const syncDocumentLanguage = (language) => {
  if (typeof document === 'undefined') return

  document.documentElement.lang = normalizeDetectedLanguage(language)
  document.documentElement.dir = 'ltr'
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: supportedLanguages,
    fallbackLng: defaultLanguage,
    defaultNS: 'common',
    ns: ['common', 'auth', 'public', 'admin', 'company', 'referrer'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'selectioLanguage',
      convertDetectedLanguage: normalizeDetectedLanguage
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    },
    returnNull: false
  })

syncDocumentLanguage(i18n.resolvedLanguage || i18n.language)
i18n.on('languageChanged', syncDocumentLanguage)

export const getCurrentLanguage = () => (
  normalizeDetectedLanguage(i18n.resolvedLanguage || i18n.language)
)

export default i18n
