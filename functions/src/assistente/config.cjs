const LIMITES = Object.freeze({
  vagas: 50, candidatos: 24, lote: 3, pergunta: 1200, historico: 4,
  mensagem: 1200, corpo: 10000, chunksDocumento: 80, chunk: 650,
  chunksContexto: 48, chunksCandidato: 2, contexto: 36000,
  arquivo: 10 * 1024 * 1024, outputTokens: 3000, resposta: 22000, vagaContexto: 8000,
  timeout: 25000, validadeMs: 24 * 60 * 60 * 1000, retencaoMs: 7 * 86400000,
  versao: 'rag-1'
})
const POLITICAS_ASSISTENTE = Object.freeze({
  assistenteContexto: { minuto: 30, dia: 300 },
  assistenteIndexar: { minuto: 10, dia: 80 },
  assistenteIndexarGlobal: { minuto: 10, dia: 100 },
  assistentePerguntar: { minuto: 3, dia: 30 },
  assistenteGlobal: { minuto: 10, dia: 200 }
})
module.exports = { LIMITES, POLITICAS_ASSISTENTE }
