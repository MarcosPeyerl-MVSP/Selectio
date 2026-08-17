import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import * as mammoth from 'mammoth/mammoth.browser'
import { createWorker as criarWorkerOcr } from 'tesseract.js'
import {
  avaliarCompatibilidade,
  dividirTextoEmTrechos,
  prepararConsultasSemanticas,
  sanitizarTextoCurriculo
} from '../services/compatibilidade/motorCompatibilidade'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm'
const MODELO_SEMANTICO = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
let extratorSemanticoPromise = null

const enviarProgresso = (id, etapa, progresso, detalhe = '') => {
  self.postMessage({ tipo: 'progresso', id, etapa, progresso, detalhe })
}

const limparTexto = (texto) => String(texto || '')
  .replace(/\r/g, '\n')
  .replace(/[\t ]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const extrairPdf = async (bytes, id) => {
  const documento = await pdfjs.getDocument({ data: bytes }).promise
  const textos = []

  for (let paginaNumero = 1; paginaNumero <= documento.numPages; paginaNumero += 1) {
    enviarProgresso(id, 'extracao', Math.round((paginaNumero / documento.numPages) * 35), `PDF ${paginaNumero}/${documento.numPages}`)
    const pagina = await documento.getPage(paginaNumero)
    const conteudo = await pagina.getTextContent()
    textos.push(conteudo.items.map((item) => item.str || '').join(' '))
  }

  let texto = limparTexto(textos.join('\n\n'))
  const limiteMinimo = Math.max(120, documento.numPages * 50)
  if (texto.length >= limiteMinimo) {
    return { texto, metodo: 'pdf_texto', paginas: documento.numPages, aviso: '' }
  }

  if (typeof OffscreenCanvas === 'undefined') {
    return {
      texto,
      metodo: 'pdf_texto_insuficiente',
      paginas: documento.numPages,
      aviso: 'OCR indisponivel neste navegador.'
    }
  }

  const maxPaginasOcr = Math.min(documento.numPages, 10)
  enviarProgresso(id, 'ocr', 38, 'Preparando reconhecimento de texto')
  const workerOcr = await criarWorkerOcr('por+eng', 1, {
    logger: (mensagem) => {
      if (typeof mensagem.progress === 'number') {
        enviarProgresso(id, 'ocr', 40 + Math.round(mensagem.progress * 25), mensagem.status || '')
      }
    }
  })

  try {
    const paginasOcr = []
    for (let paginaNumero = 1; paginaNumero <= maxPaginasOcr; paginaNumero += 1) {
      const pagina = await documento.getPage(paginaNumero)
      const viewport = pagina.getViewport({ scale: 1.6 })
      const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const contexto = canvas.getContext('2d', { willReadFrequently: true })
      await pagina.render({ canvasContext: contexto, viewport }).promise
      const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height)
      const resultado = await workerOcr.recognize(imagem)
      paginasOcr.push(resultado.data.text || '')
      enviarProgresso(id, 'ocr', 40 + Math.round((paginaNumero / maxPaginasOcr) * 25), `OCR ${paginaNumero}/${maxPaginasOcr}`)
    }
    texto = limparTexto(paginasOcr.join('\n\n'))
  } finally {
    await workerOcr.terminate()
  }

  return {
    texto,
    metodo: 'pdf_ocr',
    paginas: documento.numPages,
    aviso: documento.numPages > maxPaginasOcr
      ? `OCR limitado as primeiras ${maxPaginasOcr} paginas.`
      : ''
  }
}

const extrairDocx = async (bytes) => {
  const resultado = await mammoth.extractRawText({ arrayBuffer: bytes })
  return {
    texto: limparTexto(resultado.value),
    metodo: 'docx',
    paginas: 0,
    aviso: resultado.messages?.map((mensagem) => mensagem.message).filter(Boolean).join(' ') || ''
  }
}

const extrairCurriculo = async ({ bytes, nome, tipo }, id) => {
  const nomeNormalizado = String(nome || '').toLowerCase()
  const tipoNormalizado = String(tipo || '').toLowerCase()
  if (tipoNormalizado === 'application/pdf' || nomeNormalizado.endsWith('.pdf')) {
    return extrairPdf(bytes, id)
  }
  if (
    tipoNormalizado === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || nomeNormalizado.endsWith('.docx')
  ) {
    enviarProgresso(id, 'extracao', 30, 'Extraindo DOCX')
    return extrairDocx(bytes)
  }
  if (tipoNormalizado === 'application/msword' || nomeNormalizado.endsWith('.doc')) {
    throw new Error('Curriculos DOC antigos precisam ser convertidos para PDF ou DOCX antes da analise.')
  }
  throw new Error('Formato de curriculo nao suportado para analise.')
}

