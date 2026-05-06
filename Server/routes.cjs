const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('./database.cjs')

const router = express.Router()

router.post('/indicador/cadastro', async (req, res) => {
  const { nome, email, senha, cpf, pix, dataNascimento } = req.body

  if (!nome || !email || !senha) {
    return res.status(400).json({
      erro: 'Nome, e-mail e senha sao obrigatorios'
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
          erro: 'E-mail ja cadastrado'
        })
      }

      res.json({
        sucesso: true,
        indicador: {
          id: this.lastID,
          nome,
          email,
          cpf,
          pix,
          dataNascimento
        }
      })
    }
  )
})

router.post('/empresa/cadastro', async (req, res) => {
  const {
    nomeEmpresa,
    razaoSocial,
    cnpj,
    senha,
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

  if (!nomeEmpresa || !cnpj || !email || !senha) {
    return res.status(400).json({
      erro: 'Nome da empresa, CNPJ, e-mail e senha sao obrigatorios'
    })
  }

  const senhaHash = await bcrypt.hash(senha, 10)

  db.run(`ALTER TABLE empresas ADD COLUMN senha TEXT`, (migrationErr) => {
    if (migrationErr && !migrationErr.message.includes('duplicate column name')) {
      return res.status(500).json({
        erro: 'Erro ao preparar banco para salvar senha da empresa'
      })
    }

    salvarEmpresa()
  })

  function salvarEmpresa() {
  const sql = `
    INSERT INTO empresas (
      nome_empresa,
      razao_social,
      cnpj,
      senha,
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  db.run(
    sql,
    [
      nomeEmpresa,
      razaoSocial,
      cnpj,
      senhaHash,
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
          erro: 'Empresa ja cadastrada ou erro no banco'
        })
      }

      res.json({
        sucesso: true,
        empresa: {
          id: this.lastID,
          nomeEmpresa,
          razaoSocial,
          cnpj,
          email,
          telefone,
          site,
          endereco,
          setor,
          tamanho
        }
      })
    }
  )
  }
})

router.post('/empresa/login', async (req, res) => {
  const { login, senha } = req.body

  if (!login || !senha) {
    return res.status(400).json({
      erro: 'E-mail/CNPJ e senha sao obrigatorios'
    })
  }

  const cnpj = String(login).replace(/\D/g, '')
  const sql = `SELECT * FROM empresas WHERE email = ? OR cnpj = ? OR nome_empresa = ?`

  db.get(sql, [login, cnpj || login, login], async (err, row) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar empresa no banco'
      })
    }

    if (!row || !row.senha) {
      return res.status(401).json({
        erro: 'Empresa ou senha invalidos'
      })
    }

    const senhaValida = await bcrypt.compare(senha, row.senha)

    if (!senhaValida) {
      return res.status(401).json({
        erro: 'Empresa ou senha invalidos'
      })
    }

    res.json({
      id: row.id,
      nomeEmpresa: row.nome_empresa,
      razaoSocial: row.razao_social,
      cnpj: row.cnpj,
      email: row.email,
      telefone: row.telefone,
      site: row.site,
      endereco: row.endereco,
      setor: row.setor,
      tamanho: row.tamanho,
      plano: row.plano,
      curadoriaIA: Boolean(row.curadoria_ia)
    })
  })
})

router.post('/indicador/login', async (req, res) => {
  const { login, senha } = req.body

  if (!login || !senha) {
    return res.status(400).json({
      erro: 'E-mail/usuario e senha sao obrigatorios'
    })
  }

  const sql = `SELECT * FROM indicadores WHERE email = ? OR nome = ?`

  db.get(sql, [login, login], async (err, row) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar usuario no banco'
      })
    }

    if (!row) {
      return res.status(401).json({
        erro: 'E-mail/usuario ou senha invalidos'
      })
    }

    const senhaValida = await bcrypt.compare(senha, row.senha)

    if (!senhaValida) {
      return res.status(401).json({
        erro: 'E-mail/usuario ou senha invalidos'
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
        erro: 'Erro ao buscar usuario'
      })
    }

    if (!row) {
      return res.status(404).json({
        erro: 'Usuario nao encontrado'
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

const mapStatusIndicador = (row) => {
  const totalIndicacoes = Number(row?.total_indicacoes || 0)
  const vagasSucesso = Number(row?.vagas_sucesso || 0)
  const taxaSucesso = totalIndicacoes
    ? Number(((vagasSucesso / totalIndicacoes) * 100).toFixed(1))
    : 0

  return {
    indicadorId: Number(row?.indicador_id || 0),
    totalIndicacoes,
    vagasAtivas: Number(row?.vagas_ativas || 0),
    vagasCanceladas: Number(row?.vagas_canceladas || 0),
    vagasSucesso,
    valorRecebido: Number(row?.valor_recebido || 0),
    valorPendente: Number(row?.valor_pendente || 0),
    taxaSucesso
  }
}

router.get('/indicador/:id/status', (req, res) => {
  const { id } = req.params

  db.get('SELECT id FROM indicadores WHERE id = ?', [id], (indicadorErr, indicador) => {
    if (indicadorErr) {
      return res.status(500).json({
        erro: 'Erro ao buscar indicador'
      })
    }

    if (!indicador) {
      return res.status(404).json({
        erro: 'Indicador nao encontrado'
      })
    }

    db.get('SELECT * FROM statusIndicador WHERE indicador_id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({
          erro: 'Erro ao buscar status do indicador'
        })
      }

      if (row) {
        return res.json(mapStatusIndicador(row))
      }

      const emptyStatus = mapStatusIndicador({ indicador_id: id })
      res.json(emptyStatus)
    })
  })
})

// ROTAS PARA VAGAS
const parseJsonList = (value) => {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const mapVagaRow = (row) => ({
  id: row.id,
  titulo: row.titulo,
  empresa: row.empresa_nome || row.empresa,
  empresaId: row.empresa_id,
  localizacao: row.localizacao,
  salario: row.salario,
  tipo: row.tipo,
  recompensa: row.recompensa,
  descricaoCurta: row.descricao_curta,
  descricaoLonga: row.descricao_longa,
  beneficios: parseJsonList(row.beneficios),
  requisitos: parseJsonList(row.requisitos),
  imagem: row.imagem,
  area: row.area,
  destaqueBanner: Boolean(row.destaque_banner),
  bannerAtivo: Boolean(row.banner_ativo)
})

const vagasBaseSelect = `
  SELECT
    vagas.*,
    empresas.nome_empresa AS empresa_nome
  FROM vagas
  LEFT JOIN empresas ON empresas.id = vagas.empresa_id
`

router.get('/vagas', (req, res) => {
  const sql = `${vagasBaseSelect} ORDER BY vagas.criado_em DESC`

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar vagas'
      })
    }

    res.json(rows.map(mapVagaRow))
  })
})

router.get('/vagas/banner', (req, res) => {
  const sql = `
    ${vagasBaseSelect}
    WHERE vagas.banner_ativo = 1 OR vagas.destaque_banner = 1
    ORDER BY vagas.destaque_banner DESC, vagas.criado_em DESC
    LIMIT 4
  `

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar vagas do banner'
      })
    }

    if (rows.length) {
      return res.json(rows.map(mapVagaRow))
    }

    db.all(`${vagasBaseSelect} ORDER BY vagas.criado_em DESC LIMIT 4`, [], (fallbackErr, fallbackRows) => {
      if (fallbackErr) {
        return res.status(500).json({
          erro: 'Erro ao buscar vagas do banner'
        })
      }

      res.json(fallbackRows.map(mapVagaRow))
    })
  })
})

router.get('/vagas/:id', (req, res) => {
  const { id } = req.params

  const sql = `${vagasBaseSelect} WHERE vagas.id = ?`

  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar vaga'
      })
    }

    if (!row) {
      return res.status(404).json({
        erro: 'Vaga nao encontrada'
      })
    }

    res.json(mapVagaRow(row))
  })
})

router.post('/vagas', (req, res) => {
  const {
    titulo,
    empresa,
    localizacao,
    salario,
    tipo,
    recompensa,
    descricaoCurta,
    descricaoLonga,
    beneficios,
    requisitos,
    imagem,
    area,
    empresaId
  } = req.body

  if (!titulo || (!empresa && !empresaId) || !area) {
    return res.status(400).json({
      erro: 'Titulo, empresa/empresaId e area sao obrigatorios'
    })
  }

  const criarVaga = (nomeEmpresa) => {
    const sql = `
      INSERT INTO vagas (
        titulo, empresa, localizacao, salario, tipo, recompensa,
        descricao_curta, descricao_longa, beneficios, requisitos,
        imagem, area, empresa_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    db.run(
      sql,
      [
        titulo,
        nomeEmpresa,
        localizacao,
        salario,
        tipo,
        recompensa,
        descricaoCurta,
        descricaoLonga,
        JSON.stringify(beneficios || []),
        JSON.stringify(requisitos || []),
        imagem,
        area,
        empresaId
      ],
      function (err) {
        if (err) {
          return res.status(500).json({
            erro: 'Erro ao criar vaga'
          })
        }

        res.json({
          sucesso: true,
          id: this.lastID
        })
      }
    )
  }

  if (!empresaId) {
    return criarVaga(empresa)
  }

  db.get('SELECT nome_empresa FROM empresas WHERE id = ?', [empresaId], (err, row) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar empresa'
      })
    }

    if (!row) {
      return res.status(404).json({
        erro: 'Empresa nao encontrada'
      })
    }

    criarVaga(row.nome_empresa)
  })
})

module.exports = router
