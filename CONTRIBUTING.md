# Contribuindo com a Selectio

Na pré-produção, com um desenvolvedor principal, `main` é a linha principal de desenvolvimento. Branch, Issue, PR e approval não são etapas obrigatórias para toda alteração. Não usamos `develop`.

Consulte [AGENTS.md](AGENTS.md) para limites técnicos e [PROJECT_STATE.md](PROJECT_STATE.md) para o estado verificado; instalação e comandos estão no [README](README.md).

## Mudanças pequenas e de baixo risco

1. Confira `git status`, preserve trabalho local e atualize `main` sem sobrescrever alterações.
2. Implemente uma mudança pequena e focada.
3. Revise `git diff`.
4. Execute `npm run security:check` e os checks relevantes da matriz em AGENTS. Para código, considere lint, unitários e build; textos novos exigem os dois idiomas e `i18n:check`.
5. Faça commit com mensagem descritiva. Conventional Commits não é obrigatório.
6. Faça push para `main`, respeitando os hooks.
7. Confirme o resultado do agregador `security` no GitHub Actions e investigue qualquer falha. CI após push não substitui os checks locais.

## Mudanças maiores ou de risco

Use branch separada para trabalho grande, experimental, arriscado, longo ou paralelo; pagamentos/Mercado Pago/saldo/saques; autenticação/autorização; Firestore/Storage Rules; migrações; uploads sensíveis; ranking que altere regra de negócio; Functions ou arquitetura críticas.

1. Crie uma branch como `feat/nome`, `fix/nome`, `chore/nome` ou `experiment/nome`.
2. Implemente, revise o diff e execute os testes relacionados. Rules, autorização, indicação e finanças exigem testes específicos nos emuladores.
3. Opcionalmente abra PR usando o template, com contexto, validação e riscos; associe uma issue se houver.
4. Revise antes de integrar. HIGH-RISK exige análise do fluxo completo, segurança e revisão humana, que pode ser do desenvolvedor responsável; não exige approval formal de outra pessoa neste estágio.
5. Faça merge na `main` após revisão e checks aprovados; se a branch foi publicada, confirme também seu CI. Após enviar a integração, confirme o CI da `main`.

## Organização e proteções

Issues e seus templates são ferramentas de organização. São recomendados para bugs importantes, features maiores, tarefas a lembrar, trabalho com vários passos e backlog; mudanças pequenas não precisam começar com uma issue.

Não misture correção, upgrade e refactor sem necessidade. Informe falhas e checks não executados; não use produção como ambiente de teste. Nunca faça force-push em `main`, sobrescreva trabalho local ou use `git clean` destrutivamente; não execute `git reset --hard` automaticamente nem contorne hooks com `--no-verify`.

O `npm install`/`npm ci` executa prepare para configurar `.githooks`; `npm run security:setup` repõe essa configuração. Pre-commit verifica conteúdo staged e pre-push verifica histórico a enviar. Se houver bloqueio, investigue e corrija a causa.

Este fluxo não autoriza agentes a fazer push ou merge sem solicitação. Push/merge **não autoriza deploy automático**. O workflow atual valida o projeto, sem publicar. Deploy, alterações de produção ou secrets, alteração de dados reais e migrações destrutivas dependem de pedido explícito e plano de execução; uma política de deploy automático precisa ser definida separadamente. Não relaxe regras de segurança para facilitar o desenvolvimento.

Proteção de branch não é requisito do fluxo escolhido agora. Reavalie PR obrigatório e branch protection antes de produção real, usuários externos, pagamentos reais ou contribuição simultânea de mais desenvolvedores. O check agregado existente para essa futura configuração é `security`.