const carregarExtratorSemantico = async (device) => {
  const modulo = await import(/* @vite-ignore */ TRANSFORMERS_URL)
  return modulo.pipeline('feature-extraction', MODELO_SEMANTICO, {
    device,
    dtype: 'q8'
  })
}

const obterExtratorSemantico = async () => {
  if (extratorSemanticoPromise) return extratorSemanticoPromise
  extratorSemanticoPromise = (async () => {
    if (self.navigator?.gpu) {
      try {
        return { extrator: await carregarExtratorSemantico('webgpu'), dispositivo: 'webgpu' }
      } catch {
        // WASM e o fallback compativel com navegadores sem suporte WebGPU completo.
      }
    }
    return { extrator: await carregarExtratorSemantico('wasm'), dispositivo: 'wasm' }
  })()
  return extratorSemanticoPromise
}

const produtoEscalar = (a, b) => a.reduce((total, valor, indice) => total + valor * b[indice], 0)

const gerarSemantica = async ({ vaga, texto }, id) => {
  const consultas = prepararConsultasSemanticas(vaga)
  const trechos = dividirTextoEmTrechos(sanitizarTextoCurriculo(texto)).slice(0, 60)
  if (!consultas.length || !trechos.length) {
    return { resultados: {}, motor: 'nao_necessario', modelo: '' }
  }

  enviarProgresso(id, 'modelo', 68, 'Carregando modelo semantico local')
  try {
    const { extrator, dispositivo } = await obterExtratorSemantico()
    enviarProgresso(id, 'modelo', 78, 'Comparando requisitos e evidencias')
    const textos = [...consultas.map((consulta) => consulta.texto), ...trechos]
    const tensor = await extrator(textos, { pooling: 'mean', normalize: true })
    const vetores = tensor.tolist()
    const vetoresConsultas = vetores.slice(0, consultas.length)
    const vetoresTrechos = vetores.slice(consultas.length)
    const resultados = {}

    consultas.forEach((consulta, indiceConsulta) => {
      let melhorIndice = 0
      let melhorSimilaridade = -1
      vetoresTrechos.forEach((vetor, indiceTrecho) => {
        const similaridade = produtoEscalar(vetoresConsultas[indiceConsulta], vetor)
        if (similaridade > melhorSimilaridade) {
          melhorSimilaridade = similaridade
          melhorIndice = indiceTrecho
        }
      })
      resultados[consulta.id] = {
        similaridade: Math.max(0, melhorSimilaridade),
        evidencia: trechos[melhorIndice]?.slice(0, 320) || ''
      }
    })

    return { resultados, motor: dispositivo, modelo: MODELO_SEMANTICO }
  } catch (error) {
    extratorSemanticoPromise = null
    return {
      resultados: {},
      motor: 'lexical_fallback',
      modelo: '',
      aviso: `Analise semantica indisponivel: ${error?.message || 'falha ao carregar o modelo'}`
    }
  }
}

self.onmessage = async (event) => {
  const { id, payload } = event.data || {}
  if (!id || !payload) return

  try {
    enviarProgresso(id, 'extracao', 5, 'Lendo curriculo protegido')
    const extracao = await extrairCurriculo(payload.arquivo, id)
    if (!extracao.texto || extracao.texto.length < 20) {
      throw new Error('Nao foi possivel extrair texto suficiente deste curriculo.')
    }
    const semantica = await gerarSemantica({ vaga: payload.vaga, texto: extracao.texto }, id)
    enviarProgresso(id, 'calculo', 92, 'Calculando nota e cobertura')
    const resultado = avaliarCompatibilidade({
      candidato: payload.candidato,
      vaga: payload.vaga,
      textoCurriculo: extracao.texto,
      semantica: semantica.resultados,
      extracao: {
        ...extracao,
        aviso: [extracao.aviso, semantica.aviso].filter(Boolean).join(' ')
      }
    })
    self.postMessage({
      tipo: 'resultado',
      id,
      resultado: {
        ...resultado,
        semantica: { motor: semantica.motor, modelo: semantica.modelo }
      }
    })
  } catch (error) {
    self.postMessage({ tipo: 'erro', id, mensagem: error?.message || 'Falha ao analisar o curriculo.' })
  }
}
