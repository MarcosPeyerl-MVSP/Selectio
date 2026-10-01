# Contribuindo com a Selectio

Nosso fluxo é **Issue → branch → implementação → testes → Pull Request → CI → review → merge na main**. `main` é a base de produção. Não usamos `develop` neste momento.

1. Registre problema, objetivo e critérios de aceite em uma issue, sem dados pessoais ou secrets. Consulte [AGENTS.md](AGENTS.md) para limites técnicos e [PROJECT_STATE.md](PROJECT_STATE.md) para o estado verificado; instalação e comandos estão no [README](README.md).
2. Confira `git status` e preserve trabalho local. Com a base atualizada, abra uma branch curta: `feat/<nome>`, `fix/<nome>`, `chore/<nome>`, `docs/<nome>` ou `refactor/<nome>`.
3. Faça mudanças pequenas e focadas. Use commits descritivos que expliquem a mudança; Conventional Commits não é obrigatório. Não misture correção, upgrade e refactor sem necessidade.
4. Execute `npm run security:check` e os checks relevantes da matriz em AGENTS. Para código, considere lint, unitários e build; textos novos exigem os dois idiomas e `i18n:check`. Rules, autorização, indicação e finanças exigem testes específicos nos emuladores. Informe falhas e checks não executados; não use produção como ambiente de teste.
5. Abra PR para `main`, associe a issue e preencha o template com motivo, validação e riscos. Aguarde o agregador `security` e pelo menos uma revisão de outro desenvolvedor. Mudanças HIGH-RISK precisam de revisão humana do fluxo e da segurança antes do merge.
6. Resolva comentários e faça merge somente com CI aprovado e revisão concluída. Não envie commits diretamente à `main`, não faça force-push nela e não contorne os hooks com `--no-verify`.

O `npm install`/`npm ci` executa prepare para configurar `.githooks`; `npm run security:setup` repõe essa configuração. Pre-commit verifica conteúdo staged e pre-push verifica histórico a enviar. Se houver bloqueio, investigue e corrija a causa.

Merge **não autoriza deploy automático**. O workflow atual valida o projeto, sem publicar. Deploy, secrets, alteração de dados reais e migrações dependem de pedido explícito e plano de publicação; uma política de deploy automático precisa ser definida separadamente.

Até a proteção remota ser configurada, o fluxo de PR/review depende também da disciplina da equipe. O administrador deve exigir PR com 1 approval, check `security` e bloqueios de force-push/deletion na `main`, conforme o snapshot.
