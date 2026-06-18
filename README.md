# Selectio

MVP SaaS de recrutamento e indicacao de talentos feito com React + Vite e Firebase.

## Rodar Local

tem um arquivo novo q precisa colocar, ta tudo no drive, o env e o serviceaccount é na raiz e o env local é no scripts

Instale dependencias:

```bash
npm install
```

Em um terminal, rode o backend local Mercado Pago:

```bash
npm run sandbox:mercado-pago
```

Em outro terminal, rode o frontend:

```bash
npm run dev
```

hook local que bloqueia commits com credenciais:

```bash
npm run security:setup
```

## Acesso administrativo

O painel administrativo fica em `/admin` e não possui cadastro público.

Para liberar uma conta:

1. Crie o usuário no Firebase Authentication.
2. No Firestore, crie manualmente o documento `users/{firebaseAuthUid}`.
3. Use um campo administrativo explícito:

```json
{
  "uid": "FIREBASE_AUTH_UID",
  "tipo": "admin",
  "nome": "Selectio Admin",
  "email": "admin@exemplo.com"
}
```

Também são reconhecidos `role: "admin"` ou `papel: "admin"`. As regras impedem
que empresa ou indicador promovam a própria conta pelo navegador. O painel
admin possui leitura global, mas não permite excluir registros, alterar saldos
ou executar pagamentos.
