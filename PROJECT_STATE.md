# Selectio — snapshot operacional

Last verified:

- Date: 2026-10-01 (America/Sao_Paulo).
- Commit: `df302950145eed1256cb6d6a405fa2906af8fbef` (`frontend 2`).
- Branch: `main` no início; working tree limpo.
- Branch desta tarefa: `chore/agent-governance`.

Este é o snapshot técnico observado no commit-base acima. Revisão do processo em 2026-10-08, baseada em `00863f6`, com working tree inicialmente limpo em `chore/agent-governance`: modelo de desenvolvimento atualizado conforme orientação do responsável. Esta revisão documental não revalida toda a arquitetura ou a configuração remota. Revalide antes de usar; não é certificação de produção. **VERIFICADO** abaixo significa inspeção local, salvo quando a consulta remota é explicitamente identificada.

## Product

Plataforma de recrutamento por indicação: empresas publicam vagas e acompanham candidatos, indicadores mantêm talentos e indicam pessoas, e contratações alimentam recompensas. Há áreas pública, de empresa, indicador e admin, pipeline, entrevistas, notificações e apoio de compatibilidade. Decisões de contratação continuam humanas.

## Runtime / stack

**VERIFICADO:** `package.json` declara React 18, Vite 8, JavaScript ESM, React Router 7, Firebase SDK 12, i18next/react-i18next e Recharts. PDF/DOCX/OCR usam pdfjs-dist, mammoth e tesseract.js. Functions usam CommonJS, firebase-admin 14, firebase-functions 7 e Node 22 (`functions/package.json`, `firebase.json`). Node local: 24.1.0; npm: 11.3.0. CI usa Node 22; resultado local não substitui esse runtime.

## Architecture / critical paths

| Fluxo | Fronteira e evidência |
| --- | --- |
| Auth e dados sensíveis | `AuthProvider`, `ProtectedRoute`, `firestoreUsers.js`; Firebase Auth fornece identidade. Rules e Functions autorizam dados. Cache de perfil/setor em localStorage não é fronteira de segurança. Admin reconhecido pelo perfil em `users`; não presumir custom claims |
| Vagas / empresa | `firestoreVagas.js`, `EmpresaModoEmpresarial.jsx` e `firestore.rules`: SDK direto, autorização por UID da empresa; leitura pública de documentos de vagas |
| Indicação | `indicacoesApi.js` → callable `indicacoesApi` → `indicacoesCore.cjs`: análise de servidor, elegibilidade estritamente acima de 45%, revalidação e criação transacional de candidato/indicação/snapshot/histórico/notificações; deduplicação e autorização privada |
| Compatibilidade | Worker no navegador → `analisesCompatibilidade`; validação de entrada no servidor → `analisesIndicacao`. Motor/rubrica em `functions/shared/`. Semântica via CDN no navegador com fallback lexical; servidor usa motor lexical. Pontuações podem diferir |
| Currículos | Upload direto ao Storage para pré-salvos/temporários, cópia protegida pelo servidor para indicados. PDF/DOCX no worker Node; OCR no navegador. Rules aceitam DOC legado, mas extração de servidor o rejeita |
| Pagamentos | `firestorePagamentos.js` / `firebaseFunctions.js` → HTTP `mercadoPagoApi` → Mercado Pago. Backend valida ID token, App Check em produção, ownership e webhook assinado; cliente não escreve coleções financeiras |
| Saques | `solicitarSaque` em `mercadoPagoCore.cjs` reserva saldo em transação e registra solicitação/movimentação; isso não comprova execução de transferência bancária |

Coleções observadas nas Rules e nos serviços: `users`, `empresas`, `indicadores`, `vagas`, `candidatos`, `candidatosPreSalvos`, `indicacoes`, `entrevistas`, `historicoProcesso`, `notificacoes`, `analisesCompatibilidade`, `analisesIndicacao`, `validacoesIndicacao`, `indicacoesUnicas`, `pagamentos`, `transacoesPagamento`, `indicadorSaldos`, `movimentacoesFinanceiras`, `saques` e `limitesUso`. As três coleções de controle `validacoesIndicacao`, `indicacoesUnicas` e `limitesUso` são inacessíveis ao cliente.

## Current infrastructure

**Verified in repository:** `firebase.json` configura Hosting de `dist/`, fallback SPA, headers, predeploy com `deploy:check` e build, Rules, Functions Node 22 e emuladores locais. `functions/index.cjs` exporta `indicacoesApi`, `mercadoPagoApi` e o scheduler diário `limparValidacoesIndicacao`, todos em `southamerica-east1`. O frontend inicializa Auth, Firestore, Storage e App Check condicional à chave pública.

