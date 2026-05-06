const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const db = new sqlite3.Database(path.join(__dirname, 'selectio.db'))

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON')

  db.run(`
    CREATE TABLE IF NOT EXISTS indicadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
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
})

module.exports = db
