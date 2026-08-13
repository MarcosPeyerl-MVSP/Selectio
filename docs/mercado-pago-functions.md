# Mercado Pago em Cloud Functions

A API de pagamentos e saques roda na Function v2 `mercadoPagoApi`, na regiao
`southamerica-east1`. O frontend usa a Function publicada por padrao, inclusive
durante o desenvolvimento.

## Desenvolvimento local

Instale as dependencias uma vez:

```powershell
npm install
npm run functions:install
```

Para exercitar pagamentos reais do sandbox no emulador, crie o arquivo local
ignorado `functions/.secret.local`:

```dotenv
MERCADO_PAGO_ACCESS_TOKEN=seu_token_de_teste
MP_WEBHOOK_SECRET=seu_segredo_de_assinatura
```

Os smoke tests de seguranca nao exigem valores reais, mas criar preferencias e
receber webhooks validos exige esses dois segredos.

Inicie os emuladores em um terminal:

```powershell
npm run functions:serve
```

Inicie o Vite em outro terminal:

```powershell
npm run dev
```

Para usar o emulador, defina `VITE_USE_FUNCTIONS_EMULATOR=true`. Nesse modo, o
frontend usa:

```text
http://127.0.0.1:5001/selectio-1f022/southamerica-east1/mercadoPagoApi
```

Para apontar deliberadamente para outra API, defina
`VITE_MERCADO_PAGO_API_URL`. Sem essas variaveis, a URL publicada e calculada a
partir do projeto Firebase.

## Segredos e deploy

Autentique a CLI e selecione o projeto:

```powershell
npx firebase login
npx firebase use selectio-1f022
```

Cadastre os dois segredos. Use primeiro as credenciais de teste/sandbox:

```powershell
npx firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN
npx firebase functions:secrets:set MP_WEBHOOK_SECRET
```

Os valores nao secretos ficam em `functions/.env.selectio-1f022`:

```dotenv
MP_ENVIRONMENT=sandbox
APP_URL=https://selectio-1f022.web.app
```

Esse arquivo e local e nao deve conter tokens ou senhas. Publique com:

```powershell
npm run functions:deploy
```

URL prevista da API:

```text
https://southamerica-east1-selectio-1f022.cloudfunctions.net/mercadoPagoApi
```

URL a cadastrar nos Webhooks do Mercado Pago, para eventos de pagamentos:

```text
https://southamerica-east1-selectio-1f022.cloudfunctions.net/mercadoPagoApi/webhook/mercado-pago
```

O segredo de assinatura exibido pelo Mercado Pago deve ser o valor cadastrado
em `MP_WEBHOOK_SECRET`. Se ele mudar, atualize o secret e publique novamente.

## Rotas

- `GET /health`: diagnostico sem dados sensiveis.
- `POST /criar-preferencia`: requer Firebase ID token de empresa.
- `POST /sincronizar-pagamento`: requer Firebase ID token de empresa.
- `POST /solicitar-saque`: requer Firebase ID token do indicador.
- `POST /webhook/mercado-pago`: publica, mas exige assinatura valida.

## Validacao

```powershell
npm run test:functions
npm run test:rules
npm run build
```