`npm run functions:deploy` publica apenas `mercadoPagoApi`; `functions:deploy:referral` publica as duas Functions de indicação. Hosting não publica Rules/Functions. Não há deploy no workflow de CI inspecionado.

**Unknown / requires production verification:** disponibilidade real do Hosting, versões publicadas de Rules/Functions, enforcement App Check de Firestore/Storage, validade da chave/domínios, secrets, ambiente Mercado Pago, webhook, IAM, CORS do bucket, índices, TTL/lifecycle, backups/restauração e orçamento/monitoramento. Nenhum dado real foi consultado.

## CI / tests

**VERIFICADO:** `.github/workflows/security.yml` roda em push, pull_request e workflow_dispatch, com permissões `contents: read` e cancelamento de execuções concorrentes. Jobs:

- `quality`: scanner, autoteste, ESLint e i18n.
- `tests`: unitários, emuladores Firestore/Storage (Rules, indicações, cotas e pagamentos concorrentes), API HTTP no emulador Functions; Node 22/Java 21.
- `audit`: `npm audit --package-lock-only --omit=dev --audit-level=high` na raiz e em `functions`.
- `build`: build de produção.
- `security`: agregador exige sucesso de todos os anteriores, inclusive em push direto à `main`. É o check a considerar caso proteção de branch seja adotada futuramente.

`tests/` cobre compatibilidade/rubrica/elegibilidade, extração PDF/DOCX, CSV, metadados de currículos, onboarding, dashboard e redirects; suites de emuladores cobrem acesso/ownership, snapshots, duplicidade, cotas, assinatura, concorrência, dinheiro inválido e API HTTP. Não há suíte E2E de navegador versionada. Existência de testes não comprova execução atual nem cobre todos os cenários financeiros.

**Executado na revisão técnica de 2026-10-01 (Node 24.1.0), não repetido integralmente em 2026-10-08:** `security:check`, `security:test`, `lint`, `i18n:check`, `build` e `deploy:check` passaram; `test:unit` passou com 43 testes, zero falhas ou skips. Build avisou sobre chunks acima de 500 kB e a suite de extração emitiu aviso do parser PDF, sem falhar. Emuladores, `test:functions` e npm audit não foram executados: aquela tarefa alterou somente documentação/templates, sem runtime, regras ou dependências.

Na revisão de processo de 2026-10-08, `security:check`, `lint`, `i18n:check` e `build` passaram. Build manteve aviso de chunks acima de 500 kB. Diff e links dos documentos foram revisados. Unitários, emuladores, testes de Functions e npm audit não foram repetidos: somente documentação/processo foi alterado.

## Known technical debt / risks

Revisão da [auditoria de 17/09/2026](docs/auditoria-pre-deploy.md) contra o commit-base; nenhuma dessas áreas foi corrigida nesta tarefa.

| Item histórico | Classificação atual | Evidência / limite |
| --- | --- | --- |
| Quantidade de uploads por conta | Confirmado | `storage.rules` permite IDs arbitrários em pré-salvos/temporários/fotos, com tamanho por arquivo; `storageCurriculos.js` e `storageFotosPerfil.js` usam `uploadBytes`, sem ticket/cota total server-side |
| Frequência de operações diretas Firestore | Confirmado | Serviços de vagas, pré-salvos e entrevistas usam SDK; `protecaoAbuso.cjs` limita apenas ações das APIs. Limite de documentos por query não limita frequência |
| Dados internos de vagas públicos | Confirmado | `match /vagas` permite get público e list limitada; `atualizarFluxoAprovacaoVaga` persiste comentários/histórico no mesmo documento. Não há projeção pública separada |
| Permissões entre setores | Confirmado | `AuthProvider` recupera setor local, `EmpresaModoEmpresarial.jsx` controla ações e `firestoreUsers.js` grava setores; Rules de vagas autorizam por UID da empresa, não por identidade/setor independente |
| Estorno/chargeback/conciliação e retry de saque | Confirmado | `processarPagamentoMercadoPago` credita approved uma vez, mas não lança compensação em refunded nem rejeita evento antigo por data; `solicitarSaque` cria ID novo sem chave de idempotência do cliente. Reserva de checkout incerto não implementa conciliação completa |
| App Check ausente na máquina | Possivelmente desatualizado | `npm run deploy:check` passou nesta sessão sem imprimir valores; o bloqueio local relatado em setembro não se reproduziu. Isso não prova chave válida/enforcement remoto: **Requires production verification** |
| Retenção e limpeza | Parcialmente resolvido | `limparExpiradas` remove cópias/órfãos associados e temporários, porém limita validações a 100 por execução diária e percorre `curriculos/`. Retenção geral e capacidade com crescimento permanecem pendentes; TTL/lifecycle remotos: **Requires production verification** |
| Paginação e índices | Parcialmente resolvido | `listarVagasPagina` usa cursor/orderBy/100. Pré-salvos seguem sem limite; notificações usam 50 e ordenação local; admin limita 500 e agrega no cliente. `firebase.json` não referencia manifesto de índices e nenhum está versionado. Índices reais: **Requires production verification** |
| Privacidade / operação / recuperação | Confirmado em parte; verificação externa necessária | `Footer.jsx` mantém links de privacidade/termos com `href="#"`. Políticas operacionais, backup/restauração, IAM, CORS e orçamento: **Requires production verification** |
| Números antigos de npm audit | Possivelmente desatualizado | Resultados de setembro não representam as dependências atuais. CI audita produção; auditoria npm não foi reexecutada nesta tarefa de documentação |

