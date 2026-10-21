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

### Recuperacao das preferencias antigas — 21/10/2026

Base `d2f7cf1`, mesma branch e trabalho local preservado. Responsavel informou aprovacao da nova preferencia completa apos publicar referencia compacta. Inventario GET de 31 pagamentos encontrou 12 aprovados e 9 registros sandbox pendentes com referencia acima de 256 caracteres e sem payment ID, candidatos a verificacao individual. Implementado reparo em sincronizarPagamentoMercadoPago, acionado por Atualizar status: somente sandbox/test_user, mesma empresa e collector, valor/moeda e metadata correspondentes, sem pagamentos/valores recebidos em ordens completas. Transacao registra externalReferenceReparada antes de PUT apenas da referencia da mesma preferencia; referencia original e demais dados sao preservados e ambas conciliaveis, inclusive apos timeout. Producao, aprovados, referencia arbitraria, outro usuario e consultas incompletas nao autorizam reparo. Frontend informa quando pode reabrir o checkout. Nenhuma preferencia antiga foi alterada pelo agente; recuperacao depende de publicar a versao e consultar status. Validacao final: 82 testes de seguranca nos emuladores, 61 unitarios e 4 HTTP Functions aprovados; lint, i18n, scanner, deploy:check, diff e build passaram. Casos incluem retry apos timeout, conciliacao das duas referencias, exclusao de producao/aprovados, seller divergente e ownership. Node local 24, runtime declarado 22; permanece o aviso de chunks grandes no build. Nao houve teste de pagamento externo da recuperacao nesta etapa.

### Referencia compacta do checkout — 21/10/2026

Base `d2f7cf1`, branch `fix/mercado-pago-sandbox`, preservadas alteracoes anteriores. Checkouts isolados de R$ 10 e R$ 1.850, criados em conta test_user apos validacao de identidade, foram pagos manualmente pelo responsavel com saldo; consulta GET confirmou approved/accredited. Comparacao de preferencias confirmou mesma aplicacao e seller, e referencia externa de 273 caracteres na preferencia Selectio que falha; pagamentos antigos aprovados pelo Selectio tinham 182. Corrigido `montarReferenciaExterna` em mercadoPagoCore: novas cobrancas usam somente `selectio:<pagamentoId>` (ate 189 caracteres), mantendo dados internos, metadata, idempotencia, retorno e webhook. Parser legado permanece compativel; registros e preferencias antigos nao foram reescritos. Testes novos cobrem IDs longos, retomada sem segunda criacao e sincronizacao repetida por paymentId sem credito duplicado. Suíte de seguranca: 77 aprovados, incluindo compatibilidade de referencias legadas e protecoes sandbox. Lint, i18n, scanner, deploy:check, diff, unitarios e build passaram; HTTP Functions registrado na entrega. Reducao de referencia e candidata fundamentada a correcao, sem confirmacao de causa raiz: necessario novo checkout completo apos publicar, usando outro candidato de demonstracao. Nao houve deploy nem alteracao de dados Firestore/secrets pelo agente nesta etapa. Pagamentos isolados nao foram conciliados como recompensas do Selectio.

### Diagnostico de fotos e criacao de checkout — 21/10/2026

Base `d2f7cf1`, mesma branch e alteracoes anteriores preservadas. Consulta GET autenticada ao bucket `selectio-1f022.firebasestorage.app` confirmou ausencia de `https://selectio.app.br` no CORS. Fotos usam `getBlob()`, que depende dessa autorizacao de origem. Criado `scripts/configurar-cors-storage.cjs`, somente consulta por padrao; `--apply` adiciona GET/HEAD da origem canonica, preservando as entradas existentes e usando precondicao de metageneration. Executado somente em modo consulta; nenhuma mudanca remota. Procedimento em [Storage CORS](docs/storage-cors.md). A Function publicada estava ACTIVE, atualizada em 21/10, com APP_URL canonica e sandbox. Logs consultados mostram quatro criacoes de preferencia com HTTP 400 e webhooks com 401; a mensagem do corpo nao consta nos logs e o motivo do 400 permanece pendente. Frontend agora preserva status HTTP e distingue falhas de sessao, acesso, conflito, limite e indisponibilidade em mensagens traduzidas, sem mostrar mensagens externas arbitrarias. Nao altera regras de pagamento nem aprova transacoes. Revalidacao e resultado detalhados na entrega da tarefa; sem deploy nesta etapa.

