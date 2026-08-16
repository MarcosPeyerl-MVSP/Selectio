import fs from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'

const projectId = 'selectio-1f022'
const firestoreRules = fs.readFileSync('firestore.rules', 'utf8')
const storageRules = fs.readFileSync('storage.rules', 'utf8')
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

let testEnv

const metadata = (tipoRegistro, registroId, contentType = 'application/pdf') => ({
  contentType,
  customMetadata: {
    indicadorId: 'indicador-1',
    registroId,
    tipoRegistro,
    nomeOriginal: 'curriculo.pdf',
    ...(tipoRegistro === 'candidatos' ? { empresaId: 'empresa-1' } : {})
  }
})

const photoMetadata = (customMetadata, contentType = 'image/jpeg') => ({
  contentType,
  customMetadata
})

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules }
  })
})

beforeEach(async () => {
  await Promise.all([testEnv.clearFirestore(), testEnv.clearStorage()])
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      db.doc('candidatos/candidato-1').set({
        indicadorId: 'indicador-1',
        empresaId: 'empresa-1'
      }),
      db.doc('users/admin-1').set({ tipo: 'admin' })
    ])
  })
})

after(async () => {
  await testEnv.cleanup()
})

test('indicador envia, le e remove o proprio curriculo pre-salvo', async () => {
  const arquivo = testEnv.authenticatedContext('indicador-1')
    .storage().ref('curriculos/indicador-1/pre-salvos/pre-1/arquivo.pdf')

  await assertSucceeds(arquivo.put(pdf, metadata('pre-salvos', 'pre-1')))
  await assertSucceeds(arquivo.getMetadata())
  await assertSucceeds(arquivo.delete())
})

test('anonimo, outro indicador e empresa nao acessam curriculo pre-salvo', async () => {
  const caminho = 'curriculos/indicador-1/pre-salvos/pre-1/arquivo.pdf'
  const dono = testEnv.authenticatedContext('indicador-1').storage().ref(caminho)
  await dono.put(pdf, metadata('pre-salvos', 'pre-1'))

  await assertFails(testEnv.unauthenticatedContext().storage().ref(caminho).getMetadata())
  await assertFails(testEnv.authenticatedContext('indicador-2').storage().ref(caminho).getMetadata())
  await assertFails(testEnv.authenticatedContext('empresa-1').storage().ref(caminho).getMetadata())
})

test('empresa do candidato e admin leem o curriculo indicado, terceiros nao', async () => {
  const caminho = 'curriculos/indicador-1/candidatos/candidato-1/arquivo.pdf'
  await testEnv.authenticatedContext('indicador-1').storage().ref(caminho)
    .put(pdf, metadata('candidatos', 'candidato-1'))

  await assertSucceeds(testEnv.authenticatedContext('empresa-1').storage().ref(caminho).getMetadata())
  await assertSucceeds(testEnv.authenticatedContext('admin-1').storage().ref(caminho).getMetadata())
  await assertFails(testEnv.authenticatedContext('empresa-2').storage().ref(caminho).getMetadata())
})

test('empresa pode baixar, mas nao alterar nem excluir o curriculo', async () => {
  const caminho = 'curriculos/indicador-1/candidatos/candidato-1/arquivo.pdf'
  await testEnv.authenticatedContext('indicador-1').storage().ref(caminho)
    .put(pdf, metadata('candidatos', 'candidato-1'))

  const empresaArquivo = testEnv.authenticatedContext('empresa-1').storage().ref(caminho)
  await assertSucceeds(empresaArquivo.getDownloadURL())
  await assertFails(empresaArquivo.put(pdf, metadata('candidatos', 'candidato-1')))
  await assertFails(empresaArquivo.delete())
})

test('rejeita tipo, metadados e tamanho invalidos no servidor', async () => {
  const storage = testEnv.authenticatedContext('indicador-1').storage()
  const base = 'curriculos/indicador-1/pre-salvos/pre-1'

  await assertFails(storage.ref(`${base}/imagem.png`).put(
    pdf,
    metadata('pre-salvos', 'pre-1', 'image/png')
  ))
  await assertFails(storage.ref(`${base}/forjado.pdf`).put(
    pdf,
    metadata('pre-salvos', 'outro-registro')
  ))
  await assertFails(storage.ref(`${base}/vazio.pdf`).put(
    new Uint8Array(),
    metadata('pre-salvos', 'pre-1')
  ))
  await assertFails(storage.ref('curriculos/indicador-1/candidatos/candidato-1/sem-empresa.pdf').put(
    pdf,
    {
      contentType: 'application/pdf',
      customMetadata: {
        indicadorId: 'indicador-1',
        registroId: 'candidato-1',
        tipoRegistro: 'candidatos',
        nomeOriginal: 'curriculo.pdf'
      }
    }
  ))
})

test('usuario autenticado gerencia a propria foto e outros apenas visualizam', async () => {
  const caminho = 'fotos-perfil/usuarios/indicador-1/foto.jpg'
  const dono = testEnv.authenticatedContext('indicador-1').storage().ref(caminho)
  const dados = photoMetadata({ uid: 'indicador-1', tipoRegistro: 'usuario', tipoPerfil: 'indicador' })

  await assertSucceeds(dono.put(image, dados))
  await assertSucceeds(testEnv.authenticatedContext('empresa-1').storage().ref(caminho).getMetadata())
  await assertFails(testEnv.unauthenticatedContext().storage().ref(caminho).getMetadata())
  await assertFails(testEnv.authenticatedContext('empresa-1').storage().ref(caminho).put(image, dados))
})

test('foto de candidato indicado e visivel apenas aos participantes', async () => {
  const caminho = 'fotos-perfil/candidatos/indicador-1/indicados/candidato-1/foto.webp'
  const dono = testEnv.authenticatedContext('indicador-1').storage().ref(caminho)
  await assertSucceeds(dono.put(image, photoMetadata({
    indicadorId: 'indicador-1',
    candidatoId: 'candidato-1',
    tipoRegistro: 'indicados',
    empresaId: 'empresa-1'
  }, 'image/webp')))

  await assertSucceeds(testEnv.authenticatedContext('empresa-1').storage().ref(caminho).getMetadata())
  await assertFails(testEnv.authenticatedContext('empresa-2').storage().ref(caminho).getMetadata())
  await assertFails(testEnv.authenticatedContext('empresa-1').storage().ref(caminho).delete())
})

test('foto pre-salva fica privada para o indicador e rejeita formato invalido', async () => {
  const caminho = 'fotos-perfil/candidatos/indicador-1/pre-salvos/candidato-1/foto.jpg'
  const dono = testEnv.authenticatedContext('indicador-1').storage().ref(caminho)
  const dados = {
    indicadorId: 'indicador-1',
    candidatoId: 'candidato-1',
    tipoRegistro: 'pre-salvos'
  }

  await assertSucceeds(dono.put(image, photoMetadata(dados)))
  await assertFails(testEnv.authenticatedContext('empresa-1').storage().ref(caminho).getMetadata())
  await assertFails(dono.put(image, photoMetadata(dados, 'image/gif')))
})
