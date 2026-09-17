# Auditoria antes do deploy — 17/09/2026

**Parecer: não liberar cadastro público irrestrito nem pagamentos reais ainda.**

Foram revisados código, regras, APIs financeiras, extração de currículos, consultas, configuração de Hosting, dependências e CI. As correções abaixo estão locais, sem deploy. A configuração efetiva de produção (IAM, App Check, faturamento, CORS do bucket, índices, backups e segredos) não foi validada: a CLI desta sessão não está autenticada.

Esta revisão não certifica ausência de vulnerabilidades. Os testes usam emuladores e respostas simuladas do Mercado Pago; não houve carga contra produção, cobrança real ou acesso a dados de usuários.

## Riscos corrigidos no código

| Prioridade | Problema observado | Correção |
|---|---|---|
| Alta | Usuário autenticado podia repetir análises e operações financeiras sem cota | Contadores transacionais por UID e operação, compartilhados entre instâncias, com limites por minuto e dia. Recusas em cache local limitado para evitar repetir leituras após bloqueio na mesma instância. |
| Alta | APIs aceitavam clientes autenticados sem atestação do aplicativo | App Check obrigatório na callable de indicações e nas rotas financeiras em produção. Inicialização do reCAPTCHA Enterprise no frontend e envio do token na API HTTP. Webhook permanece protegido por assinatura, não por App Check. |
| Alta | JSON já processado pelo Firebase ignorava o limite de tamanho | Verificação de rawBody/corpo/Content-Length antes das operações. HTTP 413 para excesso, 400 para JSON inválido, arrays e valores primitivos. A infraestrutura ainda pode receber o corpo antes do handler. |
| Alta | Duas criações simultâneas de preferência podiam sobrescrever a mesma cobrança | Reserva em transação, bloqueio de pagamento aprovado/creditado/em processamento e atualização condicional da tentativa. Timeout ou resposta ambígua preserva a reserva, exigindo conciliação antes de tentar novamente. |
| Alta | Atualização do valor da vaga podia mudar a validação de um checkout já emitido | Sincronização compara o pagamento ao valor persistido da cobrança. Exige BRL, valor finito, referência externa correta e live_mode em produção. |
| Alta | Saque com texto não numérico podia produzir NaN e passar nas comparações | Validação de número finito, valor positivo e precisão de centavos antes de alterar saldo. |
| Alta | Webhook podia validar o ID da URL e processar outro ID vindo do corpo | Mesmo ID na validação e no processamento; rejeita divergência entre corpo e URL, assinatura inválida e timestamp fora de 10 minutos. |
| Alta | Parser de documento executava junto com o handler sem prazo próprio | Worker com prazo de 15 segundos, limite de heap V8, limite de entrada de 10 MB e limite incremental de texto PDF. Isso não limita toda memória nativa/externa nem substitui sandbox/antimalware. |
| Média | Listagem pública carregava toda a coleção de vagas | Páginas de 100 com cursor e botão para carregar mais. Regras recusam listagem sem limite e acima de 100 (admin até 500). Filtros da tela se aplicam às vagas já carregadas; o aviso informa quando há mais. Banner considera as 100 mais recentes. |
| Média | Requisições externas podiam ocupar a função até seu timeout geral | Mercado Pago com timeout de 15 segundos; cliente HTTP com timeout de 45 segundos. |
| Média | Headers básicos de proteção ausentes | nosniff, bloqueio de framing, política de referer/permissões e CSP limitada a object-src, base-uri e frame-ancestors. Não é uma CSP completa contra scripts injetados. |
| Média | CI não executava Storage, cotas, concorrência financeira e indicações de servidor | Suites adicionadas ao workflow, além de lint e testes unitários. |
| Média | Dependências com avisos conhecidos | qs das Functions atualizado para 6.16.0; fast-uri e js-yaml de desenvolvimento atualizados. Auditorias de produção do frontend e Functions retornaram zero avisos. |

### Limites aplicados

| Operação | Por minuto | Por dia |
|---|---:|---:|
| Analisar indicação | 6 | 100 |
| Finalizar indicação | 12 | 200 |
| Conjunto de rotas financeiras autenticadas | 20 | 300 |

São janelas fixas UTC, não uma janela móvel. Uma virada de minuto pode permitir duas cotas em poucos segundos. Valores estão em `functions/src/protecaoAbuso.cjs` e devem ser ajustados conforme o uso legítimo. Tentativas inválidas após autenticação também podem consumir cota.

Functions HTTP/callable passaram de 10 para 3 instâncias; análise usa concorrência 2 por instância. O scheduler tem no máximo 1 instância. Isso limita paralelismo, não quantidade mensal de chamadas nem gasto total. Uma tempestade de chamadas pode causar indisponibilidade mesmo quando o trabalho caro é recusado.

## Pendências que impedem considerar o lançamento protegido

### 1. Alta — Storage ainda permite quantidade ilimitada de arquivos por conta

