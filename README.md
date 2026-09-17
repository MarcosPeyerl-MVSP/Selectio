# Selectio

<p align="center">
  <img src="./src/assets/Selectio_vermelho_sem_fundo.png" alt="Selectio" width="180" />
</p>

<p align="center">
  <strong>SaaS de recrutamento por indicação para conectar empresas, indicadores e talentos qualificados.</strong>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=fff" />
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=111" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22-5FA04E?logo=node.js&logoColor=fff" />
  <img alt="npm" src="https://img.shields.io/badge/npm-package--lock-CB3837?logo=npm&logoColor=fff" />
</p>

## Visão Geral

Selectio é uma plataforma web para operações de recrutamento baseadas em indicação. O produto organiza a publicação de vagas, o cadastro de candidatos, o acompanhamento de processos seletivos, o ranking de compatibilidade por rubrica e o fluxo financeiro de recompensas.

O projeto combina uma aplicação React/Vite com Firebase Authentication, Firestore, Storage e Cloud Functions. A camada serverless concentra operações sensíveis, como criação de checkout no Mercado Pago, validação de webhook, sincronização de pagamentos e solicitação de saques.

## Principais Funcionalidades

- Área pública com home, listagem de vagas e detalhes de oportunidades.
- Cadastro e autenticação de empresas e indicadores com rotas protegidas por perfil.
- Painel de empresa para criar, editar e gerenciar vagas, candidatos, entrevistas e pagamentos.
- Modo empresarial com setores internos: Administrador da Empresa, Chefe de Departamento, Reitoria/Auditoria e Setor RH.
- Painel de indicador com cadastro manual de candidatos, importação CSV, indicações, métricas e financeiro.
- Pré-cadastro de talentos para reutilização em futuras indicações.
- Pipeline de candidatos com status como indicado, entrevista, contratado, recusado e cancelado.
- Agendamento e acompanhamento de entrevistas com histórico e notificações.
- Ranking de compatibilidade por vaga, com rubrica ponderada, evidências, alertas e revisão humana.
- Validação obrigatória antes da indicação, com compatibilidade superior a 45% e autorização no servidor. [Funcionamento, testes e publicação](docs/validacao-indicacao.md).
- Extração de currículo no navegador para PDF e DOCX, com OCR para PDFs pouco textuais quando suportado pelo navegador.
- Integração com Mercado Pago para pagamento de recompensas, webhook assinado e registro de transações.
- Painel administrativo para visão geral, empresas, indicadores, vagas, candidatos e financeiro em modo de leitura.
- Internacionalização em `pt-BR` e `en-US`.
- Tema, notificações, toasts, confirmações e onboarding guiado.
- Regras de segurança de Firestore e Storage cobertas por testes.

## Stack

| Área | Tecnologia |
| --- | --- |
| Interface | React 18, React DOM, React Router |
| Build | Vite 8 |
| Backend serverless | Firebase Cloud Functions v2, Node.js 22 |
| Dados | Firebase Firestore |
| Autenticação | Firebase Authentication |
| Arquivos | Firebase Storage |
| Pagamentos | Mercado Pago via Cloud Functions |
| i18n | i18next, react-i18next, language detector |
| Currículos | pdfjs-dist, mammoth, tesseract.js, Web Worker |
| Análise semântica | `@huggingface/transformers` carregado via CDN no worker |
| Visualização de dados | Recharts |
| Qualidade | ESLint, Node Test Runner, Firebase Emulator Suite |
| Segurança | Hooks locais e scanner de segredos versionados |

## Arquitetura

```text
Selectio/
├── docs/
│   └── mercado-pago-functions.md
├── functions/
│   ├── index.cjs
│   ├── package.json
│   └── src/
│       └── mercadoPagoCore.cjs
├── public/
├── scripts/
│   ├── check-secrets.cjs
│   ├── check-translations.cjs
│   └── migrar-curriculos-legados.cjs
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── compatibilidade/
│   │   ├── dashboard/
│   │   ├── entrevistas/
│   │   ├── layout/
│   │   ├── notificacoes/
│   │   ├── onboarding/
│   │   ├── pagamentos/
│   │   └── ui/
│   ├── hooks/
│   ├── i18n/
│   ├── pages/
│   │   ├── admin/
│   │   ├── cadastro/
│   │   ├── empresa/
│   │   ├── indicador/
│   │   └── public/
│   ├── services/
│   │   └── compatibilidade/
│   ├── styles/
│   ├── utils/
│   ├── workers/
│   ├── App.jsx
│   └── main.jsx
├── tests/
├── firebase.json
├── firestore.rules
├── storage.rules
├── vite.config.js
└── package.json
```

### Fluxo de Dados

- O frontend usa Firebase Client SDK para autenticação, Firestore e Storage.
- Rotas protegidas validam sessão e tipo de perfil antes de liberar cada painel.
- Operações financeiras não são gravadas diretamente pelo cliente. Elas passam por `mercadoPagoApi`, uma Cloud Function v2 na região `southamerica-east1`.
- Regras de Firestore e Storage limitam leitura e escrita por papel, propriedade do registro e formato do payload.
- As análises do ranking são calculadas no navegador, em Web Worker, e salvas em `analisesCompatibilidade` pela empresa dona da vaga. A validação prévia à indicação é calculada no servidor e preservada separadamente em `analisesIndicacao`.

