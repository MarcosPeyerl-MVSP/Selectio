import fs from 'node:fs'
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'

const projectId = 'selectio-1f022'
const rules = fs.readFileSync('firestore.rules', 'utf8')

let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules }
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await Promise.all([
      setDoc(doc(db, 'empresas', 'empresa-1'), {
        uid: 'empresa-1',
        firebaseUid: 'empresa-1',
        tipo: 'empresa'
      }),
      setDoc(doc(db, 'indicadores', 'indicador-1'), {
        uid: 'indicador-1',
        firebaseUid: 'indicador-1',
        tipo: 'indicador'
      }),
      setDoc(doc(db, 'indicadores', 'indicador-2'), {
        uid: 'indicador-2',
        firebaseUid: 'indicador-2',
        tipo: 'indicador'
      }),
      setDoc(doc(db, 'users', 'admin-1'), {
        uid: 'admin-1',
        tipo: 'admin',
        email: 'admin@selectio.test'
      }),
      setDoc(doc(db, 'users', 'admin-role'), {
        uid: 'admin-role',
        tipo: 'empresa',
        role: 'admin',
        email: 'admin-role@selectio.test'
      }),
      setDoc(doc(db, 'users', 'admin-papel'), {
        uid: 'admin-papel',
        tipo: 'indicador',
        papel: 'admin',
        email: 'admin-papel@selectio.test'
      }),
      setDoc(doc(db, 'vagas', 'vaga-1'), {
        empresaId: 'empresa-1',
        empresaUid: 'empresa-1',
        titulo: 'Desenvolvedor',
        status: 'aberta',
        expiraEm: Timestamp.fromMillis(Date.now() + 86_400_000)
      }),
      setDoc(doc(db, 'vagas', 'vaga-2'), {
        empresaId: 'empresa-1',
        empresaUid: 'empresa-1',
        titulo: 'Desenvolvedor Front-end',
        status: 'aberta',
        expiraEm: Timestamp.fromMillis(Date.now() + 86_400_000)
      })
    ])
  })
})

after(async () => {
  await testEnv.cleanup()
})

test('vagas continuam publicas para leitura', async () => {
  const db = testEnv.unauthenticatedContext().firestore()

  await assertSucceeds(getDoc(doc(db, 'vagas', 'vaga-1')))
})

test('indicador cria candidato, indicacao e historico no mesmo batch', async () => {
  const db = testEnv.authenticatedContext('indicador-1').firestore()
  const candidatoRef = doc(db, 'candidatos', 'candidato-batch')
  const indicacaoRef = doc(db, 'indicacoes', 'indicacao-batch')
  const historicoRef = doc(db, 'historicoProcesso', 'historico-batch')
  const batch = writeBatch(db)

  batch.set(candidatoRef, candidatoPayload())
  batch.set(indicacaoRef, indicacaoPayload())
  batch.set(historicoRef, historicoPayload())

  await assertSucceeds(batch.commit())
  await assertSucceeds(getDoc(candidatoRef))
  await assertSucceeds(getDoc(indicacaoRef))
  await assertSucceeds(getDoc(historicoRef))
})

test('criacao da indicacao falha quando o candidato nao faz parte do batch', async () => {
  const db = testEnv.authenticatedContext('indicador-1').firestore()

  await assertFails(setDoc(
    doc(db, 'indicacoes', 'indicacao-sem-candidato'),
    indicacaoPayload({ candidatoId: 'candidato-inexistente' })
  ))
})

test('indicador proprietario cria, le, atualiza e exclui candidato pre-salvo', async () => {
  const db = testEnv.authenticatedContext('indicador-1').firestore()
  const candidatoRef = doc(db, 'candidatosPreSalvos', 'pre-salvo-crud')

  await assertSucceeds(setDoc(
    candidatoRef,
    candidatoPreSalvoPayload({ id: 'pre-salvo-crud' })
  ))
  await assertSucceeds(getDoc(candidatoRef))
  await assertSucceeds(updateDoc(candidatoRef, {
    nome: 'Pessoa Candidata Atualizada',
    updatedAt: serverTimestamp()
  }))
  await assertSucceeds(deleteDoc(candidatoRef))
})

