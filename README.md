# Selectio — Plataforma de Indicações e Recrutamento

Projeto **full stack** do MVP da plataforma **Selectio / HeadReward**, focada em conectar **empresas**, **indicadores** e **headhunters**.

---

## Estrutura do Projeto

```
selectio/
├─ selectio/        # Frontend (React + Vite)
└─ server/          # Backend (Node.js + Express + SQLite)
```

---

## Pré-requisitos

Antes de começar, você precisa ter instalado:

- **Node.js** (versão LTS)
- **npm** (vem com o Node)
- **Git**

Recomendado:
- VS Code
- Extensão SQLite Viewer

---

## Como rodar o projeto

### Clonar o repositório

```bash
git clone https://github.com/MarcosPeyerl-MVSP/Selectio
cd selectio
```

---

## Backend (API + Banco de Dados)

### Entrar na pasta do backend

```bash
cd server
```

### Instalar dependências

```bash
npm install
```

### Rodar o backend

```bash
npm run dev
```

ou

```bash
node index.cjs
```

✅ Backend disponível em:
```
http://localhost:3333
```

O banco `selectio.db` é criado automaticamente.

---

## Frontend (React)

Abra **outro terminal**.

### Entrar na pasta do frontend

```bash
cd selectio
```

### Instalar dependências

```bash
npm install
```

### Rodar o frontend

```bash
npm run dev
```

✅ Frontend disponível em:
```
http://localhost:5173
```

---

## 🔁 Comunicação Frontend ↔ Backend

- Frontend envia requisições para:
```
http://localhost:3333
```

Exemplo:
```
POST /indicador/cadastro
```

⚠️ O backend deve estar rodando para o sistema funcionar.

---

Projeto MVP da plataforma **Selectio / HeadReward**.
