# Selectio

MVP SaaS de recrutamento e indicacao de talentos feito com React + Vite e servicos gerenciados do Firebase.

O projeto usa:

- Firebase Auth para autenticacao.
- Cloud Firestore para perfis, empresas, indicadores, vagas, candidatos e indicacoes.
- React Router para rotas do painel.
- CSS modular e React Icons para a interface.

## Estrutura

```text
Selectio/
  Selectio/   # Frontend React + Vite
```

## Variaveis de ambiente

Crie/configure as variaveis Vite do Firebase em um arquivo `.env` local dentro da pasta `Selectio/`.

As variaveis devem seguir o padrao `VITE_*`, por exemplo:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_MERCADO_PAGO_PUBLIC_KEY=
VITE_APP_URL=
```

Arquivos `.env` e `env` nao devem ser versionados.

## Mercado Pago e Cloud Functions

A integracao de pagamentos usa Firebase Cloud Functions. O Access Token do Mercado Pago nunca deve ser colocado no frontend.

Configure as variaveis das Functions no ambiente seguro:

```text
MERCADO_PAGO_ACCESS_TOKEN=
APP_URL=
MP_WEBHOOK_SECRET=
MP_WEBHOOK_URL=
```

- `APP_URL` deve apontar para a URL do frontend.
- `MP_WEBHOOK_SECRET` e opcional e, quando definido, e anexado ao `notification_url`.
- `MP_WEBHOOK_URL` e opcional; sem ele a Function monta a URL padrao de `mercadoPagoWebhook`.

Fluxo de teste:

1. Configure as variaveis do frontend e das Functions com credenciais de teste.
2. Instale dependencias em `functions/` com `npm install`.
3. Rode emuladores ou publique as Functions.
4. Entre como empresa e deixe um candidato indicado com status `contratado`.
5. Clique em `Pagar recompensa` e finalize o checkout com cartao de teste.
6. Confirme o webhook em `pagamentos`, `indicadorSaldos`, `movimentacoesFinanceiras` e `notificacoes`.
7. Entre como indicador, abra `Financeiro`, confira saldo e solicite saque manual.

Limites atuais: nao ha split automatico, OAuth/marketplace, saque automatico por API, painel admin completo, nota fiscal ou antifraude avancado.

## Como Rodar

Instale as dependencias:

```bash
npm install
```

Rode em desenvolvimento:

```bash
npm run dev
```

## Observacoes

Nao ha servidor local necessario para executar o projeto. Os dados principais do MVP ficam no Firebase Auth e no Cloud Firestore.