test('candidatos pre-salvos ficam privados ao indicador proprietario', async () => {
  await criarCandidatoPreSalvoComRegras('pre-salvo-privado')

  const outroIndicadorDb = testEnv.authenticatedContext('indicador-2').firestore()
  const empresaDb = testEnv.authenticatedContext('empresa-1').firestore()
  const adminDb = testEnv.authenticatedContext('admin-1').firestore()
  const anonimoDb = testEnv.unauthenticatedContext().firestore()

  await assertFails(getDoc(doc(outroIndicadorDb, 'candidatosPreSalvos', 'pre-salvo-privado')))
  await assertFails(getDoc(doc(empresaDb, 'candidatosPreSalvos', 'pre-salvo-privado')))
  await assertFails(getDoc(doc(adminDb, 'candidatosPreSalvos', 'pre-salvo-privado')))
  await assertFails(getDoc(doc(anonimoDb, 'candidatosPreSalvos', 'pre-salvo-privado')))
  await assertFails(updateDoc(
    doc(outroIndicadorDb, 'candidatosPreSalvos', 'pre-salvo-privado'),
    { nome: 'Acesso indevido', updatedAt: serverTimestamp() }
  ))
  await assertFails(deleteDoc(doc(empresaDb, 'candidatosPreSalvos', 'pre-salvo-privado')))
})

test('consulta de candidatos pre-salvos exige filtro pelo indicador autenticado', async () => {
  await Promise.all([
    criarCandidatoPreSalvoComRegras('pre-salvo-lista-1'),
    criarCandidatoPreSalvoComRegras('pre-salvo-lista-2')
  ])

  const db = testEnv.authenticatedContext('indicador-1').firestore()

  await assertSucceeds(getDocs(query(
    collection(db, 'candidatosPreSalvos'),
    where('indicadorId', '==', 'indicador-1')
  )))
  await assertFails(getDocs(collection(db, 'candidatosPreSalvos')))
  await assertFails(getDocs(query(
    collection(db, 'candidatosPreSalvos'),
    where('indicadorId', '==', 'indicador-2')
  )))
})

test('busca individual filtrada pelo dono retorna vazio sem erro para id inexistente', async () => {
  const db = testEnv.authenticatedContext('indicador-1').firestore()
  const snapshot = await assertSucceeds(getDocs(query(
    collection(db, 'candidatosPreSalvos'),
    where('indicadorId', '==', 'indicador-1'),
    where(documentId(), '==', 'pre-salvo-inexistente'),
    limit(1)
  )))

  assert.equal(snapshot.empty, true)
})

test('candidato pre-salvo rejeita dono, id, origem e timestamps forjados', async () => {
  const db = testEnv.authenticatedContext('indicador-1').firestore()

  await assertFails(setDoc(
    doc(db, 'candidatosPreSalvos', 'pre-salvo-dono-forjado'),
    candidatoPreSalvoPayload({
      id: 'pre-salvo-dono-forjado',
      indicadorId: 'indicador-2',
      indicadorUid: 'indicador-2'
    })
  ))
  await assertFails(setDoc(
    doc(db, 'candidatosPreSalvos', 'pre-salvo-id-forjado'),
    candidatoPreSalvoPayload({ id: 'outro-id' })
  ))
  await assertFails(setDoc(
    doc(db, 'candidatosPreSalvos', 'pre-salvo-origem-forjada'),
    candidatoPreSalvoPayload({
      id: 'pre-salvo-origem-forjada',
      origem: 'indicacao'
    })
  ))
  await assertFails(setDoc(
    doc(db, 'candidatosPreSalvos', 'pre-salvo-tempo-forjado'),
    candidatoPreSalvoPayload({
      id: 'pre-salvo-tempo-forjado',
      createdAt: Timestamp.fromMillis(Date.now() - 60_000)
    })
  ))
})

