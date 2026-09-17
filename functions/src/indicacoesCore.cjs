const { createHash, randomUUID } = require('node:crypto')
const path = require('node:path')
const { Worker } = require('node:worker_threads')
const { HttpsError } = require('firebase-functions/v2/https')
const { Timestamp } = require('firebase-admin/firestore')

const MAX_CURRICULO = 10 * 1024 * 1024
const CAMPOS = ['nome', 'email', 'telefone', 'dataNascimento', 'genero', 'cargoAtual',
  'anosExperiencia', 'escolaridade', 'proficienciaIdiomas', 'linkedin', 'portfolio', 'github',
  'pontosFortes', 'fitCultural', 'destaquesProjetos', 'narrativa', 'observacoesProfissionais',
  'expectativaSalarial', 'modeloTrabalho', 'avisoPrevio']
const erro = (motivo, message, code = 'failed-precondition') => new HttpsError(code, message, { motivo })
const stale = () => erro('analise_desatualizada', 'Os dados foram alterados ou a análise expirou. Analise novamente.')
const idValido = (id) => typeof id === 'string' && /^[\w-]{1,180}$/.test(id)
const hash = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex')
const versaoDocumento = (snapshot) => snapshot.updateTime?.toMillis() + ':' + snapshot.updateTime?.nanoseconds

function normalizarDados(dados = {}) {
  const result = {}
  for (const campo of CAMPOS) {
    if (dados[campo] != null && typeof dados[campo] !== 'string') throw erro('dados_invalidos', 'Dados do candidato inválidos.', 'invalid-argument')
    result[campo] = String(dados[campo] || '').trim()
    if (result[campo].length > 5000) throw erro('dados_invalidos', 'Um campo excedeu o limite de 5.000 caracteres.', 'invalid-argument')
  }
  result.email = result.email.toLowerCase()
  for (const campo of ['hardSkills', 'softSkills']) {
    const lista = dados[campo] || []
    if (!Array.isArray(lista) || lista.length > 100 || lista.some((v) => typeof v !== 'string' || v.length > 200)) {
      throw erro('dados_invalidos', 'Lista de habilidades inválida.', 'invalid-argument')
    }
    result[campo] = [...new Set(lista.map((v) => v.trim()).filter(Boolean))]
  }
  if (!result.nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) {
    throw erro('campos_obrigatorios', 'Informe nome e e-mail válido do candidato.', 'invalid-argument')
  }
  return result
}

function validarVaga(vaga, agora) {
  if (!vaga || !idValido(vaga.empresaId || vaga.empresaUid) || (vaga.status || 'aberta') !== 'aberta') {
    throw erro('vaga_fechada', 'Esta vaga não está aberta para indicações.')
  }
  const limite = vaga.expiraEm || vaga.dataLimite
  const millis = limite?.toMillis ? limite.toMillis() : Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(limite) ? `${limite}T23:59:59-03:00` : limite)
  if (limite && (!Number.isFinite(millis) || millis < agora)) throw erro('vaga_fechada', 'Esta vaga não está aberta para indicações.')
}

function extrairCurriculo(bytes, tipo) {
  if (!bytes?.length || bytes.length > MAX_CURRICULO) return Promise.reject(erro('curriculo_invalido', 'Curriculo invalido ou maior que 10 MB.'))
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'extracaoWorker.cjs'), {
      workerData: { bytes, tipo }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 }
    })
    const timer = setTimeout(() => finish(erro('curriculo_invalido', 'O curriculo excedeu o tempo de processamento.')), 15000)
    let encerrado = false
    function finish(error, value) {
      if (encerrado) return
      encerrado = true
      clearTimeout(timer)
      void worker.terminate()
      if (error) reject(error)
      else resolve(value)
    }
    worker.once('message', (result) => result.error
      ? finish(erro(result.error.motivo, result.error.message)) : finish(null, result.value))
    worker.once('error', () => finish(erro('extracao_falhou', 'Nao foi possivel processar o curriculo com seguranca.')))
    worker.once('exit', () => finish(erro('extracao_falhou', 'O processamento do curriculo foi interrompido.')))
  })
}

