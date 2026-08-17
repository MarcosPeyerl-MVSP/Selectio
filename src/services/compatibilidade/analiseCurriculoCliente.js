import { obterBlobCurriculoProtegido } from '../storageCurriculos'
import { criarPerfilSeguroDoCandidato } from './motorCompatibilidade'

let worker = null
const pendentes = new Map()

const obterWorker = () => {
  if (worker) return worker
  worker = new Worker(new URL('../../workers/analiseCurriculo.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = (event) => {
    const mensagem = event.data || {}
    const pendente = pendentes.get(mensagem.id)
    if (!pendente) return
    if (mensagem.tipo === 'progresso') {
      pendente.onProgress?.(mensagem)
      return
    }
    pendentes.delete(mensagem.id)
    if (mensagem.tipo === 'resultado') pendente.resolve(mensagem.resultado)
    else pendente.reject(new Error(mensagem.mensagem || 'Falha ao analisar o curriculo.'))
  }
  worker.onerror = (event) => {
    const erro = new Error(event.message || 'O analisador de curriculos foi interrompido.')
    pendentes.forEach(({ reject }) => reject(erro))
    pendentes.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

export const analisarCurriculoDoCandidato = async ({ candidato, vaga, onProgress }) => {
  if (!candidato?.curriculo?.caminho || candidato.curriculo.status !== 'disponivel') {
    throw new Error('Este candidato precisa ter um curriculo PDF ou DOCX disponivel.')
  }

  const blob = await obterBlobCurriculoProtegido(candidato.curriculo)
  const bytes = await blob.arrayBuffer()
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
  const analisador = obterWorker()

  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject, onProgress })
    analisador.postMessage({
      id,
      payload: {
        candidato: criarPerfilSeguroDoCandidato(candidato),
        vaga: {
          id: vaga.id,
          titulo: vaga.titulo || '',
          descricaoLonga: vaga.descricaoLonga || '',
          rubricaCompatibilidade: vaga.rubricaCompatibilidade
        },
        arquivo: {
          bytes,
          nome: candidato.curriculo.nome || candidato.curriculoNome || '',
          tipo: candidato.curriculo.tipo || candidato.curriculoTipo || blob.type || ''
        }
      }
    }, [bytes])
  })
}

export const encerrarAnalisadorCurriculos = () => {
  worker?.terminate()
  worker = null
  pendentes.forEach(({ reject }) => reject(new Error('Analise cancelada.')))
  pendentes.clear()
}