test('indicacao nao referencia candidato pre-salvo de outro indicador', async () => {
  const outroIndicadorDb = testEnv.authenticatedContext('indicador-2').firestore()
  await assertSucceeds(setDoc(
    doc(outroIndicadorDb, 'candidatosPreSalvos', 'pre-salvo-alheio'),
    candidatoPreSalvoPayload({
      id: 'pre-salvo-alheio',
      indicadorId: 'indicador-2',
      indicadorUid: 'indicador-2'
    })
  ))

  const db = testEnv.authenticatedContext('indicador-1').firestore()

  await assertFails(setDoc(
    doc(db, 'candidatos', 'candidato-ref-alheia'),
    candidatoPayload({ candidatoPreSalvoId: 'pre-salvo-alheio' })
  ))
})

test('snapshot de candidato pre-salvo exige indicacao canonica no mesmo batch', async () => {
  await criarCandidatoPreSalvoComRegras('pre-salvo-sem-indicacao')
  const db = testEnv.authenticatedContext('indicador-1').firestore()

  await assertFails(setDoc(
    doc(db, 'candidatos', 'candidato-pre-salvo-orfao'),
    candidatoPayload({ candidatoPreSalvoId: 'pre-salvo-sem-indicacao' })
  ))
})

test('mesmo candidato pre-salvo nao pode ser indicado duas vezes para a mesma vaga', async () => {
  await criarCandidatoPreSalvoComRegras('pre-salvo-unico')
  await assertSucceeds(criarIndicacaoPreSalvaBatch({
    candidatoId: 'candidato-pre-salvo-1',
    candidatoPreSalvoId: 'pre-salvo-unico',
    historicoId: 'historico-pre-salvo-1',
    indicacaoId: 'indicador-1__vaga-1__pre-salvo-unico'
  }).commit())

  await assertFails(criarIndicacaoPreSalvaBatch({
    candidatoId: 'candidato-pre-salvo-duplicado',
    candidatoPreSalvoId: 'pre-salvo-unico',
    historicoId: 'historico-pre-salvo-duplicado',
    indicacaoId: 'indicador-1__vaga-1__pre-salvo-unico'
  }).commit())

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(doc(
      context.firestore(),
      'candidatos',
      'candidato-pre-salvo-duplicado'
    ))
    assert.equal(snapshot.exists(), false)
  })
})

test('mesmo candidato pre-salvo pode ser indicado para vagas diferentes', async () => {
  await criarCandidatoPreSalvoComRegras('pre-salvo-multivaga')

  await assertSucceeds(criarIndicacaoPreSalvaBatch({
    candidatoId: 'candidato-multivaga-1',
    candidatoPreSalvoId: 'pre-salvo-multivaga',
    historicoId: 'historico-multivaga-1',
    indicacaoId: 'indicador-1__vaga-1__pre-salvo-multivaga'
  }).commit())
  await assertSucceeds(criarIndicacaoPreSalvaBatch({
    candidatoId: 'candidato-multivaga-2',
    candidatoPreSalvoId: 'pre-salvo-multivaga',
    historicoId: 'historico-multivaga-2',
    indicacaoId: 'indicador-1__vaga-2__pre-salvo-multivaga',
    vagaId: 'vaga-2',
    vagaTitulo: 'Desenvolvedor Front-end'
  }).commit())
})

