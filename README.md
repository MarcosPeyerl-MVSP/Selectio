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

O hook local que bloqueia commits e pushes com credenciais é configurado
automaticamente pelo `npm install`. Para reconfigurá-lo manualmente:

```bash
npm run security:setup
```

powershell

```bash
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
