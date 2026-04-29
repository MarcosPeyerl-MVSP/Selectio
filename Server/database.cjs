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

module.exports = db