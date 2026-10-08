# Páginas institucionais públicas

Implementação local em 08/10/2026, base `207dd2f`, na `main`. Rotas: `/privacidade`, `/termos`, `/contato`, `/faq`, `/equipe`; o fallback `*` usa a página 404 sem redirecionar. `InstitutionalLayout` reaproveita Navbar/Footer, atualiza o título por idioma e inicia as páginas institucionais no topo. Os textos ficam no namespace `institutional` em pt-BR/en-US.

O Footer anterior tinha quatro links `#`. Agora oferece Institucional (Equipe/Contato) e Ajuda (FAQ/Privacidade/Termos), além de logo para início e copyright. A referência Moomate foi consultada somente para agrupamento conceitual; nenhum texto, estilo ou código foi incorporado.

## Fontes de equipe

Consultadas com a skill Google Drive, sem alterar os documentos:

- [PlanoDeNegócio — Selectio (Entrega)](https://docs.google.com/document/d/1rI8yZZHZFHAAFmMjBrFxU_HkifzwtgMy/edit), modificado em 06/10/2026: seção Equipe e descrição de responsabilidades.
- [MARKETING](https://docs.google.com/document/d/1CUgcDJR-Tpy5zkapQkhef3jy9ZLbTWFyFvqf7yJnpKY/edit), modificado em 28/09/2026: seção Pessoas, origem na FECAP e responsabilidades complementares.
- [Pitch atualizado — escuro](https://docs.google.com/presentation/d/1no8Kc6xAw0G60LSsnY-0dj9DVuxBWWZ7/edit), modificado em 07/10/2026: apresentação dos três integrantes, administração, projetos e tecnologia.

Usadas funções descritivas (Administração, Gestão de projetos, Desenvolvimento técnico), sem inventar biografias, formação adicional ou cargos societários. Os documentos variam entre Souza/Sousa para Marcos; foi mantida a grafia **Marcos Vinícios Souza Peyerl**, explicitada pelo responsável e presente na seção Equipe do Plano. Sem fotos oficiais no repositório, a apresentação utiliza iniciais tipográficas.

## Conteúdo e pendências

Privacidade e Termos refletem cadastro/perfis, dados profissionais e currículos, indicações, análise de compatibilidade, decisões humanas, notificações e pagamentos presentes no código. Serviços Firebase/Google e Mercado Pago foram confirmados em código; não foram adotadas tecnologias nem promessas comerciais de documentos antigos. Direitos foram descritos de forma geral, com link para a [orientação da ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares).

Não há canal oficial de suporte confirmado nem backend de contato identificado. O pitch apresenta uma identificação de rede social sem URL/plataforma suficientes para validar atendimento; ela não foi convertida em canal oficial. Contato informa canal em definição, sem formulário ou promessa de envio. Não foram inventados e-mail, telefone, endereço, redes sociais, idade mínima, comissões, prazos, certificações ou garantias de segurança/disponibilidade.

Antes do lançamento comercial, revisar juridicamente os documentos, identificar responsáveis pelo tratamento e bases legais, definir canal para solicitações de titulares, procedimentos de atendimento e retenção e condições comerciais definitivas. As páginas são uma versão inicial do MVP, não uma política aprovada juridicamente.

## Verificação

Testes de renderização (`tests/institutional.test.mjs`) conferem as seis páginas nos dois idiomas, landmarks/headings, destinos do Footer, ausência de formulário fictício, vínculos acessíveis do FAQ e ações da 404. A prévia de navegador usa sessão pública e catálogo isolados, sem autenticação ou dados reais; rotas, links do Footer, accordion, títulos traduzidos, scroll e URL inválida foram conferidos, com inspeção visual desktop/mobile e tema escuro. Não representa validação de Hosting remoto ou de usuários autenticados.

Scanner, lint, i18n, 57 testes unitários e build passaram. Build mantém aviso de chunks acima de 500 kB. Não foram repetidos emuladores/Functions nesta tarefa de UI; nenhuma dessas áreas foi alterada. A correção anterior de auditoria em `functions/package-lock.json` foi preservada separadamente.
