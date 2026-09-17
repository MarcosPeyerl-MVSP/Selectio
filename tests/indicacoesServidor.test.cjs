const assert = require('node:assert/strict')
const { test, before, beforeEach, after } = require('node:test')
const { createRequire } = require('node:module')
const path = require('node:path')
const deps = createRequire(path.resolve('functions/package.json'))
const { initializeApp, deleteApp } = deps('firebase-admin/app')
const { getFirestore, Timestamp } = deps('firebase-admin/firestore')
const { criarServicoIndicacoes } = require('../functions/src/indicacoesCore.cjs')

let app, db, service
let time = Date.now()
const projectId = 'selectio-1f022'
const dados = { nome: 'Pessoa', email: 'pessoa@example.com', hardSkills: ['React'] }
const payload = (overrides = {}) => ({ vagaId: 'vaga-1', dados, ...overrides })
const perfilVaga = () => ({ titulo: 'Frontend', empresaId: 'empresa-1', status: 'aberta',
  rubricaCompatibilidade: { ativa: true, versao: 1, requisitosObrigatorios: ['React'], requisitosDesejaveis: [], idiomasExigidos: [], criteriosEliminatorios: [],
    pesos: { hardSkills: 100, experiencia: 0, escolaridade: 0, idiomas: 0, modeloTrabalho: 0, responsabilidades: 0 } }
})
const semArquivos = { file: () => { throw new Error('Acesso inesperado a arquivos') } }
const falha = (motivo) => (error) => error.details?.motivo === motivo

before(() => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Execute com o emulador Firestore')
  app = initializeApp({ projectId }, 'indicacoes-testes')
  db = getFirestore(app)
})
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' })
  time = Date.now()
  await db.doc('indicadores/indicador-1').set({ nome: 'Indicador' })
  await db.doc('vagas/vaga-1').set(perfilVaga())
  service = criarServicoIndicacoes({ db, bucket: semArquivos, agora: () => time })
})
after(async () => { await db.terminate(); await deleteApp(app) })

async function enviar(analise, changes = {}) {
  return service.finalizar('indicador-1', payload({ analiseId: analise.analiseId, ...changes }))
}
async function semProcesso() {
  for (const colecao of ['candidatos', 'indicacoes', 'historicoProcesso', 'notificacoes', 'analisesIndicacao']) {
    assert.equal((await db.collection(colecao).get()).size, 0, colecao)
  }
}

test('previa nao cria processo; envio atomico persiste snapshot e notificacoes', async () => {
  const analise = await service.analisar('indicador-1', payload())
  assert.equal(analise.resultado.notaPrecisa, 50)
  await semProcesso()
  const result = await enviar(analise)
  const candidato = (await db.doc(`candidatos/${result.id}`).get()).data()
  assert.equal(candidato.compatibilidadeIndicacao.nota, 50)
  assert.equal(candidato.status, 'indicado')
  assert.equal((await db.collection('indicacoes').get()).size, 1)
  assert.equal((await db.collection('historicoProcesso').get()).size, 1)
  assert.equal((await db.collection('notificacoes').get()).size, 2)
  assert.equal((await db.doc(`analisesIndicacao/${result.id}`).get()).data().notaPrecisa, 50)
})

test('notas e sinalizadores forjados sao ignorados; bloqueio nao gera efeitos', async () => {
  await db.doc('vagas/vaga-1').update({ 'rubricaCompatibilidade.requisitosObrigatorios': ['React', 'Python'] })
  const analise = await service.analisar('indicador-1', payload({ nota: 100, podeIndicar: true, dados: { ...dados, nota: 100 } }))
  assert.equal(analise.resultado.notaPrecisa, 25)
  assert.equal(analise.resultado.podeIndicar, false)
  assert.equal(analise.analiseId, undefined)
  await assert.rejects(enviar({ analiseId: 'forjada', resultado: { nota: 100 } }), falha('analise_desatualizada'))
  await semProcesso()
})

