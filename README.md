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
MERCADO_PAGO_TEST_ACCESS_TOKEN=
MP_ENVIRONMENT=sandbox
APP_URL=
MP_WEBHOOK_SECRET=
MP_WEBHOOK_URL=
```

- `APP_URL` deve apontar para a URL do frontend.
- `MP_WEBHOOK_SECRET` valida o cabecalho `x-signature` enviado pelo Mercado Pago.
- `MP_WEBHOOK_URL` e opcional; sem ele a Function monta a URL padrao de `mercadoPagoWebhook`.
- Em sandbox, `MERCADO_PAGO_TEST_ACCESS_TOKEN` tem prioridade.

Fluxo de teste:

1. Configure as variaveis do frontend e das Functions com credenciais de teste.
2. Instale dependencias em `functions/` com `npm install`.
3. Rode emuladores ou publique as Functions.
4. Entre como empresa e deixe um candidato indicado com status `contratado`.
5. Clique em `Pagar recompensa` e finalize o checkout com cartao de teste.
6. Confirme o status em `pagamentos` e `transacoesPagamento`.
7. Em producao, confirme o webhook em `indicadorSaldos`, `movimentacoesFinanceiras` e `notificacoes`.
8. Entre como indicador, abra `Financeiro`, confira saldo e solicite saque manual.

Limites atuais: nao ha split automatico, OAuth/marketplace, saque automatico por API, painel admin completo, nota fiscal ou antifraude avancado.

### Teste local sem Blaze

O Checkout Pro pode ser testado localmente sem publicar Cloud Functions:

```bash
npm run sandbox:mercado-pago
npm run dev
```

O servidor de teste fica restrito a `127.0.0.1:8787`, usa
`MERCADO_PAGO_TEST_ACCESS_TOKEN` de `functions/.env` e cria preferencias no
ambiente sandbox. Use o Access Token exibido em `Testes > Credenciais de teste`.
O prefixo `APP_USR` tambem pode ser usado por contas de teste e, isoladamente,
nao identifica se a credencial e de producao.

O checkout sandbox abre em outra aba. Como URLs `http://localhost` nao sao
aceitas como `back_urls` pelo Mercado Pago e pagamentos de teste nao dependem
de webhook, a tela de pagamentos consulta a API pela `external_reference`
quando volta a receber foco ou quando a secao e aberta.

O modo local persiste:

- `pagamentos`: contexto da recompensa, valor, status e referencias.
- `transacoesPagamento`: status, valor/moeda, horario da transacao, criacao,
  atualizacao e encerramento.

Nenhum numero de cartao, validade ou codigo de seguranca e enviado ao Selectio
ou salvo no Firestore. Esses dados sao preenchidos somente no Checkout Pro
hospedado pelo Mercado Pago.

Pagamentos sandbox nao creditam o saldo real do indicador. O credito,
movimentacoes e notificacoes financeiras continuam exclusivos do fluxo de
producao confirmado pelo webhook.

Para testar, use uma conta compradora de teste diferente da conta vendedora e
os cartoes ficticios exibidos pelo Mercado Pago. Os dados do cartao devem ser
digitados apenas na pagina `sandbox.mercadopago.com.br`.

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

O frontend pode ser executado sem servidor adicional. Para testar pagamentos
sandbox, tambem e necessario executar `npm run sandbox:mercado-pago`.
