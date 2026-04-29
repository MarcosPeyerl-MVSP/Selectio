const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('./database.cjs')

const router = express.Router()

router.post('/indicador/cadastro', async (req, res) => {
  const { nome, email, senha, cpf, pix, dataNascimento } = req.body

  if (!nome || !email || !senha) {
    return res.status(400).json({
      erro: 'Nome, e-mail e senha são obrigatórios'
    })
  }

  const senhaHash = await bcrypt.hash(senha, 10)

  const sql = `
    INSERT INTO indicadores (nome, email, senha, cpf, pix, data_nascimento)
    VALUES (?, ?, ?, ?, ?, ?)
  `

  db.run(
    sql,
    [nome, email, senhaHash, cpf, pix, dataNascimento],
    function (err) {
      if (err) {
        return res.status(500).json({
          erro: 'E-mail já cadastrado'
        })
      }

      res.json({ sucesso: true })
    }
  )
})

module.exports = router