test('identidade, propriedade, campos obrigatorios e vaga aberta sao validados', async () => {
  await assert.rejects(service.analisar('', payload()), falha('sessao_expirada'))
  await assert.rejects(service.analisar('empresa-1', payload()), falha('acesso_negado'))
  await assert.rejects(service.analisar('indicador-1', payload({ dados: { ...dados, email: '' } })), falha('campos_obrigatorios'))
  await db.doc('candidatosPreSalvos/pre-1').set({ indicadorId: 'outro' })
  await assert.rejects(service.analisar('indicador-1', payload({ candidatoPreSalvoId: 'pre-1' })), falha('acesso_negado'))
  await db.doc('vagas/vaga-1').update({ expiraEm: Timestamp.fromMillis(time - 1) })
  await assert.rejects(service.analisar('indicador-1', payload()), falha('vaga_fechada'))
  await semProcesso()
})

test('alteracoes de dados, vaga, versao do motor ou expiracao invalidam a analise', async () => {
  const analise = await service.analisar('indicador-1', payload())
  await assert.rejects(enviar(analise, { dados: { ...dados, hardSkills: ['Python'] } }), falha('analise_desatualizada'))
  await assert.rejects(enviar(analise, { dados: { ...dados, nome: 'Outra pessoa' } }), falha('analise_desatualizada'))
  await assert.rejects(enviar(analise, { vagaId: 'vaga-2' }), falha('analise_desatualizada'))
  await db.doc('vagas/vaga-1').update({ titulo: 'Vaga alterada' })
  await assert.rejects(enviar(analise), falha('analise_desatualizada'))
  const nova = await service.analisar('indicador-1', payload())
  await db.doc(`validacoesIndicacao/${nova.analiseId}`).update({ 'resultado.versao': 'anterior' })
  await assert.rejects(enviar(nova), falha('analise_desatualizada'))
  const expirada = await service.analisar('indicador-1', payload())
  time += 31 * 60 * 1000
  await assert.rejects(enviar(expirada), falha('analise_desatualizada'))
  await semProcesso()
})

test('mudanca no pre-salvo invalida; mesmo candidato pode ir para vagas diferentes', async () => {
  await db.doc('candidatosPreSalvos/pre-1').set({ ...dados, indicadorId: 'indicador-1' })
  const prePayload = payload({ candidatoPreSalvoId: 'pre-1' })
  const analise = await service.analisar('indicador-1', prePayload)
  await db.doc('candidatosPreSalvos/pre-1').update({ hardSkills: ['Python'] })
  await assert.rejects(enviar(analise, { candidatoPreSalvoId: 'pre-1' }), falha('analise_desatualizada'))
  const nova = await service.analisar('indicador-1', prePayload)
  await enviar(nova, { candidatoPreSalvoId: 'pre-1' })
  await db.doc('vagas/vaga-2').set(perfilVaga())
  const outra = await service.analisar('indicador-1', { ...prePayload, vagaId: 'vaga-2' })
  await enviar(outra, { candidatoPreSalvoId: 'pre-1', vagaId: 'vaga-2' })
  assert.equal((await db.collection('indicacoes').get()).size, 2)
})

test('envios concorrentes e repetidos sao idempotentes', async () => {
  const analise = await service.analisar('indicador-1', payload())
  const resultados = await Promise.all([enviar(analise), enviar(analise), enviar(analise)])
  assert.equal(new Set(resultados.map((r) => r.id)).size, 1)
  const nova = await service.analisar('indicador-1', payload())
  await assert.rejects(enviar(nova), falha('indicacao_duplicada'))
  assert.equal((await db.collection('candidatos').get()).size, 1)
  assert.equal((await db.collection('historicoProcesso').get()).size, 1)
  assert.equal((await db.collection('notificacoes').get()).size, 2)
})

