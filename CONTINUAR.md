# Continuidade — 01/10/2026

Pausa solicitada pelo usuário para economizar tokens. Base: `b0ce2da`, branch `chore/agent-governance`, working tree limpo antes deste resumo.

## Concluído

A primeira tarefa criou AGENTS.md, PROJECT_STATE.md, CONTRIBUTING.md, template de PR, templates de feature/bug e links no README. Essa versão está no commit-base acima. Na primeira tarefa passaram security:check, security:test, lint, i18n:check, build, deploy:check e 43 testes unitários. Esses resultados são históricos, não execução desta pausa.

## Pedido atual ainda não implementado

O usuário informou que Selectio está em pré-produção com um desenvolvedor principal. Quer simplificar Git sem remover governança ou enfraquecer segurança. As duas tentativas de patch falharam na validação; nenhuma alteração desse pedido foi aplicada. Os documentos ainda exigem o fluxo anterior de PR/branch.

Aplicar apenas em documentação:

- Mudanças pequenas e de baixo risco podem ir direto à main: atualizar base preservando trabalho local → implementar → revisar diff → checks relevantes → commit → push → confirmar GitHub Actions.
- Branch/PR/Issue/approval não são obrigatórios para toda tarefa. Não criar develop. Commits descritivos, sem exigir Conventional Commits.
- Usar branches para mudanças grandes, experimentais, arriscadas, longas ou paralelas; pagamentos/Mercado Pago/saldo/saques, auth/autorização, Firestore/Storage Rules, migrações, uploads sensíveis, ranking que altere regra de negócio, Functions e arquitetura críticas. Exemplos: feat/nome, fix/nome, chore/nome, experiment/nome.
- Para trabalhos maiores: branch → implementar → testar → PR opcional → revisar → merge. Manter revisão humana de HIGH-RISK; não exigir approval de outro desenvolvedor neste estágio.
- Issues/templates são ferramentas opcionais, recomendadas para bugs importantes, features maiores, tarefas a lembrar, múltiplos passos e backlog.
- Manter status antes de alterar, diff antes de concluir, hooks, secrets, testes e CI. Nunca force-push na main, sobrescrever trabalho local, usar clean destrutivo, reset --hard automático ou contornar hooks com --no-verify.
- Não autoriza deploy, alteração de produção/secrets/dados reais, migração destrutiva ou relaxamento de Rules.
- Reavaliar PR obrigatório e branch protection antes de produção real, usuários externos, pagamentos reais ou mais desenvolvedores simultâneos. Proteção desativada não é urgência no modelo atual; não recomendar 1 approval obrigatório agora.

## Arquivos a ajustar

1. AGENTS.md: Git, HIGH-RISK e condições futuras; preservar restante.
2. CONTRIBUTING.md: dois fluxos, Issues opcionais e proteções.
3. PROJECT_STATE.md: workflow, prioridade de proteção e menção ao check security como proteção futura. Distinguir snapshot técnico anterior do processo informado pelo usuário; não alegar nova auditoria técnica/remota.
4. README.md: substituir lista que exige branch/PR; preservar links aos documentos.
5. Template de PR: Issue opcional e esclarecer uso opcional; manter checklist de riscos.
6. Manter templates de Issue e workflow security.yml. Não alterar produto, Rules, Functions ou runtime.

## Validação e entrega ao retomar

Revisar git status/diff e consistência entre documentos; executar npm run security:check, npm run lint, npm run i18n:check e npm run build. Emuladores dispensáveis para esta mudança documental. Relatar arquivos, simplificações, proteções, uso de branches, gatilhos de revisão futura e checks. Não fazer merge/deploy. O pedido de publicar durante esta pausa autoriza salvar a branch atual; não presume autorização para pushes futuros.

Prompt completo da segunda tarefa, nesta máquina: `C:/Users/24011725/.codex/attachments/9dbe60eb-0f61-48d3-99dd-97e25fe4ea37/Pasted text.txt`. Este resumo contém os requisitos para continuar em outra máquina. Após concluir a tarefa, remover este arquivo temporário de continuidade.
