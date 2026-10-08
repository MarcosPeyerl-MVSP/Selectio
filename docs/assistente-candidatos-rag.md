# Assistente de candidatos com RAG

Implementação local em 08/10/2026, base `ea969a5`, na `main`, respeitando a preferência explícita do responsável por não criar branches. Nenhum deploy, cadastro de secret ou uso de candidatos reais. Esta área é HIGH-RISK e requer revisão humana e de privacidade antes de publicação. Não comprova configuração remota.

## Arquitetura e uso

Área própria em `/painel/empresa?secao=assistente`, com acesso pela Sidebar empresarial. `EmpresaAssistenteCandidatos.jsx` usa `assistenteCandidatosApi`, callable v2 em `southamerica-east1`, Node 22. Firebase Auth e App Check em produção; serviços e provider são injetáveis para testes. Não altera pagamentos, indicação, elegibilidade, ranking ou pipeline.

Fluxo: validar identidade empresarial → verificar ownership da vaga → buscar candidatos estritamente por `empresaId` + `vagaId` → preparar índice privado em lotes → recuperar trechos por relevância e cobertura → enviar contexto limitado ao Gemini → validar saída estruturada e referências → revalidar acesso/documentos → devolver citações reais.

Chat fica apenas no estado local da página. Nova conversa e troca de vaga limpam mensagens. Respostas atrasadas de outra vaga são descartadas. São enviados somente os últimos quatro turnos do usuário; respostas anteriores do modelo não são aceitas como fontes. A interface mostra progresso, limites, erro, ausência de vagas/candidatos, fontes incompletas e trechos expansíveis. Enter envia; Shift+Enter cria linha. Perfil reutiliza `ModalPerfilCandidato` sem edição de status.

## Identidade e isolamento

O UID vem de `request.auth`, nunca do payload. Exige `users/{uid}.tipo == empresa` e existência de `empresas/{uid}`. Vaga deve pertencer ao UID. Consultas usam os vínculos canônicos `empresaId`/`vagaId`. Coleções legadas sem esses vínculos não entram no índice. Não há lista arbitrária de candidatos nem `companyId` aceito do cliente. O acesso é revalidado depois de extração e geração.

Todos os setores usam a identidade empresarial existente. Não foi criado RBAC por setor; caches de setor no navegador não autorizam acesso. Não há delegação a contas separadas de colaboradores neste MVP.

## Fontes, extração e cache

`candidatos` já persiste o formulário profissional e referência do currículo protegido. As análises existentes guardam resultados/evidências, mas não disponibilizam um texto integral confiável para reutilização direta neste RAG. O MVP consulta fontes originais, preserva o ranking e não usa sua nota como decisão.

Allowlist do formulário: `cargoAtual`, `anosExperiencia`, `escolaridade`, `proficienciaIdiomas`, `hardSkills`, `pontosFortes`, `destaquesProjetos`, `narrativa`, `observacoesProfissionais`. Fontes de narrativa/pontos fortes são declarações do formulário, não comprovação independente. Vaga inclui título, descrição, responsabilidades, requisitos e campos profissionais existentes/rubrica, com contexto de até 8.000 caracteres.

Currículo: somente caminho `curriculos/{indicadorId}/candidatos/{candidatoId}/{arquivo}`, com vínculo confirmado no documento e metadata Storage (`empresaId`, `indicadorId`, `registroId`, `tipoRegistro`). PDF/DOCX reutilizam `extrairCurriculo` e `extracaoWorker.cjs`: até 10 MB, até 50 páginas PDF, 200.000 caracteres extraídos e 15 segundos por worker. MIME declarado não é prova de validade: o parser também valida o conteúdo. Não segue URLs externas, não envia arquivos ao Gemini e não executa OCR. Arquivo sem texto/ausente utiliza apenas formulário, com limitação visível.

Coleção `assistenteCandidatosDocumentos`: um documento por empresa/vaga/candidato, ID hash, chunks sanitizados, tipo/campo da fonte, fingerprint, hash do conteúdo, geração do arquivo e timestamps. Rules negam todas as leituras/escritas de clientes, inclusive empresa dona. Admin SDK exige checks explícitos no serviço.

