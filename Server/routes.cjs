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

router.post('/indicador/login', async (req, res) => {
  const { login, senha } = req.body

  if (!login || !senha) {
    return res.status(400).json({
      erro: 'E-mail/usuário e senha são obrigatórios'
    })
  }

  const sql = `SELECT * FROM indicadores WHERE email = ? OR nome = ?`

  db.get(sql, [login, login], async (err, row) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar usuário no banco'
      })
    }

    if (!row) {
      return res.status(401).json({
        erro: 'E-mail/usuário ou senha inválidos'
      })
    }

    const senhaValida = await bcrypt.compare(senha, row.senha)

    if (!senhaValida) {
      return res.status(401).json({
        erro: 'E-mail/usuário ou senha inválidos'
      })
    }

    const user = {
      id: row.id,
      nome: row.nome,
      email: row.email,
      cpf: row.cpf,
      pix: row.pix,
      dataNascimento: row.data_nascimento
    }

    res.json(user)
  })
})

router.get('/indicador/:id', (req, res) => {
  const { id } = req.params

  const sql = `SELECT id, nome, email, cpf, pix, data_nascimento FROM indicadores WHERE id = ?`

  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar usuário'
      })
    }

    if (!row) {
      return res.status(404).json({
        erro: 'Usuário não encontrado'
      })
    }

    res.json({
      id: row.id,
      nome: row.nome,
      email: row.email,
      cpf: row.cpf,
      pix: row.pix,
      dataNascimento: row.data_nascimento
    })
  })
})

module.exports = router