### Coleções Principais

| Coleção | Papel |
| --- | --- |
| `users` | Perfil base do usuário autenticado |
| `empresas` | Dados corporativos e modo empresarial |
| `indicadores` | Perfil dos indicadores |
| `vagas` | Oportunidades publicadas ou em fluxo empresarial |
| `candidatos` | Candidatos indicados para vagas |
| `candidatosPreSalvos` | Base privada de talentos do indicador |
| `indicacoes` | Relação entre indicador, candidato, vaga e empresa |
| `entrevistas` | Agenda e status de entrevistas |
| `historicoProcesso` | Eventos relevantes do processo seletivo |
| `analisesCompatibilidade` | Resultados do ranking por vaga e candidato |
| `pagamentos` | Pagamentos de recompensa |
| `transacoesPagamento` | Espelho transacional do fluxo Mercado Pago |
| `indicadorSaldos` | Saldo financeiro do indicador |
| `movimentacoesFinanceiras` | Créditos, saques e movimentações |
| `notificacoes` | Notificações por usuário |
| `saques` | Solicitações de saque |

## Pré-requisitos

- Node.js 22 ou superior, recomendado para manter compatibilidade com as Functions.
- npm, pois o projeto usa `package-lock.json`.
- Firebase CLI, via `npx firebase` ou instalação global.
- Projeto Firebase com Authentication, Firestore, Storage e Cloud Functions habilitados.
- Conta Mercado Pago para executar o fluxo real ou sandbox de pagamentos.

## Instalação Local

Instale as dependências do frontend:

```powershell
npm install
```

Instale as dependências das Cloud Functions:

```powershell
npm run functions:install
```

Durante o `npm install`, o script `prepare` configura os hooks locais em `.githooks` para bloquear commits e pushes com possíveis credenciais.

## Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto. Arquivos `.env*` são ignorados pelo Git.

```dotenv
VITE_FIREBASE_API_KEY=seu_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_project_id
VITE_FIREBASE_STORAGE_BUCKET=seu_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id

VITE_APP_URL=http://localhost:5173
VITE_USE_FUNCTIONS_EMULATOR=false
VITE_MERCADO_PAGO_API_URL=
```

Variáveis opcionais:

- `VITE_USE_FUNCTIONS_EMULATOR=true`: força o frontend, em desenvolvimento, a usar a Function local em `http://127.0.0.1:5001`.
- `VITE_MERCADO_PAGO_API_URL`: sobrescreve a URL da API de pagamentos.
- `VITE_APP_URL`: URL enviada à Cloud Function para montar retornos do checkout.

Para desenvolvimento local das Functions com Mercado Pago, crie `functions/.secret.local`:

```dotenv
MERCADO_PAGO_ACCESS_TOKEN=seu_token_de_teste
MP_WEBHOOK_SECRET=seu_segredo_de_assinatura
```

Para deploy, configure secrets pela Firebase CLI:

```powershell
npx firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN
npx firebase functions:secrets:set MP_WEBHOOK_SECRET
```

Valores não secretos das Functions podem ficar em `functions/.env.<project-id>`:

```dotenv
MP_ENVIRONMENT=sandbox
APP_URL=https://seu-app.web.app
```

## Executando em Desenvolvimento

Inicie o frontend:

```powershell
npm run dev
```

A aplicação fica disponível em:

```text
http://localhost:5173
```

Por padrão, o frontend calcula a URL da Cloud Function publicada a partir de `VITE_FIREBASE_PROJECT_ID`. Para trabalhar com emuladores, execute em outro terminal:

```powershell
npm run functions:serve
```

E use:

```dotenv
VITE_USE_FUNCTIONS_EMULATOR=true
```

## Scripts Disponíveis

| Script | Descrição |
| --- | --- |
| `npm run dev` | Inicia o Vite em modo desenvolvimento |
| `npm run build` | Gera o build de produção em `dist/` |
| `npm run preview` | Serve o build localmente para inspeção |
| `npm run lint` | Executa ESLint no projeto |
| `npm run i18n:check` | Verifica consistência das traduções |
| `npm run test:compatibility` | Testa o motor de compatibilidade |
| `npm run test:rules` | Testa regras do Firestore com emuladores |
| `npm run test:storage` | Testa regras do Storage com emuladores |
| `npm run test:functions` | Testa a API de pagamentos em Cloud Functions |
| `npm run security:check` | Procura possíveis segredos em arquivos versionados |
| `npm run security:history` | Procura possíveis segredos no histórico Git |
| `npm run security:test` | Executa o autoteste do scanner de segredos |
| `npm run security:setup` | Reconfigura os hooks locais do Git |
| `npm run functions:install` | Instala dependências em `functions/` |
| `npm run functions:serve` | Inicia emuladores de Functions e Firestore |
| `npm run functions:deploy` | Publica a Function `mercadoPagoApi` |
| `npm run functions:logs` | Consulta logs da Function `mercadoPagoApi` |
| `npm run storage:migrate` | Executa migração de currículos legados |
| `npm run storage:deploy` | Publica regras do Firebase Storage |

