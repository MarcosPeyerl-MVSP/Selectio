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

router.post('/empresa/cadastro', (req, res) => {
  const {
    nomeEmpresa,
    razaoSocial,
    cnpj,
    email,
    telefone,
    site,
    endereco,
    setor,
    tamanho,
    formaPagamento,
    dadosPagamento,
    curadoriaIA
  } = req.body

  if (!nomeEmpresa || !cnpj || !email) {
    return res.status(400).json({
      erro: 'Nome da empresa, CNPJ e e-mail são obrigatórios'
    })
  }

  const sql = `
    INSERT INTO empresas (
      nome_empresa,
      razao_social,
      cnpj,
      email,
      telefone,
      site,
      endereco,
      setor,
      tamanho,
      forma_pagamento,
      dados_pagamento,
      curadoria_ia
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  db.run(
    sql,
    [
      nomeEmpresa,
      razaoSocial,
      cnpj,
      email,
      telefone,
      site,
      endereco,
      setor,
      tamanho,
      formaPagamento,
      dadosPagamento,
      curadoriaIA ? 1 : 0
    ],
    function (err) {
      if (err) {
        return res.status(500).json({
          erro: 'Empresa já cadastrada ou erro no banco'
        })
      }

      res.json({ sucesso: true })
    }
  )
})


module.exports = router