const express = require('express')
const cors = require('cors')
const routes = require('./routes.cjs')

const app = express()
const PORT = process.env.PORT || 3333

app.use(cors())
app.use(express.json())
app.use(routes)

app.get('/', (req, res) => {
  res.send('API Selectio rodando')
})

const server = app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} ja esta em uso. Encerre o outro processo ou rode com outra porta.`)
    console.error('Exemplo: $env:PORT=3334; node index.cjs')
    process.exit(1)
  }

  throw err
})
