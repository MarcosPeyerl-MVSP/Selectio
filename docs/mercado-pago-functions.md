# Mercado Pago em Cloud Functions

Para achados, limites verificados e roteiro de apresentação, consulte a
[revisão sandbox de 19/10/2026](revisao-sandbox-2026-10-19.md).

A API de pagamentos e saques roda na Function v2 `mercadoPagoApi`, na regiao
`southamerica-east1`. O frontend usa a Function publicada por padrao, inclusive
durante o desenvolvimento.

`MP_ENVIRONMENT=sandbox` também cobre contas de teste com credencial `APP_USR`.
Nesse caso o backend exige a tag `test_user` em `/users/me` e usa o `init_point`
da preferência, preservando o ambiente sandbox e sem liberar saldo real.
No fluxo legado de sandbox, usa `sandbox_init_point`. O domínio do checkout,
sozinho, não determina se o vendedor é uma conta de teste.

### Referencia externa compacta

Novas preferencias usam `external_reference=selectio:<pagamentoId>`. A chave
interna tem ate 180 caracteres, limitando a referencia a 189. Nao repetir os
IDs de empresa, indicador, vaga, candidato e indicacao nessa string: esses
vinculos permanecem no documento interno e nos metadados existentes. O parser
continua aceitando referencias antigas com campos separados por `:`. A
conciliacao exige a referencia original ou a referencia reparada explicitamente
registrada pelo servidor para um pagamento legado de sandbox.

Na comparacao de 21/10/2026, o checkout Selectio que falhava tinha referencia
de 273 caracteres; pagamentos Selectio antigos aprovados tinham 182. Checkouts
isolados de R$ 10 e R$ 1.850 foram confirmados pela API como approved, na mesma
aplicacao e seller. Reduzir a referencia remove essa diferenca relevante, mas
a causa externa so fica confirmada com nova compra usando a preferencia completa.

Essa mudanca nao reescreve preferencias ou registros antigos. Depois do deploy
da Function, testar com outro candidato de demonstracao ainda sem pagamento,
para efetivamente gerar uma preferencia com a referencia nova. Continuar um
checkout antigo reutiliza a preferencia anterior e nao valida esta correcao.

### Recuperacao das preferencias antigas de sandbox

Depois de publicar backend e frontend, em Pagamentos clique **Atualizar status**
no registro antigo. Se nao houver pagamento encontrado, o servidor pode reparar
uma referencia acima de 256 caracteres na mesma preferencia, mantendo seu link.
Ao aparecer a confirmacao de checkout corrigido, abra **Continuar checkout** em
uma nova navegacao. Nao reutilize uma aba de checkout aberta antes da correcao.

O reparo exige registro sandbox created/pending sem credito/payment ID, seller
APP_USR test_user correspondente ao collector da preferencia, metadata com o ID
interno correto e mesmo valor/moeda. Confere tambem todas as ordens da preferencia
e a referencia nova; qualquer pagamento, valor pago ou resultado incompleto
impede o reparo. As ordens ja abertas sem pagamentos nao sao excluidas.

Antes do PUT que altera exclusivamente external_reference, uma transacao grava
`externalReferenceReparada=selectio:<pagamentoId>` no registro interno. A
`externalReference` original permanece como historico. O servidor aceita ambas
na conciliacao desse registro legado sandbox, inclusive em retries apos timeout.
Outras referencias e pagamentos de outras empresas continuam recusados. Nao ha
nova preferencia, novo pagamento, credito real, limpeza de banco ou reparo
automatico em producao. A recuperacao ocorre somente ao consultar o status; o
deploy sozinho nao modifica as preferencias existentes.

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
APP_URL=https://selectio.app.br
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

### Deploy da demonstracao sandbox em selectio.app.br

O build usa `.env.production.local` na raiz, com `VITE_APP_URL=https://selectio.app.br`,
`VITE_USE_FUNCTIONS_EMULATOR=false` e a URL HTTPS da API publicada. Isso preserva
o `.env` de desenvolvimento. As Functions usam `functions/.env.selectio-1f022`
com `APP_URL=https://selectio.app.br` e `MP_ENVIRONMENT=sandbox`. Esses arquivos
sao ignorados pelo Git; recrie-os em outra maquina. `functions/.env.local` e
`functions/.secret.local` sao configuracoes do emulador e nao atualizam o deploy.
`npm run deploy:check` tambem confere a correspondencia das origens do frontend
e backend para evitar erros de CORS e de retorno.

Antes de publicar, execute na raiz (os comandos de secrets solicitam os valores
no terminal; nao cole o conteudo inteiro do arquivo nem inclua `NOME=`):

```powershell
npm run deploy:check
npx firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN --project selectio-1f022
npx firebase deploy --only functions:mercadoPagoApi,hosting --project selectio-1f022
```

Use o Access Token do seller novo e o segredo Webhooks da aplicacao que envia
as notificacoes. Sendo a mesma aplicacao, preserve o `MP_WEBHOOK_SECRET` remoto
existente se nao foi regenerado. Se mudou ou ainda nao foi cadastrado, execute
`npx firebase functions:secrets:set MP_WEBHOOK_SECRET --project selectio-1f022`
antes do deploy. Nunca publique essas credenciais como `VITE_*`. A publicacao
do Hosting executa a validacao e o build pelos hooks existentes.

Ao trocar o seller, use outro candidato de demonstracao ainda sem pagamento
para gerar uma preferencia nova. Links do historico continuam pertencendo ao
seller que criou a preferencia; nao se transfere um checkout ao trocar o token.
Nao exclua reservas de pagamentos pendentes para forcar novas cobrancas.
Teste com o buyer distinto, do mesmo pais, em janela anonima. Primeiro confirme
o retorno e a consulta de status; `approved` em sandbox nao libera saldo real.
Os testes locais nao comprovam aprovacao do checkout externo.

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