Complemento do diagnostico: uma foto referenciada em empresas existe no bucket, com status disponivel e JPEG. Download GET autenticado retorna 200, mas sem Access-Control-Allow-Origin para selectio.app.br; com Origin localhost:5173 inclui o cabecalho. OPTIONS sozinho permite a requisicao; a comparacao GET confirma o problema de CORS. Regras publicadas incluem fotos; App Check Storage observado UNENFORCED, sem alteracao. Checks desta etapa: 61 unitarios, lint, i18n, scanner, deploy:check, diff e build passaram. Nao foram repetidos emuladores financeiros/Rules/Functions nesta etapa, sem alteracoes nessas areas; testes locais nao substituem nova tentativa autenticada do checkout nem confirmam fotos no navegador apos aplicar CORS.

Diagnostico posterior com o erro informado pelo responsavel: comparacao em memoria da versao 3 do MERCADO_PAGO_ACCESS_TOKEN vinculada a Function publicada com a copia local confirmou valores diferentes, sem imprimir credenciais. GET /users/me com a credencial publicada reproduziu HTTP 403, codigo PA_UNAUTHORIZED_RESULT_FROM_POLICIES; com a credencial local retornou 200 e test_user Brasil. A falha atual foi localizada na verificacao de identidade do vendedor, anterior a reserva/criacao do checkout. Nao e necessario apagar o banco para esse erro. A causa administrativa de a credencial publicada ser recusada ainda nao foi determinada; necessario cadastrar o token correto do seller e republicar a Function. Somente consultas remotas; nao houve atualizacao de secrets, CORS ou deploy pelo agente.

### Preparacao local do deploy sandbox — 21/10/2026

Base `d2f7cf1`, branch `fix/mercado-pago-sandbox`, preservadas as alteracoes locais anteriores. Criados arquivos ignorados `.env.production.local` e `functions/.env.selectio-1f022` para alinhar frontend e backend a `https://selectio.app.br`, desativar emulador no build e manter `MP_ENVIRONMENT=sandbox`. Nao sao transportados pelo Git. `scripts/check-deploy-config.cjs` agora bloqueia origens divergentes e ambiente invalido nas Functions. Token local consultado somente por GET: conta de teste brasileira, venda habilitada; nao foi impresso nem enviado ao Secret Manager. Responsavel confirmou a mesma aplicacao Mercado Pago: preservar secret Webhooks remoto se nao foi regenerado. Check de deploy, cinco cenarios isolados da validacao, lint, i18n, scanner e build passaram; 60 unitarios e 75 testes de seguranca passaram na revisao imediatamente anterior, sobre o mesmo codigo de produto; 4 testes HTTP repetidos em copia temporaria das Functions com secrets ficticios passaram. Node local 24; CI/Functions declaram 22. Build mantem aviso de chunks grandes. Nao houve deploy, compra, mudanca remota ou reset de pagamentos. Publicacao exige cadastrar o token novo e gerar checkout para outro candidato de demonstracao. A recusa externa ainda nao tem causa comprovada nem compra aprovada com o novo par de contas.

### Revisão sandbox — 19/10/2026

Complemento sobre `d2f7cf1`: token local autorizado validou vendedor `test_user`/`APP_USR` dono da preferência, sem revelar credenciais. Consultas retornaram zero pagamentos e três merchant orders abertos sem pagamentos. Corrigida a escolha de URL para essa modalidade de teste: `init_point` após confirmar tag `test_user`; vendedor real é bloqueado no modo sandbox antes da reserva. O teste manual pelo responsável no link alternativo manteve o erro externo; nova consulta permaneceu sem pagamentos. A tentativa de revalidar o histórico pela API foi revertida após relato de falha: Continuar checkout voltou a abrir diretamente o link existente. Bloco técnico de ambiente/URL removido da interface. Suíte de segurança: 75 testes aprovados na alteração de backend; lint, i18n, scanner, build e navegador com fixtures passaram também após a remoção do bloco e restauração do link. Não houve deploy nem criação de cobrança externa pelo agente. Detalhes e limites na revisão vinculada abaixo.

Base `f5452b3`, branch `fix/mercado-pago-sandbox`, inicialmente limpa. Navbar pública centralizada; abertura do checkout, seleção da URL, retorno sem payment ID válido, histórico após falha de sincronização e mensagens sandbox corrigidos localmente. Backend inclui ID interno nas URLs de retorno, preserva sucesso financeiro quando uma notificação falha e registra códigos de rejeição de webhook sem credenciais. Fonte e limites: [revisão sandbox](docs/revisao-sandbox-2026-10-19.md).

API publicada respondeu health em sandbox e CORS aceitou `https://selectio.app.br`; leitura dos últimos 100 logs encontrou 50 POSTs de webhook com HTTP 401, sem evidência suficiente para atribuir a causa a um secret específico ou à mensagem relatada pelo usuário. Testes locais: 60 unitários, 73 de segurança nos emuladores, 4 HTTP de Functions, lint, i18n, scanner, build e verificações de navegador com dados fictícios. Compra externa, configuração de credenciais no painel e deploy ainda pendentes; não é confirmação de prontidão da demonstração publicada. Nenhuma alteração remota, de Rules ou de valores de secrets.

