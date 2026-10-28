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


Idiomas suportados:

- `pt-BR`, idioma padrão.
- `en-US`.


## Equipe
- `Kalil Barreto`: Diretor Administrativo e Programador Front-end.
- `Gustavo de Amorim`: Diretor de Tecnologias e Programador Back-end.
- `Marcos Peyerl`: Diretor de Projetos e Analista de Sistemas.