async function extrairCurriculoInterno(bytes, tipo) {
  try {
    let texto = ''
    let paginas = 0
    if (tipo === 'application/pdf') {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const standardFontDataUrl = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replaceAll('\\', '/') + '/'
      const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, standardFontDataUrl })
      try {
        const pdf = await task.promise
        paginas = pdf.numPages
        if (paginas > 50) throw erro('curriculo_invalido', 'Use um currículo com até 50 páginas.')
        for (let i = 1; i <= paginas; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          texto += content.items.map((item) => item.str || '').join(' ') + '\n'
          if (texto.length > 200000) throw erro('curriculo_invalido', 'O curriculo excede o limite de texto para analise.')
          page.cleanup()
        }
      } finally { await task.destroy() }
    } else if (tipo === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      texto = (await require('mammoth').extractRawText({ buffer: bytes })).value
    } else {
      throw erro('curriculo_invalido', 'Converta o currículo DOC para PDF com texto ou DOCX e tente novamente.')
    }
    if (texto.trim().length < 20) throw erro('extracao_falhou', 'Não foi possível ler o currículo. Envie PDF com texto selecionável ou DOCX.')
    if (texto.length > 200000) throw erro('curriculo_invalido', 'O currículo excede o limite de texto para análise.')
    return { texto, metodo: tipo === 'application/pdf' ? 'pdf_texto_servidor' : 'docx_servidor', paginas }
  } catch (error) {
    if (error instanceof HttpsError) throw error
    throw erro('extracao_falhou', 'Não foi possível ler o currículo. Envie PDF com texto selecionável ou DOCX.')
  }
}

