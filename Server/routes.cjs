const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('./database.cjs')

const router = express.Router()

const normalizeFirebaseUid = (firebaseUid) => {
  return typeof firebaseUid === 'string' ? firebaseUid.trim() : ''
}

const vincularFirebaseUid = (table, id, firebaseUid) => {
  if (!firebaseUid) return

  db.run(
    `UPDATE ${table} SET firebase_uid = ? WHERE id = ? AND (firebase_uid IS NULL OR firebase_uid = '')`,
    [firebaseUid, id]
  )
}

router.post('/indicador/cadastro', async (req, res) => {
  const { nome, email, senha, firebaseUid, cpf, pix, dataNascimento } = req.body
  const normalizedFirebaseUid = normalizeFirebaseUid(firebaseUid)

  if (!nome || !email || !senha) {
    return res.status(400).json({
      erro: 'Nome, e-mail e senha sao obrigatorios'
    })
  }

  const senhaHash = await bcrypt.hash(senha, 10)

  const sql = `
    INSERT INTO indicadores (nome, email, senha, firebase_uid, cpf, pix, data_nascimento)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `

  db.run(
    sql,
    [nome, email, senhaHash, normalizedFirebaseUid || null, cpf, pix, dataNascimento],
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
          firebaseUid: normalizedFirebaseUid || null,
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
    firebaseUid,
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
  const normalizedFirebaseUid = normalizeFirebaseUid(firebaseUid)

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
      firebase_uid,
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  db.run(
    sql,
    [
      nomeEmpresa,
      razaoSocial,
      cnpj,
      senhaHash,
      normalizedFirebaseUid || null,
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
          firebaseUid: normalizedFirebaseUid || null,
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
  const { login, senha, firebaseUid } = req.body
  const normalizedLogin = String(login || '').trim()
  const normalizedFirebaseUid = normalizeFirebaseUid(firebaseUid)

  if ((!normalizedLogin && !normalizedFirebaseUid) || (!senha && !normalizedFirebaseUid)) {
    return res.status(400).json({
      erro: 'E-mail/CNPJ e senha sao obrigatorios'
    })
  }

  const cnpj = String(normalizedLogin).replace(/\D/g, '')
  const sql = `
    SELECT * FROM empresas
    WHERE firebase_uid = ? OR email = ? OR cnpj = ? OR nome_empresa = ?
  `

  db.get(sql, [normalizedFirebaseUid || null, normalizedLogin, cnpj || normalizedLogin, normalizedLogin], async (err, row) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar empresa no banco'
      })
    }

    if (!row) {
      return res.status(401).json({
        erro: 'Empresa ou senha invalidos'
      })
    }

    if (normalizedFirebaseUid) {
      if (row.firebase_uid && row.firebase_uid !== normalizedFirebaseUid) {
        return res.status(401).json({
          erro: 'Esta empresa esta vinculada a outra conta Firebase'
        })
      }

      if (!row.firebase_uid) {
        vincularFirebaseUid('empresas', row.id, normalizedFirebaseUid)
        row.firebase_uid = normalizedFirebaseUid
      }
    } else {
      if (!row.senha) {
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
    }

    res.json({
      id: row.id,
      nomeEmpresa: row.nome_empresa,
      razaoSocial: row.razao_social,
      cnpj: row.cnpj,
      firebaseUid: row.firebase_uid || null,
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
  const { login, senha, firebaseUid } = req.body
  const normalizedLogin = String(login || '').trim()
  const normalizedFirebaseUid = normalizeFirebaseUid(firebaseUid)

  if ((!normalizedLogin && !normalizedFirebaseUid) || (!senha && !normalizedFirebaseUid)) {
    return res.status(400).json({
      erro: 'E-mail/usuario e senha sao obrigatorios'
    })
  }

  const sql = `
    SELECT * FROM indicadores
    WHERE firebase_uid = ? OR email = ? OR nome = ?
  `

  db.get(sql, [normalizedFirebaseUid || null, normalizedLogin, normalizedLogin], async (err, row) => {
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

    if (normalizedFirebaseUid) {
      if (row.firebase_uid && row.firebase_uid !== normalizedFirebaseUid) {
        return res.status(401).json({
          erro: 'Este indicador esta vinculado a outra conta Firebase'
        })
      }

      if (!row.firebase_uid) {
        vincularFirebaseUid('indicadores', row.id, normalizedFirebaseUid)
        row.firebase_uid = normalizedFirebaseUid
      }
    } else {
      const senhaValida = await bcrypt.compare(senha, row.senha)

      if (!senhaValida) {
        return res.status(401).json({
          erro: 'E-mail/usuario ou senha invalidos'
        })
      }
    }

    const user = {
      id: row.id,
      nome: row.nome,
      email: row.email,
      firebaseUid: row.firebase_uid || null,
      cpf: row.cpf,
      pix: row.pix,
      dataNascimento: row.data_nascimento
    }

    res.json(user)
  })
})

router.get('/indicador/:id', (req, res) => {
  const { id } = req.params

  const sql = `SELECT id, nome, email, firebase_uid, cpf, pix, data_nascimento FROM indicadores WHERE id = ?`

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
      firebaseUid: row.firebase_uid || null,
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

const parseMoneyValue = (value) => {
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  return Number(normalized || 0)
}

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

router.put('/vagas/:id', (req, res) => {
  const { id } = req.params
  const {
    titulo,
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

  if (!titulo || !area || !empresaId) {
    return res.status(400).json({
      erro: 'Titulo, area e empresaId sao obrigatorios'
    })
  }

  db.get('SELECT empresa_id FROM vagas WHERE id = ?', [id], (findErr, vaga) => {
    if (findErr) {
      return res.status(500).json({
        erro: 'Erro ao buscar vaga'
      })
    }

    if (!vaga) {
      return res.status(404).json({
        erro: 'Vaga nao encontrada'
      })
    }

    if (Number(vaga.empresa_id) !== Number(empresaId)) {
      return res.status(403).json({
        erro: 'Esta empresa nao pode editar esta vaga'
      })
    }

    const sql = `
      UPDATE vagas
      SET
        titulo = ?,
        localizacao = ?,
        salario = ?,
        tipo = ?,
        recompensa = ?,
        descricao_curta = ?,
        descricao_longa = ?,
        beneficios = ?,
        requisitos = ?,
        imagem = ?,
        area = ?
      WHERE id = ? AND empresa_id = ?
    `

    db.run(
      sql,
      [
        titulo,
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
        id,
        empresaId
      ],
      function (updateErr) {
        if (updateErr) {
          return res.status(500).json({
            erro: 'Erro ao atualizar vaga'
          })
        }

        res.json({
          sucesso: true,
          alteracoes: this.changes
        })
      }
    )
  })
})

router.post('/candidatos', (req, res) => {
  const {
    indicadorId,
    vagaId,
    nome,
    email,
    dataNascimento,
    genero,
    telefone,
    cargoAtual,
    anosExperiencia,
    escolaridade,
    proficienciaIdiomas,
    linkedin,
    portfolio,
    github,
    pontosFortes,
    fitCultural,
    destaquesProjetos,
    narrativa,
    hardSkills,
    softSkills,
    expectativaSalarial,
    modeloTrabalho,
    avisoPrevio,
    curriculoNome
  } = req.body

  if (!indicadorId || !vagaId || !nome || !email) {
    return res.status(400).json({
      erro: 'Indicador, vaga, nome e e-mail do candidato sao obrigatorios'
    })
  }

  db.get('SELECT id FROM indicadores WHERE id = ?', [indicadorId], (indicadorErr, indicador) => {
    if (indicadorErr) {
      return res.status(500).json({
        erro: 'Erro ao validar indicador'
      })
    }

    if (!indicador) {
      return res.status(404).json({
        erro: 'Indicador nao encontrado'
      })
    }

    db.get('SELECT id FROM vagas WHERE id = ?', [vagaId], (vagaErr, vaga) => {
      if (vagaErr) {
        return res.status(500).json({
          erro: 'Erro ao validar vaga'
        })
      }

      if (!vaga) {
        return res.status(404).json({
          erro: 'Vaga nao encontrada'
        })
      }

      const sql = `
        INSERT INTO candidatos (
          indicador_id,
          vaga_id,
          nome,
          email,
          data_nascimento,
          genero,
          telefone,
          cargo_atual,
          anos_experiencia,
          escolaridade,
          proficiencia_idiomas,
          linkedin,
          portfolio,
          github,
          pontos_fortes,
          fit_cultural,
          destaques_projetos,
          narrativa,
          hard_skills,
          soft_skills,
          expectativa_salarial,
          modelo_trabalho,
          aviso_previo,
          curriculo_nome
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      db.run(
        sql,
        [
          indicadorId,
          vagaId,
          nome,
          email,
          dataNascimento,
          genero,
          telefone,
          cargoAtual,
          anosExperiencia,
          escolaridade,
          proficienciaIdiomas,
          linkedin,
          portfolio,
          github,
          pontosFortes,
          fitCultural,
          destaquesProjetos,
          narrativa,
          JSON.stringify(hardSkills || []),
          JSON.stringify(softSkills || []),
          expectativaSalarial,
          modeloTrabalho,
          avisoPrevio,
          curriculoNome
        ],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({
              erro: 'Erro ao salvar candidato'
            })
          }

          db.run(`
            INSERT INTO statusIndicador (indicador_id, total_indicacoes, vagas_ativas, updated_at)
            VALUES (?, 1, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(indicador_id) DO UPDATE SET
              total_indicacoes = total_indicacoes + 1,
              vagas_ativas = vagas_ativas + 1,
              updated_at = CURRENT_TIMESTAMP
          `, [indicadorId])

          res.json({
            sucesso: true,
            id: this.lastID
          })
        }
      )
    })
  })
})

router.get('/indicador/:id/candidatos', (req, res) => {
  const { id } = req.params

  const sql = `
    SELECT
      candidatos.*,
      vagas.titulo AS vaga_titulo,
      vagas.empresa AS vaga_empresa
    FROM candidatos
    LEFT JOIN vagas ON vagas.id = candidatos.vaga_id
    WHERE candidatos.indicador_id = ?
    ORDER BY candidatos.criado_em DESC
  `

  db.all(sql, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar candidatos'
      })
    }

    res.json(rows.map((row) => ({
      id: row.id,
      indicadorId: row.indicador_id,
      vagaId: row.vaga_id,
      vagaTitulo: row.vaga_titulo,
      vagaEmpresa: row.vaga_empresa,
      nome: row.nome,
      email: row.email,
      telefone: row.telefone,
      cargoAtual: row.cargo_atual,
      linkedin: row.linkedin,
      portfolio: row.portfolio,
      github: row.github,
      status: row.status,
      origem: row.linkedin ? 'LinkedIn' : row.portfolio ? 'Portfolio' : row.github ? 'GitHub' : 'Indicacao',
      aplicadoEm: row.criado_em
    })))
  })
})

router.get('/empresa/:id/candidatos', (req, res) => {
  const { id } = req.params

  const sql = `
    SELECT
      candidatos.*,
      vagas.titulo AS vaga_titulo,
      vagas.empresa AS vaga_empresa,
      vagas.recompensa AS vaga_recompensa,
      vagas.empresa_id AS empresa_id,
      indicadores.nome AS indicador_nome
    FROM candidatos
    INNER JOIN vagas ON vagas.id = candidatos.vaga_id
    LEFT JOIN indicadores ON indicadores.id = candidatos.indicador_id
    WHERE vagas.empresa_id = ?
    ORDER BY candidatos.criado_em DESC
  `

  db.all(sql, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao buscar candidatos da empresa'
      })
    }

    res.json(rows.map((row) => ({
      id: row.id,
      indicadorId: row.indicador_id,
      indicadorNome: row.indicador_nome,
      vagaId: row.vaga_id,
      vagaTitulo: row.vaga_titulo,
      vagaEmpresa: row.vaga_empresa,
      recompensa: row.vaga_recompensa,
      nome: row.nome,
      email: row.email,
      telefone: row.telefone,
      cargoAtual: row.cargo_atual,
      linkedin: row.linkedin,
      portfolio: row.portfolio,
      github: row.github,
      status: row.status,
      origem: row.linkedin ? 'LinkedIn' : row.portfolio ? 'Portfolio' : row.github ? 'GitHub' : 'Indicacao',
      aplicadoEm: row.criado_em
    })))
  })
})

router.patch('/candidatos/:id/status', (req, res) => {
  const { id } = req.params
  const { status, empresaId } = req.body
  const validStatus = ['indicado', 'entrevista', 'contratado', 'cancelado']

  if (!empresaId || !validStatus.includes(status)) {
    return res.status(400).json({
      erro: 'Empresa e status valido sao obrigatorios'
    })
  }

  const sql = `
    SELECT
      candidatos.id,
      candidatos.status,
      candidatos.indicador_id,
      vagas.empresa_id,
      vagas.recompensa
    FROM candidatos
    INNER JOIN vagas ON vagas.id = candidatos.vaga_id
    WHERE candidatos.id = ?
  `

  db.get(sql, [id], (findErr, candidato) => {
    if (findErr) {
      return res.status(500).json({
        erro: 'Erro ao buscar candidato'
      })
    }

    if (!candidato) {
      return res.status(404).json({
        erro: 'Candidato nao encontrado'
      })
    }

    if (Number(candidato.empresa_id) !== Number(empresaId)) {
      return res.status(403).json({
        erro: 'Esta empresa nao pode alterar este candidato'
      })
    }

    const previousStatus = candidato.status || 'indicado'
    const rewardValue = parseMoneyValue(candidato.recompensa)

    db.run('UPDATE candidatos SET status = ? WHERE id = ?', [status, id], function (updateErr) {
      if (updateErr) {
        return res.status(500).json({
          erro: 'Erro ao atualizar status do candidato'
        })
      }

      const statusDelta = {
        vagas_sucesso: status === 'contratado' && previousStatus !== 'contratado' ? 1 : previousStatus === 'contratado' && status !== 'contratado' ? -1 : 0,
        vagas_canceladas: status === 'cancelado' && previousStatus !== 'cancelado' ? 1 : previousStatus === 'cancelado' && status !== 'cancelado' ? -1 : 0,
        vagas_ativas: ['contratado', 'cancelado'].includes(status) && !['contratado', 'cancelado'].includes(previousStatus)
          ? -1
          : !['contratado', 'cancelado'].includes(status) && ['contratado', 'cancelado'].includes(previousStatus)
            ? 1
            : 0,
        valor_recebido: status === 'contratado' && previousStatus !== 'contratado' ? rewardValue : previousStatus === 'contratado' && status !== 'contratado' ? -rewardValue : 0,
        valor_pendente: status === 'contratado' && previousStatus !== 'contratado' ? -rewardValue : previousStatus === 'contratado' && status !== 'contratado' ? rewardValue : 0,
      }

      db.run(`
        INSERT INTO statusIndicador (indicador_id, total_indicacoes, vagas_ativas, valor_recebido, valor_pendente, updated_at)
        VALUES (?, 0, 0, 0, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(indicador_id) DO NOTHING
      `, [candidato.indicador_id], () => {
        db.run(`
          UPDATE statusIndicador
          SET
            vagas_sucesso = MAX(0, vagas_sucesso + ?),
            vagas_canceladas = MAX(0, vagas_canceladas + ?),
            vagas_ativas = MAX(0, vagas_ativas + ?),
            valor_recebido = MAX(0, valor_recebido + ?),
            valor_pendente = MAX(0, valor_pendente + ?),
            taxa_sucesso = CASE
              WHEN total_indicacoes > 0 THEN ROUND(((vagas_sucesso + ?) * 100.0) / total_indicacoes, 1)
              ELSE 0
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE indicador_id = ?
        `, [
          statusDelta.vagas_sucesso,
          statusDelta.vagas_canceladas,
          statusDelta.vagas_ativas,
          statusDelta.valor_recebido,
          statusDelta.valor_pendente,
          statusDelta.vagas_sucesso,
          candidato.indicador_id
        ])
      })

      res.json({
        sucesso: true,
        id: Number(id),
        status
      })
    })
  })
})

module.exports = router