Evidência: `storage.rules` autoriza arquivos novos com IDs arbitrários sob o UID do usuário. O limite existente é por arquivo (10 MB de currículo, 5 MB de foto). `storageCurriculos.js` e `storageFotosPerfil.js` chamam `uploadBytes` diretamente.

Impacto: uma conta pode enviar milhares de arquivos válidos. As cotas das Functions NÃO interceptam esses uploads. App Check reduz scripts externos, mas não impede que uma conta use o próprio aplicativo para abusar. O tipo MIME é metadado declarado pelo cliente, não prova de conteúdo seguro.

Ação necessária: autorizar cada upload no servidor com cota de quantidade/bytes e ticket associado a um único caminho, tamanho, proprietário e validade; impedir reutilização do ticket, inclusive após apagar o arquivo. Finalizar e contabilizar o upload no servidor. Definir retenção e limpeza de órfãos; avaliar quarentena/antimalware antes de disponibilizar currículos a terceiros. Não basta incluir um contador em JavaScript no navegador.

### 2. Alta — Consultas/escritas diretas no Firestore continuam sem limite de frequência

Evidência: cadastros, vagas, pré-salvos, entrevistas e outras operações usam o SDK do navegador. Cotas implementadas nas Functions cobrem apenas aquelas APIs. A regra de listagem limita documentos por chamada, não chamadas por segundo. Consultas de pré-salvos continuam sem paginação.

Impacto: 100.000 chamadas válidas continuam possíveis fora das rotas protegidas. Até recusas podem causar leituras cobradas para avaliar regras que consultam outros documentos. Uma mesma conta pode repetir operações; várias contas contornam qualquer cota exclusivamente por UID.

Ação necessária: App Check obrigatório em Firestore/Storage; transferir operações de alto custo para APIs com cotas; usar projeção/cache para catálogo público; proteção de borda para APIs expostas, fechando acesso à origem quando aplicável. Definir aprovação de contas ou limites de cadastro e exigir e-mail verificado para operações sensíveis. Enviar e-mail de verificação no cadastro não equivale a exigir `email_verified` no servidor.

### 3. Alta — Documentos completos de vagas são públicos, inclusive dados internos

Evidência: `match /vagas/{vagaId}` ainda permite `get` público e listagens públicas limitadas. Documentos podem conter `comentarioAuditoria`, `historicoAprovacao`, rubrica e dados de processo empresarial. A tela filtra visibilidade depois de receber o documento; isso não restringe o acesso pela API.

Ação necessária: separar os dados públicos em uma coleção/projeção contendo apenas campos publicados. Manter os documentos internos acessíveis apenas à empresa/admin. A consulta pública deve excluir rascunhos/pendências no servidor. Alterar somente o filtro visual não resolve; mudar agora a regra sem adaptar a consulta quebraria o catálogo.

### 4. Alta — Aprovação empresarial não é uma separação de permissões no servidor

Evidência: a autorização de `vagas` é pelo UID da empresa; `atualizarAprovacaoVaga` grava diretamente status/comentários. Setores empresariais são escolhidos e armazenados no cliente, e a empresa edita o próprio documento.

Ação necessária: se chefia, auditoria e RH precisam de permissões diferentes, usar identidades individuais e papéis definidos pelo servidor, validar cada transição e manter histórico imutável. O fluxo visual atual não deve ser vendido como controle de acesso entre departamentos.

### 5. Alta — Estorno/chargeback e conciliação financeira não estão completos

Evidência: `processarPagamentoMercadoPago` credita saldo em approved; o caminho de refunded não faz lançamento compensatório. `solicitarSaque` reserva saldo, mas não há uma chave de idempotência fornecida pelo cliente para distinguir retry de uma segunda solicitação legítima. Atualizações do provedor fora de ordem ainda precisam de política consistente.

Ação necessária: antes de dinheiro real, testar em sandbox estorno total/parcial, chargeback, eventos duplicados/fora de ordem, timeout e saque reenviado. Implementar livro de lançamentos compensatórios e política para saldo já sacado/pendente. O bloqueio novo preserva cobranças incertas em `created`: é necessário conciliar antes de liberar nova tentativa, sem apagar registros ou resetar `creditado` manualmente.

### 6. Alta — Configuração do App Check ainda falta nesta máquina

`npm run deploy:check` detectou ausência de `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`. O deploy de Hosting agora tem predeploy que valida essa configuração e gera o build. A validação verifica presença/formato de configuração local, não a validade da chave nem o enforcement remoto.

Sem configurar App Check, publicar as novas Functions fará as operações protegidas recusarem os clientes de produção. Coordenar frontend, regras e backend na mesma janela de implantação. O teste local não substitui verificar tokens válidos no domínio final.

### 7. Média — Limpeza e retenção não acompanham crescimento indefinido

Evidência: `limparExpiradas` processa até 100 validações por dia e varre o prefixo inteiro `curriculos/` para temporários. Uma conta já pode criar até 100 análises/dia; muitas contas excedem a capacidade de limpeza. Fotos/currículos órfãos de outros fluxos também precisam de retenção.