function criarServicoIndicacoes({ db, bucket, extrair = extrairCurriculo, agora = Date.now }) {
  async function lerContexto(uid, payload, transaction) {
    if (!uid) throw erro('sessao_expirada', 'Entre novamente para continuar.', 'unauthenticated')
    if (!idValido(payload.vagaId) || (payload.candidatoPreSalvoId && !idValido(payload.candidatoPreSalvoId))) {
      throw erro('dados_invalidos', 'Vaga ou candidato inválido.', 'invalid-argument')
    }
    const get = (ref) => transaction ? transaction.get(ref) : ref.get()
    const indicador = await get(db.doc(`indicadores/${uid}`))
    if (!indicador.exists) throw erro('acesso_negado', 'Acesso restrito a indicadores.', 'permission-denied')
    const vaga = await get(db.doc(`vagas/${payload.vagaId}`))
    validarVaga(vaga.data(), agora())
    let preSalvo = null
    if (payload.candidatoPreSalvoId) {
      preSalvo = await get(db.doc(`candidatosPreSalvos/${payload.candidatoPreSalvoId}`))
      if (!preSalvo.exists || preSalvo.data().indicadorId !== uid) throw erro('acesso_negado', 'Candidato pré-salvo indisponível.', 'permission-denied')
    }
    return { indicador, vaga, preSalvo }
  }

  async function lerArquivo(uid, caminho, preSalvo) {
    if (!caminho) return null
    const partes = caminho.split('/')
    const temporario = partes.length === 5 && partes[0] === 'curriculos' && partes[1] === uid
      && partes[2] === 'temporarios' && idValido(partes[3]) && /^[\w.-]+$/.test(partes[4])
    const salvo = preSalvo?.data().curriculo?.caminho === caminho
      && caminho.startsWith(`curriculos/${uid}/pre-salvos/${preSalvo.id}/`)
    if (!temporario && !salvo) throw erro('acesso_negado', 'Currículo não autorizado.', 'permission-denied')
    const file = bucket.file(caminho)
    const [meta] = await file.getMetadata().catch(() => { throw stale() })
    if (meta.metadata?.indicadorId !== uid || Number(meta.size) <= 0 || Number(meta.size) > MAX_CURRICULO) {
      throw erro('curriculo_invalido', 'Currículo inválido ou maior que 10 MB.')
    }
    const [bytes] = await bucket.file(caminho, { generation: meta.generation }).download({ validation: 'crc32c' })
    return { bytes, caminho, generation: meta.generation, nome: String(meta.metadata?.nomeOriginal || 'curriculo').slice(0, 255), tipo: meta.contentType, tamanho: bytes.length, hash: hash(bytes) }
  }

  async function analisar(uid, payload) {
    const dados = normalizarDados(payload.dados)
    const contexto = await lerContexto(uid, payload)
    const fonteCurriculo = String(payload.curriculoCaminho || '')
    // A omissão de um currículo disponível no cadastro não pode evitar sua avaliação.
    if (!fonteCurriculo && contexto.preSalvo?.data().curriculo?.caminho) throw stale()
    const arquivo = await lerArquivo(uid, fonteCurriculo, contexto.preSalvo)
    const extracao = arquivo ? await extrair(arquivo.bytes, arquivo.tipo) : { texto: '', metodo: 'formulario', paginas: 0 }
    const { avaliarElegibilidadeIndicacao } = await import('../shared/elegibilidadeIndicacao.mjs')
    const resultado = avaliarElegibilidadeIndicacao({ candidato: dados, vaga: contexto.vaga.data(), textoCurriculo: extracao.texto, extracao })
    if (!resultado.analiseValida || !resultado.podeIndicar) return { resultado }
    const id = randomUUID()
    const expiraEm = Timestamp.fromMillis(agora() + 30 * 60 * 1000)
    const arquivoValidado = arquivo ? `validacoes-curriculos/${uid}/${id}/curriculo` : ''
    if (arquivo) await bucket.file(arquivoValidado).save(arquivo.bytes, { resumable: false, metadata: { contentType: arquivo.tipo } })
    try {
      await db.doc(`validacoesIndicacao/${id}`).create({
        indicadorId: uid, vagaId: payload.vagaId, candidatoPreSalvoId: payload.candidatoPreSalvoId || '',
        dados, assinaturaDados: hash(dados), resultado, vagaVersao: versaoDocumento(contexto.vaga),
        preSalvoVersao: contexto.preSalvo ? versaoDocumento(contexto.preSalvo) : '',
        fonteCurriculo, arquivoValidado, curriculo: arquivo ? {
          nome: arquivo.nome, tipo: arquivo.tipo, tamanho: arquivo.tamanho, hash: arquivo.hash, generation: arquivo.generation
        } : null,
        criadoEm: Timestamp.fromMillis(agora()), expiraEm, status: 'analisada'
      })
    } catch (error) {
      if (arquivoValidado) await bucket.file(arquivoValidado).delete({ ignoreNotFound: true }).catch(() => {})
      throw error
    }
    return { analiseId: id, resultado, expiraEm: expiraEm.toMillis() }
  }

  async function finalizar(uid, payload) {
    if (!uid) throw erro('sessao_expirada', 'Entre novamente para continuar.', 'unauthenticated')
    if (!idValido(payload.analiseId)) throw stale()
    const ref = db.doc(`validacoesIndicacao/${payload.analiseId}`)
    const snapshot = await ref.get()
    const analise = snapshot.data()
    if (!analise || analise.indicadorId !== uid) throw stale()
    const dados = normalizarDados(payload.dados)
    if (analise.vagaId !== payload.vagaId || analise.candidatoPreSalvoId !== (payload.candidatoPreSalvoId || '')
      || analise.assinaturaDados !== hash(dados) || analise.fonteCurriculo !== String(payload.curriculoCaminho || '')) throw stale()
    // A mesma requisição retorna o resultado já gravado, inclusive após expiração.
    if (analise.status === 'enviada') return { id: analise.candidatoId }
    const { ANALISE_VERSAO } = await import('../shared/motorCompatibilidade.mjs')
    const { notaPermiteIndicacao, REGRA_INDICACAO_VERSAO, LIMIAR_COMPATIBILIDADE_INDICACAO } = await import('../shared/elegibilidadeIndicacao.mjs')
    if (analise.expiraEm.toMillis() <= agora() || !analise.resultado.analiseValida || !notaPermiteIndicacao(analise.resultado.notaPrecisa)
      || analise.resultado.versao !== ANALISE_VERSAO || analise.resultado.regraVersao !== REGRA_INDICACAO_VERSAO) throw stale()
    await lerContexto(uid, payload)
    let curriculo = {}
    if (analise.arquivoValidado) {
      const [fonte] = await bucket.file(analise.fonteCurriculo).getMetadata().catch(() => { throw stale() })
      if (fonte.generation !== analise.curriculo.generation) throw stale()
      const [bytes] = await bucket.file(analise.arquivoValidado).download()
      if (hash(bytes) !== analise.curriculo.hash) throw stale()
      const extensao = analise.curriculo.tipo === 'application/pdf' ? 'pdf' : 'docx'
      const caminho = `curriculos/${uid}/candidatos/${snapshot.id}/curriculo.${extensao}`
      const vaga = (await db.doc(`vagas/${payload.vagaId}`).get()).data()
      await bucket.file(caminho).save(bytes, { resumable: false, metadata: {
        contentType: analise.curriculo.tipo, metadata: {
          indicadorId: uid, registroId: snapshot.id, tipoRegistro: 'candidatos',
          empresaId: vaga.empresaId || vaga.empresaUid, nomeOriginal: analise.curriculo.nome
        }
      } })
      curriculo = { ...analise.curriculo, caminho, status: 'disponivel' }
    }
    let fotoPerfil = {}
    if (payload.fotoPerfil?.caminho) {
      const caminho = String(payload.fotoPerfil.caminho)
      if (!caminho.startsWith(`fotos-perfil/candidatos/${uid}/indicados/${snapshot.id}/`)) {
        throw erro('acesso_negado', 'Foto não autorizada.', 'permission-denied')
      }
      const [meta] = await bucket.file(caminho).getMetadata()
      if (meta.metadata?.indicadorId !== uid || meta.metadata?.candidatoId !== snapshot.id || !['image/jpeg', 'image/png', 'image/webp'].includes(meta.contentType)) {
        throw erro('acesso_negado', 'Foto não autorizada.', 'permission-denied')
      }
      fotoPerfil = { caminho, nome: String(meta.metadata?.nomeOriginal || 'foto'), tipo: meta.contentType, tamanho: Number(meta.size), status: 'disponivel' }
    }
    return db.runTransaction(async (tx) => {
      const atual = (await tx.get(ref)).data()
      if (!atual || atual.indicadorId !== uid) throw stale()
      if (atual.status === 'enviada') return { id: atual.candidatoId }
      const { vaga: vagaDoc, preSalvo, indicador } = await lerContexto(uid, payload, tx)
      if (atual.expiraEm.toMillis() <= agora() || versaoDocumento(vagaDoc) !== atual.vagaVersao
        || (preSalvo ? versaoDocumento(preSalvo) : '') !== atual.preSalvoVersao) throw stale()
      const vaga = vagaDoc.data()
      const empresaId = vaga.empresaId || vaga.empresaUid
      const chave = hash([uid, payload.vagaId, dados.email])
      const duplicidadeRef = db.doc(`indicacoesUnicas/${chave}`)
      const indicacaoId = payload.candidatoPreSalvoId ? `${uid}__${payload.vagaId}__${payload.candidatoPreSalvoId}` : snapshot.id
      const indicacaoRef = db.doc(`indicacoes/${indicacaoId}`)
      const duplicada = await tx.get(duplicidadeRef)
      const existente = await tx.get(indicacaoRef)
      // Consulta cobre indicações legadas, criadas antes da chave de unicidade.
      const anteriores = await tx.get(db.collection('candidatos').where('indicadorId', '==', uid).where('vagaId', '==', payload.vagaId))
      if (duplicada.exists || existente.exists || anteriores.docs.some((d) => String(d.data().email || '').trim().toLowerCase() === dados.email
        || (payload.candidatoPreSalvoId && d.data().candidatoPreSalvoId === payload.candidatoPreSalvoId))) {
        throw erro('indicacao_duplicada', 'Este candidato já foi indicado para esta vaga.', 'already-exists')
      }
      const timestamp = Timestamp.fromMillis(agora())
      const valor = recompensaFixa(vaga)
      const vinculos = {
        indicadorId: uid, indicadorUid: uid, indicadorNome: indicador.data().nome || indicador.data().nomeCompleto || '',
        empresaId, empresaUid: empresaId, vagaId: payload.vagaId, vagaTitulo: vaga.titulo || '', vagaEmpresa: vaga.empresa || '',
        recompensa: vaga.recompensa || '', recompensaTipo: vaga.recompensaTipo || (valor ? 'fixo' : 'personalizado'),
        recompensaValor: valor, recompensaValorFixo: valor, status: 'indicado', criadoEm: timestamp, atualizadoEm: timestamp,
        ...(payload.candidatoPreSalvoId ? { candidatoPreSalvoId: payload.candidatoPreSalvoId } : {})
      }
      const compatibilidadeIndicacao = {
        analiseId: snapshot.id, nota: atual.resultado.notaPrecisa, limite: LIMIAR_COMPATIBILIDADE_INDICACAO, operador: '>', podeIndicar: true,
        versao: ANALISE_VERSAO, regraVersao: REGRA_INDICACAO_VERSAO, rubricaVersao: atual.resultado.rubricaVersao,
        assinaturaDados: atual.assinaturaDados, vagaVersao: atual.vagaVersao, curriculoHash: atual.curriculo?.hash || '', analisadoEm: atual.criadoEm
      }
      tx.create(db.doc(`candidatos/${snapshot.id}`), {
        ...dados, ...vinculos, aplicadoEm: timestamp, indicacaoId, curriculo, fotoPerfil,
        curriculoNome: curriculo.nome || '', curriculoTipo: curriculo.tipo || '', curriculoTamanho: curriculo.tamanho || 0,
        origem: dados.linkedin ? 'LinkedIn' : dados.portfolio ? 'Portfolio' : dados.github ? 'GitHub' : 'Indicação', compatibilidadeIndicacao
      })
      tx.create(indicacaoRef, { ...vinculos, candidatoId: snapshot.id, candidatoNome: dados.nome, compatibilidadeIndicacao })
      tx.create(duplicidadeRef, { candidatoId: snapshot.id, indicadorId: uid, vagaId: payload.vagaId })
      tx.create(db.doc(`analisesIndicacao/${snapshot.id}`), {
        ...atual.resultado, candidatoId: snapshot.id, vagaId: payload.vagaId, indicadorId: uid, empresaId,
        criadoEm: atual.criadoEm, compatibilidadeIndicacao
      })
      tx.create(db.doc(`historicoProcesso/indicacao_${snapshot.id}`), {
        candidatoId: snapshot.id, candidatoNome: dados.nome, vagaId: payload.vagaId, vagaTitulo: vaga.titulo || '', empresaId, indicadorId: uid,
        tipo: 'indicacao_criada', titulo: 'Indicação enviada', tituloKey: 'notifications.messages.referralSentTitle',
        descricao: `${dados.nome} foi indicado para ${vaga.titulo || 'a vaga'}.`, descricaoKey: 'candidateProfile.historyEvents.referralCreated',
        descricaoParams: { candidate: dados.nome, job: vaga.titulo || '' }, statusAtual: 'indicado', criadoPor: uid, criadoEm: timestamp
      })
      for (const [userId, tipo, tituloKey, mensagemKey, link] of [
        [empresaId, 'novo_candidato', 'newCandidateTitle', 'newCandidateCompany', '/candidatos/empresa'],
        [uid, 'indicacao_enviada', 'referralSentTitle', 'referralSent', '/candidatos/indicador']
      ]) {
        tx.create(db.doc(`notificacoes/indicacao_${snapshot.id}_${userId}`), {
          userId, tipo, titulo: tipo === 'novo_candidato' ? 'Novo candidato indicado' : 'Indicação enviada',
          tituloKey: `notifications.messages.${tituloKey}`, tituloParams: {},
          mensagem: `${dados.nome} foi indicado para ${vaga.titulo || 'a vaga'}.`, mensagemKey: `notifications.messages.${mensagemKey}`,
          mensagemParams: { candidate: dados.nome, job: vaga.titulo || '', referrer: vinculos.indicadorNome },
          link, metadata: { candidatoId: snapshot.id, vagaId: payload.vagaId, empresaId, indicadorId: uid },
          lida: false, lidaEm: null, origem: 'app', criadoPor: uid, criadoEm: timestamp
        })
      }
      tx.update(ref, { status: 'enviada', candidatoId: snapshot.id })
      return { id: snapshot.id }
    })
  }

  async function limparExpiradas() {
    const expiradas = await db.collection('validacoesIndicacao').where('expiraEm', '<', Timestamp.fromMillis(agora() - 24 * 60 * 60 * 1000)).limit(100).get()
    for (const doc of expiradas.docs) {
      const data = doc.data()
      if (data.arquivoValidado) await bucket.file(data.arquivoValidado).delete({ ignoreNotFound: true })
      const candidato = await db.doc(`candidatos/${doc.id}`).get()
      if (!candidato.exists) {
        await bucket.deleteFiles({ prefix: `curriculos/${data.indicadorId}/candidatos/${doc.id}/` })
        await bucket.deleteFiles({ prefix: `fotos-perfil/candidatos/${data.indicadorId}/indicados/${doc.id}/` })
      } else {
        const [fotos] = await bucket.getFiles({ prefix: `fotos-perfil/candidatos/${data.indicadorId}/indicados/${doc.id}/` })
        for (const foto of fotos) {
          if (foto.name !== candidato.data().fotoPerfil?.caminho) await foto.delete({ ignoreNotFound: true })
        }
      }
      await doc.ref.delete()
    }
    // Arquivos temporários abandonados não dependem da criação bem-sucedida de uma análise.
    for await (const file of bucket.getFilesStream({ prefix: 'curriculos/' })) {
      if (/^curriculos\/[^/]+\/temporarios\//.test(file.name)
        && Date.parse(file.metadata.timeCreated) < agora() - 24 * 60 * 60 * 1000) await file.delete({ ignoreNotFound: true })
    }
  }
  return { analisar, finalizar, limparExpiradas }
}

function recompensaFixa(vaga) {
  if (vaga.recompensaTipo && vaga.recompensaTipo !== 'fixo') return null
  const numero = Number(vaga.recompensaValorFixo || 0)
  if (Number.isFinite(numero) && numero > 0) return numero
  const texto = String(vaga.recompensa || '').trim()
  if (!/^(r\$\s*)?\d[\d.\s]*(,\d{1,2})?$/i.test(texto)) return null
  return Number(texto.replace(/[^\d,]/g, '').replace(',', '.')) || null
}

module.exports = { criarServicoIndicacoes, extrairCurriculo, extrairCurriculoInterno, normalizarDados, validarVaga }