Cache válido por 24 horas; fingerprint muda com conteúdo profissional, nome, currículo ou vínculo, mas não com status no pipeline. Reindexa somente documentos inválidos. Lotes de até três candidatos evitam requisições longas. Não extrai PDF em perguntas. Índice contém no máximo 80 chunks de 650 caracteres; truncamento e fontes ausentes limitam conclusões. Documentos de candidatos excluídos/transferidos deixam de ser consultados imediatamente. `expiraEm` indica retenção de sete dias: **TTL precisa ser habilitado remotamente**; sem TTL não há exclusão física automática. Reindexação sobrescreve chunks antigos. Alterações administrativas de bytes no mesmo caminho sem atualização do documento podem ser reconhecidas somente após expiração; caminhos protegidos são imutáveis para clientes pelas Rules atuais.

## Retrieval e citações

Lexical: normalização de acentos, tokens, palavras completas, termos da pergunta com maior peso que termos da vaga; distingue React de React Native. Sem embeddings ou vector DB, sem pesquisa na internet. Comparação recupera até dois chunks por candidato, respeitando 48 chunks e 36.000 caracteres. Pergunta com nome completo/primeiro nome direciona a candidatos correspondentes; nomes ambíguos podem selecionar mais de um. “Proatividade” expande busca para ações de iniciativa, sem diagnóstico de personalidade.

Cada chunk ganha `SRC_Cn_m`, candidato pseudonimizado `Cn`. IDs reais/nome ficam no backend. Modelo retorna `claims` (candidateRef, text, citationIds) e códigos `limitations`; não retorna HTML, ações ou trechos citados inventados. Todas as afirmações exigem fontes do mesmo candidato presentes naquele contexto. Referência falsa, schema inválido ou resposta truncada rejeita toda a resposta. UI recebe trechos do índice original sanitizado; não usa trecho criado pelo modelo nem URL de Storage.

Validação prova procedência das referências, **não entailment/correção semântica** de cada interpretação. Modelo pode interpretar incorretamente uma fonte real. Revise trechos. Retrieval limitado não permite afirmar ausência de habilidade; a UI avisa “não encontrei evidência nos materiais recuperados”. Sem fonte recuperada, não chama Gemini.

## Privacidade e prompt injection

Não envia campos de contato, CPF, endereço, nascimento, gênero, fotografia, links, salário, fit cultural ou soft skills para comparação. Texto livre passa pelo sanitizador existente do motor e uma camada adicional que remove contato/identificadores, linhas pessoais/protegidas e nomes conhecidos. Mesmo filtro se aplica a pergunta/histórico/vaga; uso de atributos protegidos e ações de contratação é recusado. Nomes são resolvidos no retorno para a UI autorizada.

Sanitização por regras não garante anonimização: narrativa pode conter dados pessoais não reconhecidos, nomes de terceiros e identificadores indiretos. Texto descartado pode também conter evidência profissional; é uma limitação conservadora. **Currículos reais continuam sendo dados pessoais mesmo pseudonimizados.** Não usar free tier para eles.

System prompt separado descreve todas as fontes e perguntas como dados não confiáveis, ignora instruções em documentos, proíbe decisões, traços psicológicos e atributos protegidos. Provider não tem tools/funções de ação. Teste com documento adversarial verifica separação system/context e validação de retorno. Isso reduz risco; não é garantia absoluta contra prompt injection ou viés de um modelo real. Não loga conteúdo de currículo, prompts, respostas, chaves ou detalhes de erro de SDK/provider. Não persiste conversa.

## Gemini, configuração e custos

Provider central REST `generateContent`, saída JSON com schema, timeout 25 s, temperatura 0, até 3.000 tokens de saída, sem retries automáticos, sem grounding, embeddings ou cache pago do provider. Modelo padrão configurável `gemini-2.5-flash-lite`. Nenhuma dependência nova.

