const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const localesRoot = path.join(projectRoot, 'src', 'i18n', 'locales')
const sourceLocale = 'pt-BR'
const problems = []

const locales = fs
  .readdirSync(localesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

if (!locales.includes(sourceLocale)) {
  console.error(`Locale de origem ausente: ${sourceLocale}`)
  process.exit(1)
}

const targetLocales = locales.filter((locale) => locale !== sourceLocale)

const flatten = (value, prefix = '', result = new Map()) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, child]) => {
      flatten(child, prefix ? `${prefix}.${key}` : key, result)
    })
    return result
  }

  result.set(prefix, value)
  return result
}

const listNamespaces = (locale) => fs
  .readdirSync(path.join(localesRoot, locale), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .map((entry) => entry.name)
  .sort()

const readNamespace = (locale, namespace) => {
  const file = path.join(localesRoot, locale, namespace)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const sourceNamespaces = listNamespaces(sourceLocale)

for (const namespace of sourceNamespaces) {
  const source = flatten(readNamespace(sourceLocale, namespace))

  for (const [key, value] of source.entries()) {
    if (typeof value !== 'string' || !value.trim()) {
      problems.push(`${sourceLocale}/${namespace}: texto de origem vazio ou invalido: ${key}`)
    }
  }
}

for (const targetLocale of targetLocales) {
  const targetNamespaces = listNamespaces(targetLocale)

  for (const namespace of sourceNamespaces) {
    if (!targetNamespaces.includes(namespace)) {
      problems.push(`${targetLocale}: namespace ausente: ${namespace}`)
      continue
    }

    const source = flatten(readNamespace(sourceLocale, namespace))
    const target = flatten(readNamespace(targetLocale, namespace))

    for (const key of source.keys()) {
      if (!target.has(key)) problems.push(`${targetLocale}/${namespace}: chave ausente: ${key}`)
    }

    for (const key of target.keys()) {
      if (!source.has(key)) problems.push(`${targetLocale}/${namespace}: chave extra: ${key}`)
    }

    for (const [key, value] of target.entries()) {
      if (typeof value !== 'string' || !value.trim()) {
        problems.push(`${targetLocale}/${namespace}: traducao vazia ou invalida: ${key}`)
      }
    }
  }

  for (const namespace of targetNamespaces) {
    if (!sourceNamespaces.includes(namespace)) {
      problems.push(`${targetLocale}: namespace extra: ${namespace}`)
    }
  }
}

if (problems.length) {
  console.error('Falha na verificacao dos catalogos de traducao:')
  problems.forEach((problem) => console.error(`- ${problem}`))
  process.exit(1)
}

console.log(`Catalogos de traducao sincronizados (${locales.join(', ')}).`)