test('indicacao mantem master privado e libera apenas snapshot para empresa', async () => {
  await criarCandidatoPreSalvoComRegras('pre-salvo-snapshot')
  await assertSucceeds(criarIndicacaoPreSalvaBatch({
    candidatoId: 'candidato-snapshot',
    candidatoPreSalvoId: 'pre-salvo-snapshot',
    historicoId: 'historico-snapshot',
    indicacaoId: 'indicador-1__vaga-1__pre-salvo-snapshot'
  }).commit())

  const indicadorDb = testEnv.authenticatedContext('indicador-1').firestore()
  const empresaDb = testEnv.authenticatedContext('empresa-1').firestore()

  await assertSucceeds(getDoc(doc(
    indicadorDb,
    'candidatosPreSalvos',
    'pre-salvo-snapshot'
  )))
  await assertFails(getDoc(doc(
    empresaDb,
    'candidatosPreSalvos',
    'pre-salvo-snapshot'
  )))
  await assertSucceeds(getDoc(doc(empresaDb, 'candidatos', 'candidato-snapshot')))
})

test('empresa atualiza candidato e indicacao atomicamente', async () => {
  await criarProcessoSeletivo()

  const db = testEnv.authenticatedContext('empresa-1').firestore()
  const batch = writeBatch(db)

  batch.update(doc(db, 'candidatos', 'candidato-1'), {
    status: 'entrevista',
    atualizadoEm: serverTimestamp()
  })
  batch.update(doc(db, 'indicacoes', 'indicacao-1'), {
    status: 'entrevista',
    atualizadoEm: serverTimestamp()
  })
  batch.set(
    doc(db, 'historicoProcesso', 'historico-status'),
    historicoPayload({
      candidatoId: 'candidato-1',
      tipo: 'status_alterado',
      titulo: 'Candidato avançou para entrevista',
      statusAnterior: 'indicado',
      statusAtual: 'entrevista',
      criadoPor: 'empresa-1'
    })
  )

  await assertSucceeds(batch.commit())
})

test('vaga pausada ou expirada nao aceita novos candidatos', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await Promise.all([
      updateDoc(doc(db, 'vagas', 'vaga-1'), { status: 'pausada' }),
      setDoc(doc(db, 'vagas', 'vaga-expirada'), {
        empresaId: 'empresa-1',
        empresaUid: 'empresa-1',
        titulo: 'Vaga expirada',
        status: 'aberta',
        expiraEm: Timestamp.fromMillis(Date.now() - 60_000)
      })
    ])
  })

  const db = testEnv.authenticatedContext('indicador-1').firestore()

  await assertFails(setDoc(
    doc(db, 'candidatos', 'candidato-vaga-pausada'),
    candidatoPayload()
  ))
  await assertFails(setDoc(
    doc(db, 'candidatos', 'candidato-vaga-expirada'),
    candidatoPayload({ vagaId: 'vaga-expirada' })
  ))
})

test('vaga pausada nao aceita nova indicacao para candidato existente', async () => {
  await criarProcessoSeletivo()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'vagas', 'vaga-1'), { status: 'pausada' })
  })

  const db = testEnv.authenticatedContext('indicador-1').firestore()

  await assertFails(setDoc(
    doc(db, 'indicacoes', 'indicacao-duplicada'),
    indicacaoPayload({ candidatoId: 'candidato-1' })
  ))
})

test('empresa altera apenas para status validos de vaga', async () => {
  const db = testEnv.authenticatedContext('empresa-1').firestore()

  await assertSucceeds(updateDoc(doc(db, 'vagas', 'vaga-1'), {
    status: 'pausada'
  }))
  await assertFails(updateDoc(doc(db, 'vagas', 'vaga-1'), {
    status: 'rascunho'
  }))
})

test('historico pode ser lido pelos participantes e nao pode ser alterado', async () => {
  await criarProcessoSeletivo()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(
      doc(db, 'historicoProcesso', 'historico-1'),
      historicoPayload({ candidatoId: 'candidato-1' })
    )
  })

  const indicadorDb = testEnv.authenticatedContext('indicador-1').firestore()
  const externoDb = testEnv.authenticatedContext('usuario-externo').firestore()
  const historicoRef = doc(indicadorDb, 'historicoProcesso', 'historico-1')

  await assertSucceeds(getDoc(historicoRef))
  await assertFails(getDoc(doc(externoDb, 'historicoProcesso', 'historico-1')))
  await assertFails(updateDoc(historicoRef, { titulo: 'Evento alterado' }))
})

