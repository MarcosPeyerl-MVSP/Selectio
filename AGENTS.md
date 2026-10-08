# Instruções para agentes — Selectio

## Missão e início obrigatório

Entenda antes de alterar. Prefira mudanças mínimas, preserve o comportamento existente e verifique suposições no repositório. Não faça melhorias fora da tarefa nem refatorações amplas sem justificativa e escopo explícito.

Antes de implementar: (1) leia este arquivo; (2) leia [PROJECT_STATE.md](PROJECT_STATE.md); (3) leia [README.md](README.md); (4) consulte os documentos relevantes em `docs/`; (5) examine testes relacionados; (6) confira `git status`, branch e diff; (7) analise os arquivos e o fluxo envolvidos; (8) só então implemente.

Para comportamento técnico, a ordem de confiança é: código atual → testes atuais → `firestore.rules` / `storage.rules` → configuração Firebase/Functions → documentação técnica → PROJECT_STATE → documentação externa/de negócio. Registre divergências; não altere o produto apenas para coincidir com documentos. O snapshot não comprova a configuração remota.

## Mapa técnico

- Frontend JavaScript/ES modules: React 18, Vite 8, React Router 7, i18next, Recharts e Firebase Client SDK 12. Rotas em `src/App.jsx`, telas em `src/pages/`, acesso a dados em `src/services/`, sessão em `src/components/auth/` e `src/hooks/useAuth.js`.
- Navegador → Firebase Authentication, Firestore e Storage pelo SDK; operações sensíveis → Cloud Functions v2, Node 22, CommonJS em `functions/`.
- `functions/index.cjs` exporta `indicacoesApi`, `limparValidacoesIndicacao` e `mercadoPagoApi`, em `southamerica-east1`. Mercado Pago é acessado pelo backend.
- Ranking da empresa: `src/workers/analiseCurriculo.worker.js`, PDF/DOCX, OCR e semântica no navegador. Motor/rubrica compartilhados em `functions/shared/`; `src/services/compatibilidade/` os utiliza. Validação prévia de indicação e extração com worker Node ficam em `functions/src/indicacoesCore.cjs` e `extracaoWorker.cjs`. Ranking e autorização de indicação são fluxos distintos.
- Consulte [validação de indicação](docs/validacao-indicacao.md) e [pagamentos](docs/mercado-pago-functions.md). Confirme os detalhes no código.

## Git e escopo

Enquanto a Selectio estiver em pré-produção com um desenvolvedor principal, `main` é a linha principal de desenvolvimento. Mudanças pequenas e de baixo risco podem ser feitas diretamente nela: trabalho local → revisar diff → checks relevantes → commit → push → confirmar GitHub Actions. Branch, Issue, PR e approval não são obrigatórios para toda tarefa. Este fluxo não autoriza push, merge ou deploy automático sem solicitação.

Use branch separada para mudanças grandes, experimentais, arriscadas, longas, paralelas a outro trabalho ou HIGH-RISK. Exemplos: `feat/nome`, `fix/nome`, `chore/nome`, `experiment/nome`. PR é opcional e útil para revisão. Não criar `develop`. Consulte [CONTRIBUTING.md](CONTRIBUTING.md).

Reavalie PR obrigatório e proteção de branch antes de produção real, usuários externos, pagamentos reais ou atuação simultânea de mais desenvolvedores.

Sempre confira `git status` antes de alterar e revise `git diff` antes de concluir e antes de push. Preserve trabalho local do usuário. Nunca faça force-push em `main`, sobrescreva trabalho local ou use `git clean` de forma destrutiva; não execute `git reset --hard` automaticamente. Nunca use `--no-verify` ou desative hooks para contornar falhas. `prepare` configura `.githooks`; pre-commit verifica staged e pre-push verifica o histórico enviado.

Altere apenas o necessário. Renomeações massivas, upgrades grandes, troca de framework/banco, migração para TypeScript, microservices e refactors não relacionados exigem tarefa explícita.

## Segurança e HIGH-RISK

Nunca commite ou imprima secrets, credenciais ou dados pessoais. `VITE_*` é público no navegador. `MERCADO_PAGO_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` pertencem ao backend/Secret Manager, nunca ao frontend, logs ou documentação com valores reais.

