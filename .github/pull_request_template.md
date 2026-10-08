<!-- PR é opcional na pré-produção. Use este template para revisar mudanças grandes, segurança, pagamentos, Rules, migrações e features relevantes. -->

## O que mudou e por quê?

<!-- Descreva o problema e o comportamento resultante. -->
Issue relacionada (se houver):
Tipo de mudança: <!-- correção / funcionalidade / documentação / manutenção / refactor -->
Áreas afetadas:

## Como testar

- Passos e resultado esperado:
- Testes/checks executados e resultados:
- Não executados e motivo:
- Screenshot para UI, quando útil (sem dados pessoais):

## Impactos e riscos

<!-- Responda “não se aplica” quando pertinente. -->
- Firebase Rules / Functions:
- Autenticação / permissões:
- Impacto financeiro:
- Dados/schema e migração necessária:
- Riscos e rollback/reversão, quando relevante:
- [ ] i18n atualizado em pt-BR e en-US e validado, ou não há texto visível novo.
- [ ] Diff revisado e scanner de secrets executado.

## High-risk change

<!-- Marque as áreas afetadas; se nenhuma, escreva “nenhuma”. -->
- [ ] Auth / permissões
- [ ] Firestore Rules
- [ ] Storage Rules
- [ ] Pagamentos
- [ ] Saldo / saque
- [ ] Mercado Pago
- [ ] Ranking / IA
- [ ] Upload / currículo
- [ ] Migração

Para itens marcados: descreva análise do fluxo completo, segurança e testes específicos acima. HIGH-RISK exige revisão humana antes do merge; na pré-produção, ela pode ser feita pelo desenvolvedor responsável, sem approval formal de outra pessoa.