test('duas analises concorrentes do mesmo candidato geram apenas uma indicacao', async () => {
  const analises = await Promise.all([service.analisar('indicador-1', payload()), service.analisar('indicador-1', payload())])
  const results = await Promise.allSettled(analises.map((a) => enviar(a)))
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(results.find((r) => r.status === 'rejected').reason.details.motivo, 'indicacao_duplicada')
  assert.equal((await db.collection('candidatos').get()).size, 1)
})

test('vaga fechada apos previa bloqueia envio e nenhuma analise alheia pode autorizar', async () => {
  const analise = await service.analisar('indicador-1', payload())
  await assert.rejects(service.finalizar('outro', payload({ analiseId: analise.analiseId })), falha('analise_desatualizada'))
  await db.doc('vagas/vaga-1').update({ status: 'pausada' })
  await assert.rejects(enviar(analise), falha('vaga_fechada'))
  await semProcesso()
})

test('falha de extracao e arquivo alheio nao liberam indicacao', async () => {
  await assert.rejects(service.analisar('indicador-1', payload({ curriculoCaminho: 'curriculos/outro/pre-salvos/pre/cv.pdf' })), falha('acesso_negado'))
  const bucket = { file: () => ({
    getMetadata: async () => [{ size: '40', generation: '1', contentType: 'application/pdf', metadata: { indicadorId: 'indicador-1' } }],
    download: async () => [Buffer.from('arquivo ilegivel')]
  }) }
  const servicoArquivo = criarServicoIndicacoes({ db, bucket })
  await assert.rejects(servicoArquivo.analisar('indicador-1', payload({ curriculoCaminho: 'curriculos/indicador-1/temporarios/pre/cv.pdf' })), falha('extracao_falhou'))
  await semProcesso()
})

test('curriculo analisado e preservado e troca do arquivo invalida a autorizacao', async () => {
  const fonte = 'curriculos/indicador-1/temporarios/pre/cv.pdf'
  const files = new Map([[fonte, {
    bytes: Buffer.from('Desenvolvedor React com experiencia profissional.'),
    meta: { size: '49', generation: '1', contentType: 'application/pdf', metadata: { indicadorId: 'indicador-1', nomeOriginal: 'cv.pdf' } }
  }]])
  const bucket = { file: (name) => ({
    getMetadata: async () => [files.get(name).meta],
    download: async () => [files.get(name).bytes],
    save: async (bytes, options) => { files.set(name, { bytes, meta: options.metadata }) },
    delete: async () => { files.delete(name) }
  }) }
  const servico = criarServicoIndicacoes({ db, bucket, extrair: async (bytes) => ({ texto: bytes.toString(), metodo: 'pdf_texto_servidor', paginas: 1 }) })
  const entrada = payload({ curriculoCaminho: fonte, textoCurriculo: 'Python falso do navegador' })
  const analise = await servico.analisar('indicador-1', entrada)
  assert.equal(analise.resultado.notaPrecisa, 100)
  files.get(fonte).meta.generation = '2'
  await assert.rejects(servico.finalizar('indicador-1', { ...entrada, analiseId: analise.analiseId }), falha('analise_desatualizada'))
  await semProcesso()
  const nova = await servico.analisar('indicador-1', entrada)
  const result = await servico.finalizar('indicador-1', { ...entrada, analiseId: nova.analiseId })
  const candidato = (await db.doc(`candidatos/${result.id}`).get()).data()
  assert.notEqual(candidato.curriculo.caminho, fonte)
  assert.deepEqual(files.get(candidato.curriculo.caminho).bytes, files.get(fonte).bytes)
  assert.equal(candidato.compatibilidadeIndicacao.curriculoHash, candidato.curriculo.hash)
})

test('snapshot da indicacao persiste apos uma nova analise do ranking', async () => {
  const analise = await service.analisar('indicador-1', payload())
  const result = await enviar(analise)
  await db.doc(`analisesCompatibilidade/vaga-1__${result.id}`).set({ nota: 10 })
  assert.equal((await db.doc(`analisesIndicacao/${result.id}`).get()).data().notaPrecisa, 50)
})
