# Fotos protegidas e CORS do Storage

As fotos sao baixadas pelo Firebase SDK com `getBlob()` e exibidas por uma URL
`blob:` local. O bucket precisa permitir a origem do site no CORS, alem de
autorizar a leitura nas Storage Rules e, quando exigido, no App Check.

Em 21/10/2026, consulta autenticada ao bucket
`selectio-1f022.firebasestorage.app` confirmou que o CORS permitia localhost e
os dominios Firebase, mas nao `https://selectio.app.br`. O bucket existe;
republicar apenas Hosting ou Storage Rules nao modifica esse CORS.

Foi conferida uma foto existente: metadata e download retornaram HTTP 200.
No GET de imagem, a resposta para `Origin: http://localhost:5173` incluiu
`Access-Control-Allow-Origin`, mas a resposta para `Origin: https://selectio.app.br`
nao incluiu o cabecalho. Isso confirma o bloqueio de leitura no navegador do
dominio. O preflight OPTIONS sozinho retornou permissao e nao revelou a falha;
e necessario conferir tambem a resposta GET. As regras publicadas incluem as
fotos de perfil. O App Check do Storage foi observado como UNENFORCED; nenhuma
configuracao de enforcement foi alterada.

Na raiz do projeto, com a sessao da Firebase CLI autenticada:

```powershell
node scripts/configurar-cors-storage.cjs
```

O comando acima so consulta. Para aplicar a inclusao de GET/HEAD da origem
canonica no bucket publicado:

```powershell
node scripts/configurar-cors-storage.cjs --apply
```

O script preserva as entradas atuais, usa a metageneration para impedir que
uma alteracao concorrente seja sobrescrita e nao altera Rules, objetos ou IAM.
Nao permite acesso anonimo as fotos nem imprime tokens. Requer permissao de
consultar e atualizar os metadados do bucket. Se o GET for autorizado mas o
PATCH retornar 403, use uma conta administradora autorizada para esse bucket.

Depois, recarregue o site e confira uma foto existente na aba Network do
navegador. CORS corrigido nao resolve objeto excluido, permissao negada pelas
Rules ou App Check invalido; esses erros precisam ser avaliados separadamente.

Referencia: [download direto e CORS no Firebase Storage](https://firebase.google.com/docs/storage/web/download-files#cors_configuration).
