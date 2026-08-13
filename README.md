# Selectio

MVP SaaS de recrutamento e indicacao de talentos feito com React, Vite e
Firebase.

## Rodar localmente

Instale as dependencias do frontend e das Functions:

```powershell
npm install
npm run functions:install
```

Inicie o frontend:

```powershell
npm run dev
```

O frontend fica em `http://localhost:5173` e usa por padrao a Cloud Function
publicada. O antigo servidor da porta 8787 nao e mais utilizado. Para trabalhar
totalmente offline com o Emulator Suite, consulte a documentacao abaixo.

## Mercado Pago

Consulte [docs/mercado-pago-functions.md](docs/mercado-pago-functions.md) para
configurar secrets, webhook, emuladores e deploy.

## Qualidade e seguranca

```powershell
npm run lint
npm run build
npm run test:functions
npm run test:rules
npm run security:check
```

O hook que bloqueia commits e pushes com credenciais e configurado durante o
`npm install`. Para reconfigura-lo:

```powershell
npm run security:setup
```
