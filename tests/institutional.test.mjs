import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

// Isola a sessão do header; os documentos e o Footer reais não fazem leituras Firebase.
const server = await createServer({ configFile: false, appType: 'custom',
  server: { middlewareMode: true }, plugins: [{ name: 'isolated-public-header', enforce: 'pre',
    load(id) { if (id.replaceAll('\\', '/').endsWith('/components/layout/Navbar.jsx')) return 'export default function Navbar() { return null }' },
  }, react()] })
after(() => server.close())

async function render(page, language) {
  const resources = {}
  resources[language] = {}
  for (const ns of ['institutional', 'common']) {
    resources[language][ns] = JSON.parse(await readFile(new URL(`../src/i18n/locales/${language}/${ns}.json`, import.meta.url)))
  }
  const instance = i18next.createInstance()
  await instance.init({ lng: language, resources, defaultNS: 'institutional', interpolation: { escapeValue: false } })
  const { default: Component } = await server.ssrLoadModule(`/src/pages/public/${page}.jsx`)
  return renderToStaticMarkup(React.createElement(I18nextProvider, { i18n: instance },
    React.createElement(StaticRouter, { location: '/preview' }, React.createElement(Component))))
}

test('páginas públicas têm conteúdo traduzido, um main e um h1 nos dois idiomas', async () => {
  for (const language of ['pt-BR', 'en-US']) for (const page of ['Privacidade', 'Termos', 'Contato', 'FAQ', 'Equipe', 'NotFound']) {
    const html = await render(page, language)
    assert.equal((html.match(/<main\b/g) || []).length, 1, `${language}/${page}`)
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${language}/${page}`)
    assert.doesNotMatch(html, /institutional:|privacy\.title|terms\.title|notFound\.title/)
    assert.match(html, /<footer/)
  }
})

test('Footer oferece destinos institucionais reais e não adiciona navegação de conta', async () => {
  const html = await render('Contato', 'pt-BR')
  const footer = html.slice(html.indexOf('<footer'))
  const paths = [...footer.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(new Set(paths), new Set(['/', '/equipe', '/contato', '/faq', '/privacidade', '/termos']))
  assert.doesNotMatch(footer, /href="#"|\/login|\/cadastro|\/painel/)
  assert.doesNotMatch(html, /<form\b|type="submit"/)
  assert.match(html, /Canal oficial em definição/)
})

test('FAQ conecta botões aos painéis ocultos e 404 oferece recuperação sem redirecionar', async () => {
  const faq = await render('FAQ', 'en-US')
  const ids = [...faq.matchAll(/aria-controls="([^"]+)"/g)].map((match) => match[1])
  assert.equal(ids.length, 16)
  for (const id of ids) assert.ok(faq.includes(`id="${id}" hidden=""`))
  assert.equal((faq.match(/aria-expanded="false"/g) || []).length, ids.length)
  for (const language of ['pt-BR', 'en-US']) {
    const notFound = await render('NotFound', language)
    const main = notFound.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1]
    assert.match(main, />404<\/p>/)
    assert.deepEqual([...main.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), ['/'])
    assert.doesNotMatch(main, /institutional-eyebrow|institutional-breadcrumb|\/vagas/)
    assert.doesNotMatch(notFound, /http-equiv="refresh"/)
  }
})
