# Revisão do Checkout Pro sandbox — 19/10/2026

Base inicial: `f5452b3`, complemento sobre `d2f7cf1`, branch `fix/mercado-pago-sandbox`. Objetivo: reduzir falhas nas apresentações em `https://selectio.app.br`. Revisão local, consultas públicas, leitura dos últimos 100 logs da Function e, no complemento autorizado, consultas GET à API com token local do vendedor. Nenhuma alteração remota ou compra pelo agente; credenciais não são reproduzidas neste relatório.

## Resultado e limites

Foram corrigidas falhas de abertura, escolha da URL, retorno e apresentação do resultado. A aprovação sandbox continua sem liberar saldo real. O responsável confirmou que o erro aparece dentro do Mercado Pago e que o Selectio acompanha normalmente as mudanças de situação do pagamento.

Atualização em 19/10/2026, base local `d2f7cf1`: screenshot de uma nova tentativa mostra o checkout identificado como Sandbox e a mensagem “Não foi possível processar seu pagamento”, com opção de outro meio de pagamento. A tela não informa o código técnico da recusa. Não se pode atribuir esse erro à internet escolar nem à assinatura do webhook apenas por essa imagem. Nesse momento, ainda não havia ocorrido consulta autenticada à API.

O fluxo externo completo ainda precisa ser validado com vendedor/comprador de teste e a versão revisada publicada. Aprovação nos emuladores não comprova o funcionamento das credenciais, do checkout externo ou da configuração remota de App Check/Webhooks.

O responsável confirmou uso de **saldo fictício de uma conta Comprador** e forneceu acesso temporário e link do checkout para investigação. O login não foi persistido pelo agente. A tentativa de abrir o checkout e o login recebeu HTTP 403 antes do formulário; o navegador de diagnóstico foi encerrado sem autenticação ou pagamento. Esse bloqueio do ambiente de investigação não comprova a causa do erro visto pelo responsável.

### Complemento com token local do vendedor

Após o responsável preencher `functions/.secret.local`, foram realizadas somente consultas GET, sem expor valores:

- `/users/me`: HTTP 200; vendedor ativo, Brasil (`MLB`), tag `test_user`, credencial do tipo `APP_USR`. Identidade confere com o criador da preferência e é diferente da conta compradora informada.
- Preferência fornecida: HTTP 200; BRL, referência externa presente, retorno em `selectio.app.br`, metadata sandbox, sem expiração habilitada.
- Busca de pagamentos por referência externa: HTTP 200, zero resultados.
- Busca de merchant orders da preferência: HTTP 200, três pedidos `opened` / `payment_required`, todos sem pagamentos associados. Portanto não há `status_detail` de pagamento disponível nessas consultas; não foi observado pagamento aprovado ou recusado na API para essa preferência.

