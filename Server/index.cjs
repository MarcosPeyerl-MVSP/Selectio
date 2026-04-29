const express = require('express')
const cors = require('cors')
const routes = require('./routes.cjs')

const app = express()

app.use(cors())
app.use(express.json())
app.use(routes)

app.get('/', (req, res) => {
  res.send('✅ API Selectio rodando')
})

app.listen(3333, () => {
  console.log('✅ Backend rodando em http://localhost:3333')
})