test('historico nao pode ser criado sem a alteracao correspondente', async () => {
  await criarProcessoSeletivo()

  const db = testEnv.authenticatedContext('empresa-1').firestore()

  await assertFails(setDoc(
    doc(db, 'historicoProcesso', 'historico-solto'),
    historicoPayload({
      candidatoId: 'candidato-1',
      tipo: 'status_alterado',
      titulo: 'Evento sem alteração',
      statusAnterior: 'indicado',
      statusAtual: 'contratado',
      criadoPor: 'empresa-1'
    })
  ))
})

test('empresa registra criacao e conclusao de entrevista com historico', async () => {
  await criarProcessoSeletivo()

  const db = testEnv.authenticatedContext('empresa-1').firestore()
  const entrevistaRef = doc(db, 'entrevistas', 'entrevista-1')
  const criarBatch = writeBatch(db)

  criarBatch.set(entrevistaRef, entrevistaPayload())
  criarBatch.set(
    doc(db, 'historicoProcesso', 'historico-entrevista-criada'),
    historicoPayload({
      candidatoId: 'candidato-1',
      entrevistaId: 'entrevista-1',
      tipo: 'entrevista_agendada',
      titulo: 'Entrevista agendada',
      statusAtual: 'agendada',
      criadoPor: 'empresa-1'
    })
  )
  await assertSucceeds(criarBatch.commit())

  const concluirBatch = writeBatch(db)
  concluirBatch.update(entrevistaRef, {
    status: 'realizada',
    atualizadoEm: serverTimestamp()
  })
  concluirBatch.set(
    doc(db, 'historicoProcesso', 'historico-entrevista-realizada'),
    historicoPayload({
      candidatoId: 'candidato-1',
      entrevistaId: 'entrevista-1',
      tipo: 'entrevista_realizada',
      titulo: 'Entrevista realizada',
      statusAnterior: 'agendada',
      statusAtual: 'realizada',
      criadoPor: 'empresa-1'
    })
  )
  await assertSucceeds(concluirBatch.commit())
})

test('indicador nao altera o status do candidato', async () => {
  await criarProcessoSeletivo()

  const db = testEnv.authenticatedContext('indicador-1').firestore()

  await assertFails(updateDoc(doc(db, 'candidatos', 'candidato-1'), {
    status: 'contratado',
    atualizadoEm: serverTimestamp()
  }))
})

test('usuario sem vinculo nao le candidato de terceiros', async () => {
  await criarProcessoSeletivo()

  const db = testEnv.authenticatedContext('usuario-externo').firestore()

  await assertFails(getDoc(doc(db, 'candidatos', 'candidato-1')))
})

test('admin le colecoes globais sem receber permissao de escrita', async () => {
  await criarProcessoSeletivo()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await Promise.all([
      setDoc(doc(db, 'pagamentos', 'pagamento-admin'), {
        empresaId: 'empresa-1',
        indicadorId: 'indicador-1',
        candidatoId: 'candidato-1',
        vagaId: 'vaga-1',
        status: 'approved',
        valor: 500
      }),
      setDoc(doc(db, 'saques', 'saque-admin'), {
        indicadorId: 'indicador-1',
        status: 'solicitado',
        valor: 200
      }),
      setDoc(doc(db, 'indicadorSaldos', 'indicador-1'), {
        indicadorId: 'indicador-1',
        saldoDisponivel: 300,
        saldoPendente: 200
      }),
      setDoc(doc(db, 'movimentacoesFinanceiras', 'movimentacao-admin'), {
        indicadorId: 'indicador-1',
        empresaId: 'empresa-1',
        tipo: 'credito_recompensa',
        status: 'approved',
        valor: 500
      })
    ])
  })

  const db = testEnv.authenticatedContext('admin-1').firestore()

  await assertSucceeds(getDocs(collection(db, 'empresas')))
  await assertSucceeds(getDocs(collection(db, 'users')))
  await assertSucceeds(getDocs(collection(db, 'indicadores')))
  await assertSucceeds(getDocs(collection(db, 'candidatos')))
  await assertSucceeds(getDocs(collection(db, 'pagamentos')))
  await assertSucceeds(getDocs(collection(db, 'saques')))
  await assertSucceeds(getDocs(collection(db, 'indicadorSaldos')))
  await assertSucceeds(getDocs(collection(db, 'movimentacoesFinanceiras')))
  await assertFails(updateDoc(doc(db, 'candidatos', 'candidato-1'), {
    status: 'contratado',
    atualizadoEm: serverTimestamp()
  }))
  await assertFails(setDoc(doc(db, 'pagamentos', 'pagamento-manual-admin'), {
    empresaId: 'empresa-1',
    indicadorId: 'indicador-1',
    candidatoId: 'candidato-1',
    vagaId: 'vaga-1',
    status: 'approved',
    valor: 500
  }))
})