Ação necessária: limpeza paginada com retomada, orçamento de execução e alertas de backlog; lifecycle apropriado no bucket para temporários; TTL de `limitesUso.expiraEm`. Não habilitar TTL isolado em `validacoesIndicacao` sem garantir primeiro a remoção dos arquivos associados.

### 8. Média — Consultas truncadas e índices não versionados

Várias telas usam limit(100/200) e ordenam só depois de receber dados, sem `orderBy`/cursor. Isso não garante receber os mais recentes e pode subcontar métricas. Exemplo: notificações recebem 50 documentos e só então ordenam por criação. Não há manifesto de índices Firestore no repositório; o emulador não confirma todos os requisitos de índices de produção.

Ação necessária: paginação e ordenação no servidor, índices versionados e teste com mais de 100/200 registros. Para dashboard financeiro, usar agregações oficiais/servidor em vez de somar uma lista truncada.

### 9. Média — Operação, privacidade e recuperação não verificadas

Não foram confirmados backup/restauração, retenção de dados pessoais, IAM das contas de serviço, restrições de chaves/API, CORS do bucket ou orçamento remoto. Links de privacidade/termos no Footer são placeholders. Há 8 avisos moderados na árvore de desenvolvimento; não há avisos altos/críticos nem avisos nas dependências de produção na auditoria realizada. Não foi aplicado `npm audit fix --force` porque propunha alterações incompatíveis do CLI.

## Configuração necessária antes da publicação

1. Registrar o app web no App Check com reCAPTCHA Enterprise e chave para `selectio.app.br` e demais domínios realmente usados. Configurar `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` no ambiente do build. A chave do site é pública; segredos administrativos nunca devem ter prefixo `VITE_`.
2. Conferir métricas de tokens válidos antes de exigir App Check no Firestore/Storage. As novas Functions já exigem token em produção. Testar login, indicação e pagamento no domínio final. Em desenvolvimento, usar o provedor de debug somente localmente com token registrado; não publicar token de debug.
3. Configurar `VITE_APP_URL=https://selectio.app.br` no frontend e o parâmetro `APP_URL=https://selectio.app.br` das Functions. Eles são independentes. A API financeira aceita a origem configurada; domínio padrão antigo poderá deixar de funcionar após a troca. Cadastrar o domínio em Authentication e validar CORS do Storage para downloads autenticados.
4. Manter `MP_ENVIRONMENT=sandbox` até concluir os cenários financeiros acima. Validar os dois segredos no Secret Manager e o webhook real. Não enviar credenciais no chat/commit.
5. Definir orçamento mensal, destinatários e alertas. A documentação atual oferece spend caps em preview para alguns serviços, incluindo Functions, com atraso e possível cobrança além do limite; Firestore, Storage e Hosting clássico não estão na lista de serviços cobertos. Alertas simples não desligam serviços. Preparar procedimento de resposta a abuso e monitorar leituras/escritas, bytes, invocações, latência, 429/5xx e falhas de App Check.
6. Configurar TTL de `limitesUso.expiraEm`, limpeza de arquivos e backup com teste de restauração. Validar índices e permissões efetivamente publicadas.
7. Executar suites no Node 22 (runtime de produção) e homologar os fluxos num projeto separado. Nesta máquina os testes rodaram no Node 24.1.0 e Java 23; CI permanece Node 22/Java 21.
8. Publicar frontend, Functions e regras conforme um plano conjunto. `firebase deploy --only hosting` não publica as proteções do servidor nem as regras. Nada foi publicado nesta auditoria.

## Verificação executada

- 40 testes unitários/extração/CSV/dashboard/redirect passaram.
- Suite de emuladores: 68 testes passaram (Firestore, Storage, indicação, cotas e pagamentos); após ampliar validação JSON, a suite financeira foi repetida separadamente com 9 testes.
- 4 testes HTTP no emulador Functions passaram.
- Lint, build, catálogos de tradução, detector de segredos e seu autoteste passaram.
- Auditoria de dependências de produção do frontend e Functions: zero avisos. Auditoria completa: 8 moderados, zero altos/críticos.
- `deploy:check` bloqueia corretamente por configuração de App Check ausente.
- CLI emitiu avisos de autenticação/CA e Java mostrou exceção ao encerrar Storage, após os testes aprovados e exit code 0. Sem relaxar TLS nem usar produção para contornar isso. Os processos Java residuais criados pelos testes foram identificados e encerrados.

## Referências consultadas

- [App Check com reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Verificar App Check em backend HTTP](https://firebase.google.com/docs/app-check/custom-resource-backend)
- [Enforcement em Functions](https://firebase.google.com/docs/app-check/cloud-functions)
- [Limites de consultas nas regras](https://firebase.google.com/docs/firestore/security/rules-query)
- [Cobrança de operações e avaliação de regras](https://firebase.google.com/docs/firestore/pricing)
- [Spend caps e limitações](https://firebase.google.com/docs/projects/billing/spend-caps)
- [Assinatura de webhook Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod)
