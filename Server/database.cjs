const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const bcrypt = require('bcryptjs')

const db = new sqlite3.Database(path.join(__dirname, 'selectio.db'))

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON')

  db.run(`
    CREATE TABLE IF NOT EXISTS indicadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      firebase_uid TEXT,
      cpf TEXT,
      pix TEXT,
      data_nascimento TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS empresas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_empresa TEXT NOT NULL,
      razao_social TEXT,
      cnpj TEXT UNIQUE NOT NULL,
      senha TEXT,
      firebase_uid TEXT,

      email TEXT NOT NULL,
      telefone TEXT,
      site TEXT,
      endereco TEXT,

      setor TEXT,
      tamanho TEXT,

      forma_pagamento TEXT,
      dados_pagamento TEXT,

      plano TEXT DEFAULT 'Plano Electio',
      curadoria_ia INTEGER DEFAULT 0,

      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`ALTER TABLE empresas ADD COLUMN senha TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Erro ao garantir coluna senha em empresas:', err.message)
    }
  })

  db.run(`ALTER TABLE empresas ADD COLUMN firebase_uid TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Erro ao garantir coluna firebase_uid em empresas:', err.message)
    }
  })

  db.run(`ALTER TABLE indicadores ADD COLUMN firebase_uid TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Erro ao garantir coluna firebase_uid em indicadores:', err.message)
    }
  })

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_firebase_uid
    ON empresas (firebase_uid)
    WHERE firebase_uid IS NOT NULL
  `)

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_indicadores_firebase_uid
    ON indicadores (firebase_uid)
    WHERE firebase_uid IS NOT NULL
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS vagas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      empresa TEXT NOT NULL,
      localizacao TEXT,
      salario TEXT,
      tipo TEXT,
      recompensa TEXT,
      descricao_curta TEXT,
      descricao_longa TEXT,
      beneficios TEXT,
      requisitos TEXT,
      imagem TEXT,
      area TEXT,
      destaque_banner INTEGER DEFAULT 0,
      banner_ativo INTEGER DEFAULT 0,
      empresa_id INTEGER,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas (id)
    )
  `)

  db.run(`ALTER TABLE vagas ADD COLUMN empresa_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Erro ao garantir coluna empresa_id em vagas:', err.message)
    }
  })

  db.run(`ALTER TABLE vagas ADD COLUMN destaque_banner INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Erro ao garantir coluna destaque_banner em vagas:', err.message)
    }
  })

  db.run(`ALTER TABLE vagas ADD COLUMN banner_ativo INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Erro ao garantir coluna banner_ativo em vagas:', err.message)
    }
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_vagas_empresa_id ON vagas (empresa_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_vagas_banner ON vagas (banner_ativo, destaque_banner)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS candidatos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicador_id INTEGER NOT NULL,
      vaga_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      data_nascimento TEXT,
      genero TEXT,
      telefone TEXT,
      cargo_atual TEXT,
      anos_experiencia TEXT,
      escolaridade TEXT,
      proficiencia_idiomas TEXT,
      linkedin TEXT,
      portfolio TEXT,
      github TEXT,
      pontos_fortes TEXT,
      fit_cultural TEXT,
      destaques_projetos TEXT,
      narrativa TEXT,
      hard_skills TEXT,
      soft_skills TEXT,
      expectativa_salarial TEXT,
      modelo_trabalho TEXT,
      aviso_previo TEXT,
      curriculo_nome TEXT,
      status TEXT DEFAULT 'indicado',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (indicador_id) REFERENCES indicadores (id),
      FOREIGN KEY (vaga_id) REFERENCES vagas (id)
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_candidatos_indicador_id ON candidatos (indicador_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_candidatos_vaga_id ON candidatos (vaga_id)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS statusIndicador (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicador_id INTEGER NOT NULL UNIQUE,
      total_indicacoes INTEGER DEFAULT 0,
      vagas_ativas INTEGER DEFAULT 0,
      vagas_canceladas INTEGER DEFAULT 0,
      vagas_sucesso INTEGER DEFAULT 0,
      valor_recebido REAL DEFAULT 0,
      valor_pendente REAL DEFAULT 0,
      taxa_sucesso REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (indicador_id) REFERENCES indicadores (id)
    )
  `)

  db.run(`
    INSERT OR IGNORE INTO indicadores (id, nome, email, senha, cpf, pix)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    2,
    'Indicador Selectio',
    'indicador2@selectio.local',
    bcrypt.hashSync('Selectio@123456', 10),
    '000.000.000-00',
    'indicador2@selectio.local'
  ])

  db.run(`
    INSERT INTO statusIndicador (
      indicador_id,
      total_indicacoes,
      vagas_ativas,
      vagas_canceladas,
      vagas_sucesso,
      valor_recebido,
      valor_pendente,
      taxa_sucesso
    )
    SELECT 2, 12, 8, 1, 3, 4500, 1500, 25
    WHERE EXISTS (SELECT 1 FROM indicadores WHERE id = 2)
    ON CONFLICT(indicador_id) DO UPDATE SET
      total_indicacoes = excluded.total_indicacoes,
      vagas_ativas = excluded.vagas_ativas,
      vagas_canceladas = excluded.vagas_canceladas,
      vagas_sucesso = excluded.vagas_sucesso,
      valor_recebido = excluded.valor_recebido,
      valor_pendente = excluded.valor_pendente,
      taxa_sucesso = excluded.taxa_sucesso,
      updated_at = CURRENT_TIMESTAMP
  `)
})

module.exports = db