test('campos role e papel tambem liberam somente leitura administrativa', async () => {
  const roleDb = testEnv.authenticatedContext('admin-role').firestore()
  const papelDb = testEnv.authenticatedContext('admin-papel').firestore()

  await assertSucceeds(getDocs(collection(roleDb, 'empresas')))
  await assertSucceeds(getDocs(collection(papelDb, 'indicadores')))
  await assertFails(setDoc(doc(roleDb, 'pagamentos', 'pagamento-role-admin'), {
    empresaId: 'empresa-1',
    indicadorId: 'indicador-1',
    status: 'approved',
    valor: 100
  }))
})

test('usuario nao pode se promover para admin durante o cadastro', async () => {
  const db = testEnv.authenticatedContext('usuario-malicioso').firestore()

  await assertFails(setDoc(doc(db, 'users', 'usuario-malicioso'), {
    uid: 'usuario-malicioso',
    tipo: 'empresa',
    role: 'admin',
    email: 'malicioso@example.com'
  }))
  await assertFails(setDoc(doc(db, 'users', 'usuario-malicioso'), {
    uid: 'usuario-malicioso',
    tipo: 'indicador',
    papel: 'admin',
    email: 'malicioso@example.com'
  }))
})

test('usuario existente nao pode se promover para admin por atualizacao', async () => {
  const db = testEnv.authenticatedContext('usuario-comum').firestore()
  const userRef = doc(db, 'users', 'usuario-comum')

  await assertSucceeds(setDoc(userRef, {
    uid: 'usuario-comum',
    tipo: 'empresa',
    email: 'usuario@example.com'
  }))
  await assertFails(updateDoc(userRef, { role: 'admin' }))
  await assertFails(updateDoc(userRef, { papel: 'admin' }))
  await assertFails(updateDoc(userRef, { tipo: 'admin' }))
})

test('empresa e indicador nao fazem consultas administrativas globais', async () => {
  const empresaDb = testEnv.authenticatedContext('empresa-1').firestore()
  const indicadorDb = testEnv.authenticatedContext('indicador-1').firestore()

  await assertFails(getDocs(collection(empresaDb, 'indicadores')))
  await assertFails(getDocs(collection(indicadorDb, 'empresas')))
  await assertFails(getDocs(collection(empresaDb, 'saques')))
})

test('cliente nao cria registros financeiros diretamente', async () => {
  const db = testEnv.authenticatedContext('empresa-1').firestore()

  await assertFails(setDoc(doc(db, 'pagamentos', 'pagamento-1'), {
    empresaId: 'empresa-1',
    indicadorId: 'indicador-1',
    candidatoId: 'candidato-1',
    vagaId: 'vaga-1',
    status: 'created',
    valor: 500
  }))
})

async function criarProcessoSeletivo() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await Promise.all([
      setDoc(doc(db, 'candidatos', 'candidato-1'), candidatoPayload()),
      setDoc(doc(db, 'indicacoes', 'indicacao-1'), indicacaoPayload({
        candidatoId: 'candidato-1'
      }))
    ])
  })
}