Segundo os [termos Gemini](https://ai.google.dev/gemini-api/terms), conteúdo do serviço gratuito pode ser usado para melhorar produtos e não deve receber dados pessoais/confidenciais. Billing ativo no projeto pelo qual a API é acessada caracteriza serviço pago; Firebase Blaze em outro projeto não prova esse status. Confirme projeto da chave no AI Studio e condições de tratamento, retenção e revisão humana antes de uso real. Conta com usuários menores também exige revisão dos termos de idade do provider.

Parâmetros backend, sem valores reais neste repositório:

```dotenv
ASSISTANT_GEMINI_MODEL=gemini-2.5-flash-lite
ASSISTANT_DATA_POLICY=disabled
```

`GEMINI_API_KEY` é Secret Manager / secret da Function, nunca `VITE_*`. O secret é vinculado apenas a `assistenteCandidatosApi`; deploy explícito futuro precisa considerar a existência dessa configuração. `disabled` bloqueia chamadas. `paid` exige confirmação operacional do projeto de billing adequado; a flag não verifica o plano remoto. `fictional` permite chave gratuita **somente com Functions, Firestore e Storage emulados e dados inteiramente fictícios**. Não configure `paid` para contornar o tratamento do free tier.

Desenvolvimento: instale dependências da raiz/Functions, Java e CLI. Inicie `firebase emulators:start --only auth,functions,firestore,storage` (Auth deve ser configurado na CLI/config local) e direcione os SDKs de dados/autenticação de um ambiente isolado aos emuladores. A flag `VITE_USE_FUNCTIONS_EMULATOR` direciona somente Functions, não Auth/Firestore/Storage. Para testar Gemini gratuito manualmente, configure uma chave exclusivamente local ignorada e `fictional` depois de confirmar isolamento de todos os dados. Não foi configurada nem utilizada chave neste trabalho. Testes automáticos injetam provider fake e não precisam de rede externa/credenciais.

Quotas transacionais em `limitesUso`: contexto/vagas 30/min e 300/dia/UID; indexação 10/min e 80/dia/UID, global 10/min e 100 lotes/dia; perguntas 3/min e 30/dia/UID, global 10/min e 200/dia. Janelas UTC. Tentativas com falha podem consumir quota. Corpo 10 KB, pergunta 1.200 caracteres, quatro mensagens anteriores de até 1.200 caracteres. Máximo 24 candidatos/vaga: exceder interrompe a análise, não compara amostra silenciosa. Vagas listadas: primeiras 50 com aviso de truncamento.

Function: minInstances 0, maxInstances 2, concurrency 2, 1 GiB/120 s. Blaze cobra processamento/Storage/Firestore além de franquias; maxInstances não é teto financeiro. Quotas limitam chamadas, não substituem orçamento/alertas. Leitura por pergunta: identidade, vaga, até 25 candidatos e seus índices, revalidados após LLM; cache evita download/extrair todo currículo de novo. [Firebase Functions](https://firebase.google.com/docs/functions/faq-and-troubleshooting), [limites Gemini](https://ai.google.dev/gemini-api/docs/rate-limits).

Preço consultado 08/10/2026: Flash-Lite standard US$0,10/1M tokens de entrada e US$0,40/1M de saída. Exemplo ilustrativo de 8.000 tokens de entrada + 1.000 de saída: US$0,0012 por chamada, cerca de US$1,20 por 1.000 chamadas, **somente LLM**, sem Firebase/impostos/câmbio. Não é medição de uso do projeto nem promessa de custo; limites/modelo/preços podem mudar. [Tabela oficial](https://ai.google.dev/gemini-api/docs/pricing).

## Verificação e publicação futura

`test:assistant` cobre chunking, skills, comparação/cobertura, sanitização, citações, limites, provider ausente/privacidade/429/timeout, saída truncada e contexto adversarial. `assistenteServidor.test.cjs` usa Firestore Emulator e provider fake para autorização, cache/extrator, vínculos Storage, revogação, expiração, casos vazios e quotas compartilhadas. Rules server-only são testadas para cliente anônimo/empresa/indicador. `assistenteFunctions.test.cjs` confere transporte callable sem autenticação e método inválido. Suites estão nos comandos já executados pelo workflow `security`, sem duplicar jobs.

`scripts/run-functions-tests.cjs` usa credenciais fictícias exclusivamente no emulador de Functions. Preserva e restaura os arquivos locais ignorados `.secret.local`/`.env.local`, inclusive quando o processo de testes retorna falha. Não consulta secrets remotos. Resultado local: scanner/autoteste, lint, i18n, 68 testes unitários, 81 de emuladores, 6 HTTP de Functions e build aprovados. O build mantém o aviso de chunks acima de 500 kB. Prévia isolada com candidatos fictícios conferiu comparação, citações expansíveis e limpeza ao trocar vaga; visual desktop em português e estado inicial mobile em inglês. Não substitui homologação autenticada ou avaliação com modelo real.

Não foi feito teste autenticado com Gemini real, avaliação estatística de qualidade/viés, confirmação de App Check/secrets/billing/TTL/índices remotos ou deploy. Antes de publicar: revisão humana do código e de privacidade, política institucional atualizada com processamento por IA, confirmar adequação dos termos/idade, tratamento de dados, IAM/App Check/billing, modelo/quotas, índices de consulta e TTL remoto; homologar com dados fictícios. Pagamentos e status permanecem fora do assistente.