**Páginas públicas verificadas localmente em 2026-10-08, base `207dd2f`, na `main`:** criadas Privacidade, Termos, Contato, FAQ, Equipe e 404; Footer com destinos reais em grupos Institucional/Ajuda. Evidências: `App.jsx`, `Footer.jsx`, `pages/public/InstitutionalLayout.jsx`, catálogos `institutional` e `tests/institutional.test.mjs`. Scanner, lint, i18n, 57 unitários e build passaram; prévia isolada conferiu rotas públicas, navegação, scroll, título/idioma, accordion, URL inválida e visual desktop/mobile. Fontes de equipe, limites e pendências em [páginas institucionais](docs/paginas-institucionais.md). Contato permanece com canal em definição, sem envio; Privacidade/Termos são textos iniciais do MVP e exigem revisão jurídica/operacional antes do lançamento comercial. Nenhum deploy, alteração de Rules ou backend foi realizado nesta tarefa.

### Dashboard do indicador — verificação local em 2026-10-08

Base `fde78b8`, branch `feat/dashboard-indicador`, inicialmente limpa. Evidências: `IndicadorDashboard.jsx`, `indicadorDashboardDados.js`, `services/recomendacoes/recomendacoesVagas.js` e `tests/indicadorDashboard.test.mjs`.

- KPIs monetários e card de recompensas pendentes removidos apenas desta tela; gráfico dos últimos seis meses preservado e colocado no final. Serviços e regras financeiras permanecem intactos.
- Conversão mantém contratados / indicações carregadas; o gráfico mostra distribuição de status atuais, não etapas acumuladas. Amostra existente limitada a 100 indicações.
- Shortlist lexical determinística de até quatro vagas: histórico recente (30), histórico carregado (20), similaridade (20), candidatos próprios (30). Usa campos profissionais estruturados, sem currículos, OCR, embeddings ou chamadas de IA; não substitui elegibilidade/autorização da indicação.
- Leituras limitadas: primeira página de até 100 vagas, até 200 registros de histórico, 100 candidatos associados já carregados e 100 pré-salvos do próprio indicador. A nova consulta de pré-salvos usa ownership e limite, sem ordenação composta ou novo índice composto. Ordenação local não garante os 100 pré-salvos mais recentes; histórico carregado não representa necessariamente toda a carreira. Vagas antigas fora da página só contribuem pelo título salvo na indicação.
- Filtros locais excluem vagas fechadas, pausadas, expiradas, sem empresa e solicitações empresariais ainda não publicadas. Ausência de dados profissionais gera sugestões recentes neutras; ausência de afinidade suficiente gera estado vazio. Rules e validações server-side continuam sendo a autoridade.
- Validação local: scanner, lint, i18n, 54 testes unitários e build; 15 testes de dashboard/recomendação, incluindo ownership, deduplicação, disponibilidade e fallbacks. Prévia isolada com dados fictícios em 390/1024/1440 px e pt-BR/en-US, sem Firebase real. Build mantém aviso de chunks acima de 500 kB. Não houve teste autenticado contra Firebase, emuladores, Functions, auditoria npm ou deploy nesta tarefa; Rules/Functions não foram alteradas. Esta verificação não atualiza os demais fatos do snapshot de 01/10 nem comprova configuração remota.

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

**Auditoria verificada em 2026-10-08, base `207dd2f`, em `main`:** o [run 37773410282](https://github.com/MarcosPeyerl-MVSP/Selectio/actions/runs/37773410282) passou quality, build, auditoria da raiz e testes (incluindo emuladores/Functions), mas falhou na auditoria das Functions por `proxy-addr` 2.0.7 (crítico); o agregador `security` falhou por consequência. Correção local limitada a `functions/package-lock.json`: `proxy-addr` 2.0.8 e `@fastify/busboy` 3.2.2. Auditorias `--package-lock-only --omit=dev --audit-level=high` da raiz e Functions, scanner, extração PDF/DOCX (3 testes) e API HTTP no emulador Functions passaram localmente, em Node 24 (CI usa 22). Permanecem três alertas moderados na cadeia `mammoth → argparse → sprintf-js`; não foi aplicado o downgrade incompatível sugerido por `audit fix --force`. Esta correção ainda não foi publicada nem validada por novo CI/deploy; não comprova exposição ou correção do ambiente remoto.

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
| Privacidade / operação / recuperação | Parcialmente resolvido localmente em 08/10; verificação externa necessária | Footer aponta para páginas reais de Privacidade/Termos; textos iniciais ainda precisam de revisão jurídica e canal confirmado para titulares. Políticas operacionais, backup/restauração, IAM, CORS e orçamento: **Requires production verification** |
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