async function criarCandidatoPreSalvoComRegras(candidatoId) {
  const db = testEnv.authenticatedContext('indicador-1').firestore()

  return setDoc(
    doc(db, 'candidatosPreSalvos', candidatoId),
    candidatoPreSalvoPayload({ id: candidatoId })
  )
}

function criarIndicacaoPreSalvaBatch({
  candidatoId,
  candidatoPreSalvoId,
  historicoId,
  indicacaoId,
  vagaId = 'vaga-1',
  vagaTitulo = 'Desenvolvedor'
}) {
  const db = testEnv.authenticatedContext('indicador-1').firestore()
  const batch = writeBatch(db)

  batch.set(
    doc(db, 'candidatos', candidatoId),
    candidatoPayload({ candidatoPreSalvoId, vagaId })
  )
  batch.set(
    doc(db, 'indicacoes', indicacaoId),
    indicacaoPayload({ candidatoId, candidatoPreSalvoId, vagaId })
  )
  batch.set(
    doc(db, 'historicoProcesso', historicoId),
    historicoPayload({ candidatoId, vagaId, vagaTitulo })
  )

  return batch
}

function candidatoPreSalvoPayload(overrides = {}) {
  return {
    id: 'pre-salvo-1',
    indicadorId: 'indicador-1',
    indicadorUid: 'indicador-1',
    nome: 'Pessoa Pre-salva',
    email: 'pessoa.pre-salva@example.com',
    emailNormalizado: 'pessoa.pre-salva@example.com',
    hardSkills: ['React'],
    softSkills: ['Comunicacao'],
    curriculo: {},
    origem: 'manual',
    status: 'pre_salvo',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  }
}

function candidatoPayload(overrides = {}) {
  return {
    nome: 'Pessoa Candidata',
    empresaId: 'empresa-1',
    empresaUid: 'empresa-1',
    indicadorId: 'indicador-1',
    indicadorUid: 'indicador-1',
    vagaId: 'vaga-1',
    status: 'indicado',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    ...overrides
  }
}

function indicacaoPayload(overrides = {}) {
  return {
    candidatoId: 'candidato-batch',
    empresaId: 'empresa-1',
    empresaUid: 'empresa-1',
    indicadorId: 'indicador-1',
    indicadorUid: 'indicador-1',
    vagaId: 'vaga-1',
    status: 'indicado',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    ...overrides
  }
}

function historicoPayload(overrides = {}) {
  return {
    candidatoId: 'candidato-batch',
    candidatoNome: 'Pessoa Candidata',
    vagaId: 'vaga-1',
    vagaTitulo: 'Desenvolvedor',
    empresaId: 'empresa-1',
    indicadorId: 'indicador-1',
    entrevistaId: '',
    tipo: 'indicacao_criada',
    titulo: 'Candidato indicado',
    descricao: 'Indicação criada para a vaga.',
    statusAnterior: '',
    statusAtual: 'indicado',
    criadoPor: 'indicador-1',
    criadoEm: serverTimestamp(),
    ...overrides
  }
}

function entrevistaPayload(overrides = {}) {
  return {
    candidatoId: 'candidato-1',
    candidatoNome: 'Pessoa Candidata',
    candidatoEmail: 'pessoa@example.com',
    vagaId: 'vaga-1',
    vagaTitulo: 'Desenvolvedor',
    empresaId: 'empresa-1',
    empresaNome: 'Empresa',
    indicadorId: 'indicador-1',
    indicadorNome: 'Indicador',
    data: '2026-06-20',
    horaInicio: '10:00',
    horaFim: '10:45',
    duracaoMinutos: 45,
    status: 'agendada',
    meetTitulo: 'Entrevista',
    meetUrl: '',
    calendarUrl: '',
    observacoes: '',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    ...overrides
  }
}
