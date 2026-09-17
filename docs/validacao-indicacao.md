# Validação antes da indicação

A indicação exige análise válida com nota **estritamente maior que 45%**. Exatamente 45% bloqueia; 45,1% permite. Alertas e cobertura não impõem limites adicionais. Autenticação, nome, e-mail, propriedade do cadastro, vaga aberta e prevenção de duplicidade continuam obrigatórios.

## Funcionamento

- O formulário chama `indicacoesApi` com a ação `analisar`. O servidor consulta a vaga e o cadastro pré-salvo, lê o currículo protegido e executa o motor compartilhado em `functions/shared/`.
- O resultado aparece antes do envio, com critérios, evidências e alertas. Alterar o formulário ou o arquivo invalida a prévia. A autorização expira em 30 minutos.
- A ação `finalizar` verifica os dados, as versões da vaga e do pré-salvo, a geração do arquivo e a versão do motor. O navegador não fornece a pontuação que autoriza o envio.
- Uma transação grava candidato, indicação, histórico, snapshot da análise, chave de unicidade e notificações. Repetições da mesma autorização devolvem o candidato já criado. Autorizações diferentes para o mesmo indicador, vaga e e-mail não geram duplicidade. Cadastros pré-salvos também preservam a chave canônica existente.
- A análise de entrada fica em `analisesIndicacao`; reavaliar o ranking em `analisesCompatibilidade` não substitui esse histórico. Os campos `compatibilidadeIndicacao` do candidato e da indicação guardam nota, versões, assinaturas e data.
- As coleções `validacoesIndicacao` e `indicacoesUnicas` não permitem leitura nem gravação pelo cliente. Indicações e snapshots são criados exclusivamente pelo servidor. Os participantes podem ler o snapshot final.
- Os pesos e fatores existentes são preservados. `nota` continua inteira para o ranking; `notaPrecisa` é calculada sem arredondar os pontos intermediários, com precisão final de 12 casas decimais.

## Currículos e informações insuficientes

PDF com texto selecionável e DOCX são extraídos no servidor. Limites: 10 MB, 50 páginas para PDF e 200 mil caracteres extraídos. PDF escaneado sem texto, arquivo ilegível ou DOC antigo exige reenvio em formato legível; falha de extração não recebe nota zero nem libera a indicação. Sem currículo disponível, os dados profissionais estruturados podem produzir uma análise válida. Habilidades informadas apenas no formulário mantêm o atendimento parcial do motor existente.

Nesta etapa, a comparação usa o motor lexical existente, sem baixar o modelo semântico do navegador. A prévia e a autorização usam o mesmo processamento no servidor. O ranking da empresa mantém sua análise semântica atual e pode produzir outra pontuação em uma reavaliação.

Vagas sem rubrica usam apenas seus requisitos e descrição existentes, com os pesos padrão. Sem critérios avaliáveis, ou sem evidências profissionais relevantes, o envio permanece bloqueado com uma mensagem específica.

Uploads novos usam `curriculos/{uid}/temporarios/…`, com acesso privado e sem sobrescrita. O servidor conserva uma cópia do arquivo analisado e cria o currículo final protegido. Arquivos de candidatos indicados não podem ser substituídos pelo cliente. A regra de imutabilidade exige `resource == null`, conforme a [referência de regras do Storage](https://firebase.google.com/docs/reference/security/storage).

`limparValidacoesIndicacao` executa diariamente: remove até 100 autorizações expiradas há mais de 24 horas por execução, suas cópias privadas e arquivos órfãos, além dos currículos temporários com mais de 24 horas. As análises finais permanecem disponíveis. Não configure TTL direto em `validacoesIndicacao`: a rotina precisa ler o documento para limpar seus arquivos.

## Publicação

O Firebase Hosting foi desativado em 16/09/2026 após o teste de hospedagem. O desenvolvimento segue localmente. Uma nova publicação em Hosting reativa o site e deve ocorrer apenas quando solicitada.

É necessário publicar funções, regras e frontend de forma coordenada. As regras novas bloqueiam versões antigas do frontend que gravam indicações diretamente. Não publique apenas o frontend ou apenas as regras.

1. Instale as dependências com `npm ci` e `npm --prefix functions ci` (runtime das funções: Node 22).
2. Publique primeiro as funções:
   ```sh
   npm run functions:deploy:referral
   ```
3. Publique as regras e disponibilize o frontend atualizado na mesma janela de atualização:
   ```sh
   npm run build
   firebase deploy --only "firestore:rules,storage,hosting" --project selectio-1f022
   ```
   O Hosting publica `dist/` em https://selectio-1f022.web.app. O arquivo `.env.production.local`, ignorado pelo Git, deve conter a configuração oficial do aplicativo Firebase `Selectio Web`; o emulador deve estar desativado no build de produção.

As funções usam o projeto e o bucket padrão do Firebase, na região `southamerica-east1`. Não precisam dos segredos de pagamento nem de chave de IA. A conta de execução precisa acessar Firestore e os arquivos do bucket. O agendamento utiliza Cloud Scheduler.

Para desenvolvimento, `VITE_USE_FUNCTIONS_EMULATOR=true` direciona a chamada de indicação ao emulador Functions. Configure também os demais serviços Firebase no ambiente de teste; nunca use dados de produção nos testes automatizados.

## Verificações

```sh
npm run test:compatibility
npm run test:referral
npm run test:referral:server
npm run test:rules
npm run test:storage
npm run lint
npm run i18n:check
npm run build
```

Os testes dos emuladores exigem Java 21 ou posterior no PATH. Execute as suítes que limpam o mesmo projeto de emulação sequencialmente.