## Qualidade e Segurança

Antes de abrir uma alteração, execute os comandos principais:

```powershell
npm run lint
npm run i18n:check
npm run test:compatibility
npm run build
```

Para validar regras e backend serverless:

```powershell
npm run test:rules
npm run test:storage
npm run test:functions
```

Para varredura de credenciais:

```powershell
npm run security:check
```

Boas práticas já presentes no projeto:

- Secrets financeiros ficam fora do código e são lidos por Cloud Functions.
- Webhooks do Mercado Pago exigem assinatura válida.
- Firestore bloqueia escrita direta em pagamentos, saldos, transações e saques.
- Storage valida tipo, tamanho e metadados de currículos e fotos.
- Evidências da análise de compatibilidade passam por sanitização de dados pessoais.
- Hooks locais verificam segredos antes de commit e push.
- Fluxos críticos possuem testes com Node Test Runner e Firebase Emulator Suite.

## Build de Produção

Gere os artefatos estáticos:

```powershell
npm run build
```

Faça uma inspeção local do build:

```powershell
npm run preview
```

O build é gerado em `dist/`.

## Deploy

Autentique a Firebase CLI e selecione o projeto:

```powershell
npx firebase login
npx firebase use seu_project_id
```

Publique a Cloud Function de pagamentos:

```powershell
npm run functions:deploy
```

Publique as regras do Firestore:

```powershell
npx firebase deploy --only firestore:rules
```

Publique as regras do Storage:

```powershell
npm run storage:deploy
```

O `firebase.json` configura Functions, Firestore, Storage, emuladores e Firebase Hosting. O frontend usa o site `selectio-1f022`, em https://selectio-1f022.web.app, com fallback das rotas para `index.html`.

Para publicar o frontend, gere o build com a configuração Firebase de produção e execute:

```powershell
npm run build
npx firebase deploy --only hosting --project selectio-1f022
```

Para publicar a validação de indicações, siga a [ordem de publicação das funções, regras e frontend](docs/validacao-indicacao.md#publicação).

## Mercado Pago

A API financeira roda na Function v2 `mercadoPagoApi`, com runtime Node.js 22 e região `southamerica-east1`.

Principais responsabilidades:

- `GET /health`: diagnóstico básico da API.
- `POST /criar-preferencia`: cria checkout para recompensa de candidato contratado.
- `POST /sincronizar-pagamento`: sincroniza status de pagamento com o Mercado Pago.
- `POST /solicitar-saque`: registra solicitação de saque do indicador.
- `POST /webhook/mercado-pago`: recebe notificações assinadas do Mercado Pago.

Consulte a documentação detalhada em [`docs/mercado-pago-functions.md`](./docs/mercado-pago-functions.md).

## Compatibilidade de Candidatos

O módulo de compatibilidade usa uma rubrica configurável por vaga. A empresa define requisitos, pesos e critérios de revisão. O motor calcula nota, cobertura, evidências, alertas e discrepâncias entre formulário e currículo.

O worker de análise:

- extrai texto de PDFs com `pdfjs-dist`;
- usa OCR com `tesseract.js` quando o PDF não possui texto suficiente e o navegador oferece suporte;
- extrai DOCX com `mammoth`;
- carrega modelo semântico local via `@huggingface/transformers` por CDN;
- aplica fallback lexical quando a análise semântica não está disponível;
- sanitiza dados pessoais antes de expor evidências.

O ranking é um apoio à revisão humana e não rejeita candidatos automaticamente.

## Internacionalização

As traduções ficam em:

```text
src/i18n/locales/pt-BR/
src/i18n/locales/en-US/
```

Idiomas suportados:

- `pt-BR`, idioma padrão.
- `en-US`.

Para validar consistência entre namespaces:

```powershell
npm run i18n:check
```

## Contribuição

Fluxo sugerido:

1. Crie uma branch a partir da base principal.
2. Instale dependências com `npm install` e `npm run functions:install`.
3. Faça alterações pequenas, revisáveis e alinhadas aos padrões existentes.
4. Atualize testes ou traduções quando mudar comportamento visível.
5. Execute lint, build e testes relevantes.
6. Rode `npm run security:check` antes de enviar.
7. Abra um pull request com contexto, prints quando houver UI e lista de validações executadas.

## Roadmap

- TODO: definir licença pública ou política interna de uso.
- TODO: criar `.env.example` sem valores sensíveis.
- TODO: adicionar pipeline de CI para lint, build, testes de regras e scanner de segredos.
- TODO: documentar matriz completa de permissões por papel.
- TODO: expandir configurações administrativas globais, atualmente sinalizadas como recurso futuro.
- TODO: adicionar testes end-to-end para fluxos principais de empresa, indicador e pagamentos.

## Licença

TODO: definir a licença do projeto.

## Equipe

TODO: informar autor, equipe responsável ou organização mantenedora.