Proteções já presentes, não pendências a reabrir sem evidência: cotas transacionais e validação de corpo (`protecaoAbuso.cjs`), App Check nas APIs, reserva de checkout e prevenção de crédito duplicado (`mercadoPagoCore.cjs`), extração em worker com prazo/limites (`indicacoesCore.cjs`), paginação pública e suites no CI. Inspeção confirma implementação; homologação remota continua distinta.

## Current development workflow

**VERIFICADO localmente em 2026-10-01:** início limpo em `main`; `core.hooksPath=.githooks`, prepare, scanner staged no pre-commit e scanner do histórico enviado no pre-push. Criada `chore/agent-governance` sem alterar trabalho existente. A retomada em 08/10 começou limpa nessa branch, no commit `00863f6`.

**VERIFICADO remotamente em 2026-10-01:** [API da branch main](https://api.github.com/repos/MarcosPeyerl-MVSP/Selectio/branches/main) retornou o mesmo SHA local, `protected: false`, `protection.enabled: false` e checks obrigatórios vazios. Consulta administrativa `/branches/main/protection` retornou 403 (integração sem acesso); regras efetivas adicionais não foram auditadas. Não foi alterada configuração remota.

**Current development model — informado pelo responsável, atualizado em 2026-10-08:**

- Projeto em pré-produção, com um desenvolvedor principal.
- `main` usada como linha principal de desenvolvimento; mudanças pequenas e de baixo risco seguem trabalho local → diff → checks → commit → push → confirmar CI.
- CI roda em push; os checks locais continuam necessários antes de enviar.
- Branches usadas seletivamente para mudanças grandes, experimentais, arriscadas, longas, paralelas ou HIGH-RISK. PR é opcional; revisão humana de HIGH-RISK permanece necessária, sem approval formal de outra pessoa neste estágio.
- Issues/templates ajudam a organizar trabalho e não são etapas obrigatórias. Sem develop; consulte [CONTRIBUTING.md](CONTRIBUTING.md).

Branch protection não é requisito do fluxo de pré-produção escolhido; a ausência registrada em 01/10 não é uma pendência urgente de processo. O estado remoto não foi consultado novamente em 08/10. Reavalie PR obrigatório e proteção antes de produção real, usuários externos, pagamentos reais ou mais desenvolvedores simultâneos. Nessa revisão futura, considere o check `security` e bloqueios de force-push/deletion; não há exigência de 1 approval agora.

## Divergências documentais / do not assume

- README ainda lista CI como TODO, mas o workflow já existe. Sua tabela de scripts não é exaustiva; `package.json` é a referência.
- README apresenta detalhe de vaga como área pública; `src/App.jsx` protege `/vaga/:id`, embora as Rules permitam ler o documento publicamente.
- `docs/validacao-indicacao.md` relata Hosting desativado em setembro; README descreve site configurado. Nenhum dos dois comprova disponibilidade remota hoje.
- A documentação financeira lista menos rotas que o handler atual (que também trata atualização de status de candidato). Consulte o handler antes de alterar o fluxo.
- Build e `deploy:check` aprovados não provam prontidão para dinheiro real, enforcement, secrets, backups, IAM, CORS ou índices publicados. A flag de emulador Functions não conecta automaticamente os outros SDKs a emuladores.

## Next engineering priorities

1. Manter mudanças pequenas, diff revisado e checks locais/CI; usar branches para risco elevado e reavaliar proteção de `main` nos gatilhos acima.
2. Antes de ampliar uso público, tratar projeção pública de vagas, cotas de uploads/operações e requisitos reais de isolamento por setor.
3. Antes de dinheiro real, completar conciliação, compensações e idempotência de saque, com cenários sandbox revisados.
4. Verificar configuração remota/recuperação e priorizar paginação, índices e retenção com base no volume real.