Não enfraqueça Rules para fazer um fluxo funcionar. `ProtectedRoute`, localStorage, botões e rotas escondidos não são autorização. Valide identidade, ownership, perfil e entrada no servidor/Rules, com menor privilégio. O Admin SDK requer validações explícitas nas Functions. Trate uploads, MIME declarado e currículos como não confiáveis.

**HIGH-RISK:** pagamentos/Mercado Pago, saques, saldo, `functions/src/mercadoPagoCore.cjs`; Firestore/Storage Rules; autenticação, autorização e roles; Functions críticas como `functions/src/indicacoesCore.cjs`; ranking/compatibilidade ao alterar regra de negócio; uploads sensíveis/currículos; alterações de schema e migrações de dados; arquitetura crítica. Nessas áreas, use branch separada, analise o fluxo completo, execute testes relacionados, explique efeitos de segurança e obtenha revisão humana antes de integrar à `main`. Na pré-produção, a revisão pode ser feita pelo desenvolvedor responsável; não exige approval formal de outra pessoa no GitHub.

Os setores do modo empresarial (Administrador da Empresa, Chefe de Departamento, Reitoria/Auditoria e RH) não devem ser apresentados como isolamento server-side completo. Verifique identidades, Rules e transições antes de afirmar RBAC seguro.

## Firebase, pagamentos e IA

- Mudanças de schema devem considerar Rules, leitores antigos e migração/compatibilidade. Queries precisam considerar índices, ordenação e paginação. Use emuladores para testes de segurança, nunca produção. A flag `VITE_USE_FUNCTIONS_EMULATOR` direciona Functions; não presume que Auth, Firestore e Storage estejam emulados.
- Saldo, crédito, pagamento aprovado, recompensa, saque e conciliação têm autoridade server-side. Preserve autenticação, autorização, idempotência e histórico auditável. Considere concorrência, retries, webhooks duplicados/fora de ordem, timeout, estorno, chargeback, conciliação e precisão monetária; teste os cenários afetados e obtenha review humano. Não confunda checkout retornado pelo cliente com pagamento confirmado.
- IA/ranking é apoio à decisão, nunca autoridade autônoma de contratação ou rejeição. Preserve revisão humana, critérios, pesos, versões, evidências, confiabilidade, explicabilidade, auditoria e reprocessamento. Não introduza critérios discriminatórios. Mudanças relevantes exigem testes. A regra atual de elegibilidade prévia à indicação é distinta da decisão de contratação; não a remova incidentalmente.

## UI e i18n

Textos visíveis novos devem usar i18n em `pt-BR` e `en-US` e passar `npm run i18n:check`. Preserve padrões existentes, responsividade, acessibilidade, teclado e estados loading/error/empty. Não introduza um novo design system fora de uma tarefa específica.

## Validação proporcional

Confira os scripts atuais em `package.json`. Não substitua ou duplique `.github/workflows/security.yml`; seu agregador é `security`.

| Alteração | Checks a escolher |
| --- | --- |
| Documentação pequena | Revisar diff, links/frontmatter e `npm run security:check`; outros checks quando solicitados ou afetados |
| Frontend/código de produção | `npm run security:check`, `npm run lint`, `npm run i18n:check`, `npm run test:unit`, `npm run build`, conforme o impacto |
| Scanner/hooks | `npm run security:check` e `npm run security:test` |
| Rules, ownership, indicação, cotas ou pagamentos | `npm run test:security:emulators`, testes unitários relacionados; `npm run test:functions` para a API HTTP/integração Functions |
| Ranking/extração | `npm run test:unit`; emuladores também se afetar autorização/persistência de indicação |

CI usa Node 22 e Java 21. Emuladores exigem Java, Firebase CLI e dependências da raiz/Functions. Suites que limpam o mesmo projeto de emulação devem rodar sequencialmente. Reporte falta de Java, CLI, dependências, rede ou credenciais; nunca declare um teste aprovado sem executá-lo. Não altere código fora do escopo para esconder falhas.

## Produção e entrega

Sem pedido explícito, não publique Firebase, altere produção/Mercado Pago, cadastre secrets, execute migração destrutiva ou altere dados reais. Comandos de deploy no README são instruções, não autorização. Merge não implica deploy automático.

Ao concluir, informe o que mudou, arquivos alterados, checks executados e não executados, resultados, riscos, follow-ups e qualquer mudança de comportamento. Atualize PROJECT_STATE quando a tarefa mudar fatos operacionais relevantes, com data, commit-base, evidência e limites de verificação; não o transforme em diário.