Identificada divergência concreta na escolha de URL: o backend forçava `sandbox_init_point` para qualquer `MP_ENVIRONMENT=sandbox`. A orientação oficial para preferência criada com credencial da conta vendedor de teste é usar `init_point` com comprador de teste logado. Fonte: [orientação oficial para testes de Checkout Pro/Preferências](https://www.mercadopago.com.br/developers/pt/news/2023/11/16/Questions-on-how-to-test-your-integration--).

Correção local: com token `APP_USR` em ambiente sandbox, consulta `/users/me` e exige tag `test_user` antes de reservar ou retomar uma cobrança; usa `init_point` sem alterar `ambiente=sandbox` nem liberar saldo real. Credencial de conta real nessa combinação é recusada antes da criação. O fluxo legado de sandbox e o fluxo de produção mantêm suas URLs próprias. A criação/retomada pelo modal continua validada no servidor.

O responsável testou o `init_point` da mesma preferência e relatou a mesma mensagem. Portanto a troca de URL não resolveu a falha externa e não é causa comprovada. Nova consulta autenticada continuou retornando zero pagamentos; a cobrança tem valor de R$ 1.850,00. A API pública do comprador confirmou país Brasil e situação ativa, mas não fornece saldo nem comprova habilitação para comprar. Nenhum deploy foi realizado.

O responsável também relatou que **Continuar checkout** passou a falhar com mensagem de criação. A dependência adicional de chamada à API introduzida na etapa anterior foi revertida: o histórico voltou a abrir diretamente a URL já existente, sem criar preferência ou exigir outra chamada para navegar. A causa da falha dessa chamada não foi determinada, e ainda não foi informado se ocorreu em localhost ou no domínio publicado. Teste de navegador com fixtures confirmou a abertura direta sem criação. Removidos o bloco “Ambiente local Mercado Pago”, a URL técnica exibida, o CSS e as duas traduções sem uso. Lint, i18n, scanner, diff e build passaram; suítes financeiras não foram repetidas nesta remoção de interface, sem nova alteração de backend.

## Fluxo inspecionado

1. Empresa autenticada abre `ModalPagamentoRecompensa` para candidato contratado.
2. `firestorePagamentos` → `firebaseFunctions`: envia ID token Firebase e token App Check ao backend.
3. `/criar-preferencia`: valida ownership, contratação, indicador e recompensa fixa a partir do banco; reserva um registro determinístico em transação e cria a preferência no Mercado Pago.
4. Backend escolhe a URL conforme ambiente e identidade do vendedor de teste. Cliente usa `checkoutUrl` e abre na mesma aba, incluindo testes com `init_point`.
5. As três URLs de retorno das preferências novas incluem `pagamento_id`. O cliente procura um payment ID numérico, o ID interno ou a preferência; consulta o servidor em vez de confiar no status da URL.
6. Servidor busca o pagamento no Mercado Pago, confere referência externa, moeda e valor e persiste pagamento/transação. Webhooks assinados podem executar a mesma conciliação.
7. Em sandbox, `status=approved` confirma a simulação, sem crédito em `indicadorSaldos` e sem movimentação financeira real.

Arquivos centrais: `src/components/pagamentos/ModalPagamentoRecompensa.jsx`, `src/pages/empresa/EmpresaPagamentos.jsx`, `src/pages/empresa/EmpresaCandidatos.jsx`, `src/services/firebaseFunctions.js`, `src/services/firestorePagamentos.js`, `src/utils/mercadoPagoCheckout.js`, `functions/src/mercadoPagoCore.cjs` e `functions/index.cjs`. Foram conferidas as restrições financeiras em `firestore.rules`.

## Achados corrigidos

| Achado | Efeito anterior | Correção |
| --- | --- | --- |
| Primeiro envio sandbox retornava antes de abrir a URL | Exigia outro clique para entrar no checkout | Abre após a confirmação e criação, na mesma aba, sem popup |
| Preferência incondicional por `sandboxInitPoint`/`sandboxCheckoutUrl` em vários consumidores | Podia encaminhar uma cobrança de produção ao checkout sandbox | Usa primeiro a URL escolhida pelo servidor; mantém o ambiente no estado de candidatos |
| `payment_id=null`/`undefined` tratado como payment ID | API rejeitava o identificador | Aceita apenas payment ID numérico e usa ID interno/preferência como alternativas |
| Falha da sincronização interrompia a listagem | Um problema no retorno aparentava falha de todo o histórico | Trata a conciliação separadamente, preserva identificadores em caso de erro e mantém histórico/consulta manual |
| Tela anunciava saldo atualizado em aprovação sandbox | Expectativa incorreta sobre dinheiro disponível | Distingue aprovação de teste e aprovação de produção |
| Notificação podia falhar depois do commit financeiro | Resposta de erro apesar do checkout já persistido | Mantém o resultado financeiro; registra falha de notificação sem expor dados da compra |
| Registro `created` sem ação na lista | Não havia consulta manual pelo histórico | Permite atualizar status sem criar outra cobrança |
| Rejeição de webhook não tinha motivo estruturado no log | HTTP 401 não permitia distinguir configuração e formato | Registra somente um código: segredo ausente, assinatura incompleta/divergente, formato, timestamp ou IDs divergentes |

Os registros aprovados, a validação Firebase/App Check, o ownership e a assinatura do webhook permanecem obrigatórios. Não foi criado caminho para aprovar pagamentos pelo navegador nem para liberar saldo sandbox.

## Verificações remotas em 19/10/2026

| Consulta | Resultado observado | Limite |
| --- | --- | --- |
| `GET https://selectio.app.br/` | HTTP 200 | Disponibilidade da página, sem sessão autenticada |
| `GET .../mercadoPagoApi/health` | HTTP 200; `ambiente=sandbox` | Não valida Access Token, secret, permissões ou compra |
| Preflight com Origin `https://selectio.app.br` | HTTP 204; Origin liberada | CORS do domínio informado pelo usuário |
| Origins `www.selectio.app.br`, domínios Firebase e localhost | HTTP 403 | A API publicada restringe origem; usar o domínio canônico na apresentação |
| Últimos 100 logs da Function | 50 POSTs ao caminho do webhook terminam em 401; criações e sincronizações também têm respostas 200/201 | A amostra vai de 15 a 19/10; não associa o erro ao checkout relatado nem revela qual validação falhou |

Os 401 dos webhooks são um ponto prioritário de investigação. Hipóteses: secret de outra aplicação/ambiente, notificações sem assinatura compatível, formato divergente ou timestamp fora da janela. Os logs anteriores não contêm o motivo. Não foi lido nem substituído nenhum secret e não se afirma que haja divergência comprovada entre seus valores.

A documentação atual do Mercado Pago informa que pagamentos com credenciais de teste não enviam notificações automaticamente; testar a recepção exige o painel da integração. Portanto, uma demonstração sandbox deve validar também o retorno e a consulta explícita, sem depender exclusivamente de webhook. Fonte: [Configurar notificações](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications).

## Configuração necessária para fechar o diagnóstico

- Vendedor: Access Token da integração de teste correspondente ao checkout. Sua validade e identidade foram conferidas pela API com a cópia local fornecida. Isso não comprova igualdade com o valor atualmente publicado no Secret Manager; o token não pertence ao `.env` Vite.
- Webhook: `MP_WEBHOOK_SECRET` correspondente à aplicação que envia a notificação. Conferir URL e configuração no painel, sem desabilitar validação de assinatura.
- Comprador: conta de teste distinta do vendedor, usada pelo responsável no navegador. Não registrar senha ou token em issue, chat, screenshot ou relatório.
- `MP_ENVIRONMENT=sandbox`; backend e build publicado devem retornar para `https://selectio.app.br`, sem localhost e sem emulador no build publicado.
- App Check: chave pública da mesma aplicação e domínio autorizado. Estar preenchida no `.env` não comprova emissão válida de token no domínio publicado.

Para investigar com credenciais locais, usar `functions/.secret.local` ignorado pelo Git, com `MERCADO_PAGO_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`. Isso não atualiza os secrets da Function publicada. `VITE_MERCADO_PAGO_PUBLIC_KEY` e `VITE_MERCADO_PAGO_SANDBOX_URL` não são consumidas pelo fluxo atual.

## Roteiro de ensaio da apresentação

1. Confirmar a versão revisada publicada após revisão humana e autorização de deploy. O trabalho desta revisão ficou local.
2. Usar `https://selectio.app.br` em janela anônima, com a empresa de demonstração no Selectio e o comprador de teste no Mercado Pago. Evitar sessão do vendedor nessa janela. O fornecedor orienta testes em janela anônima: [Realizar compras de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases).
3. Escolher candidato de demonstração contratado, da empresa correta, com indicador e recompensa fixa positiva. Para outro ensaio completo, preparar outro candidato ainda sem pagamento aprovado; uma segunda cobrança do mesmo candidato é bloqueada intencionalmente.
4. Confirmar pagamento uma vez. Esperar checkout abrir na mesma aba. Usar os dados de cartão e cenário de aprovação vigentes na documentação oficial vinculada acima.
5. Concluir a compra e voltar ao Selectio. Confirmar, pela consulta ao servidor, `encontrado=true`, `status=approved` e `ambiente=sandbox`. O parâmetro de sucesso na URL sozinho não é comprovação.
6. Confirmar histórico aprovado e ausência de mensagem de saldo real liberado. Se o provedor ainda não apresentar resultado, usar **Atualizar status**; não tentar pagar novamente apenas porque a confirmação demorou.
7. Ensaiar também cancelamento/retorno sem payment ID, indisponibilidade temporária de consulta e continuação de checkout pendente. O histórico deve continuar disponível.
8. No painel da integração, simular uma notificação assinada de um pagamento válido e conferir o status HTTP e os novos códigos de diagnóstico. O resultado dessa simulação ainda não foi obtido nesta revisão.

## Limitações remanescentes identificadas no código

- Timeout/5xx após criar preferência mantém a reserva em `created` para evitar duplicidade. A consulta manual ajuda se já houver pagamento localizável; não há recuperação automática de preferência órfã sem pagamento. Não apagar a reserva nem liberar outra cobrança sem conciliação com o provedor.
- Retentativas reutilizam o registro e a referência externa; a busca por referência prioriza o pagamento mais recente e o processamento não implementa uma política completa de ordenação de eventos/tentativas. Isso merece testes adicionais antes de uso financeiro real.
- Reembolso/chargeback atualiza status, mas não implementa compensação completa de crédito já disponibilizado. Saque registra/reserva valores; não demonstra transferência bancária executada. Fora do escopo de validar o checkout sandbox.
- Falhas de notificação agora não invalidam sucesso financeiro, mas não existe fila de reenvio automático nesta mudança.
- A mensagem genérica do checkout foi identificada por screenshot; o motivo técnico continua desconhecido. Falta distinguir cenário de teste recusado, dados/conta utilizados e outros erros do provedor. Mudanças no retorno do Selectio não comprovam que essa etapa externa esteja resolvida.

## Validação

- `npm run lint`, `npm run i18n:check`, `npm run security:check`, `git diff --check` e `npm run build`.
- `npm run test:unit`: 60 testes aprovados.
- `npm run test:security:emulators`: 75 testes aprovados após o complemento; inclui 15 testes específicos de pagamentos, com seleção de `init_point` para test_user e bloqueio de vendedor real no modo sandbox.
- `npm run test:functions`: 4 testes HTTP aprovados, com secrets fictícios temporários removidos após execução.
- Edge/Playwright: navegação pública centralizada e sem sobreposição no header em 390/901/1024/1440 px.
- Componentes reais de pagamento no navegador, com serviços fictícios e sem Firebase real: primeiro clique abre checkout na mesma aba; falha de retorno preserva histórico e consulta manual; retorno com IDs `null` consulta pela preferência; aprovação sandbox não anuncia saldo real; continuação do histórico abre o link existente sem criar pagamento; bloco técnico de ambiente não é exibido.
- Node local 24.21.0; Functions/CI declaram Node 22. Java 21 portátil usado apenas pelos processos de validação. Nenhuma instalação de Java no sistema.
- Build mantém aviso de chunks acima de 500 kB. Auditoria npm, compra externa com credenciais de teste e deploy não executados.
