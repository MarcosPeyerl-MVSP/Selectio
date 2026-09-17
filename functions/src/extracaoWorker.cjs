const { parentPort, workerData } = require('node:worker_threads')
const { extrairCurriculoInterno } = require('./indicacoesCore.cjs')

extrairCurriculoInterno(Buffer.from(workerData.bytes), workerData.tipo).then(
  (value) => parentPort.postMessage({ value }),
  (error) => parentPort.postMessage({ error: {
    motivo: error.details?.motivo || 'extracao_falhou',
    message: error.details ? error.message : 'Nao foi possivel extrair o curriculo.'
  } })
)
