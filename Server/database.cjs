const sqlite3 = require('sqlite3').verbose()

const db = new sqlite3.Database('./selectio.db')

db.serialize(() => {
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
})

db.run(`
  CREATE TABLE IF NOT EXISTS empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_empresa TEXT NOT NULL,
    razao_social TEXT,
    cnpj TEXT UNIQUE NOT NULL,

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


module.exports = db