# Selectio

MVP SaaS de recrutamento e indicacao de talentos feito com React + Vite e Firebase.

O projeto usa:

- Firebase Auth para autenticacao.
- Cloud Firestore para perfis, empresas, indicadores, vagas, candidatos, indicacoes e financeiro.
- Backend local Node para Mercado Pago.
- React Router para rotas do painel.
- CSS modular e React Icons para a interface.

## Pagamentos

O fluxo de Mercado Pago nao usa Firebase Cloud Functions. O Access Token fica apenas no backend local em `scripts/.env.local` ou em variaveis de ambiente da maquina.

O frontend chama `VITE_MERCADO_PAGO_SANDBOX_URL`, por exemplo:

```env
VITE_MERCADO_PAGO_SANDBOX_URL=http://127.0.0.1:8787
VITE_APP_URL=http://localhost:5173
```

O backend local cria preferencias, consulta status no Mercado Pago e atualiza Firestore com Firebase Admin SDK. Para isso, configure `scripts/.env.local` a partir de `scripts/.env.example`:

```env
MERCADO_PAGO_ACCESS_TOKEN=SEU_ACCESS_TOKEN_AQUI
MP_ENVIRONMENT=sandbox
MP_WEBHOOK_SECRET=SEU_WEBHOOK_SECRET_AQUI
APP_URL=http://localhost:5173
FIREBASE_PROJECT_ID=selectio-1f022
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.local.json
MERCADO_PAGO_SANDBOX_HOST=127.0.0.1
MERCADO_PAGO_SANDBOX_PORT=8787
```

`serviceAccount.local.json` nao deve ir para o Git.

## Rodar Local

Instale dependencias:

```bash
npm install
```

Ative o hook local que bloqueia commits com credenciais:

```bash
npm run security:setup
```

Em um terminal, rode o backend local Mercado Pago:

```bash
npm run sandbox:mercado-pago
```

Em outro terminal, rode o frontend:

```bash
npm run dev
```

Health check do backend:

```bash
curl http://127.0.0.1:8787/health
```

## Testar Checkout

1. Crie uma vaga com recompensa de valor fixo.
2. Indique um candidato.
3. Na conta empresa, marque o candidato como contratado.
4. Clique em pagar recompensa.
5. O frontend chama `POST /criar-preferencia` no backend local.
6. Finalize ou simule o checkout no Mercado Pago.
7. Na pagina Financeiro da empresa, clique em `Atualizar status`.
8. O backend chama o Mercado Pago, atualiza `pagamentos`, `transacoesPagamento`, saldo, movimentacoes e notificacoes.

Se a vaga estiver com recompensa percentual, `A combinar`, `Consultar` ou texto livre, o pagamento automatico e bloqueado ate a empresa definir um valor fixo.

Webhook em localhost e opcional. Ele so funciona com tunel ou backend publicado apontando para `POST /webhook/mercado-pago`.

## Seguranca

- Nunca coloque Access Tokens, private keys ou service accounts em variaveis `VITE_*`: elas fazem parte do JavaScript enviado ao navegador.
- Arquivos `.env`, `*firebase-adminsdk*.json`, `serviceAccount*.json`, chaves e certificados privados sao ignorados pelo Git.
- Rode `npm run security:check` antes de enviar alteracoes. O mesmo verificador roda no pre-commit, pre-push e no GitHub Actions.
- Use `npm run security:history` para auditar todos os commits locais, inclusive arquivos removidos depois.
- O backend local aceita apenas `localhost` e exige um Firebase ID token nas rotas de pagamento e saque.
- Pagamentos sandbox nao incrementam o saldo financeiro de producao.
- O webhook do Mercado Pago exige `MP_WEBHOOK_SECRET`.

Se uma credencial real ja tiver sido enviada para qualquer repositorio ou compartilhada, remova-la do Git nao basta: revogue e gere uma nova credencial imediatamente.
