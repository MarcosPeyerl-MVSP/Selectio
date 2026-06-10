# Selectio

MVP SaaS de recrutamento e indicação de talentos feito com React + Vite e serviços gerenciados do Firebase.

O projeto usa:

- Firebase Auth para autenticação.
- Cloud Firestore para perfis, empresas, indicadores, vagas, candidatos e indicações.
- React Router para rotas do painel.
- CSS modular e React Icons para a interface.

A integração de pagamentos usa Firebase Cloud Functions. O Access Token do Mercado Pago nunca deve ser colocado no frontend.

## Rodar o programa:

Crie/configure as variáveis Vite do Firebase em um arquivo `.env` local dentro da pasta `Selectio/` e `Selectio/functions/`

Ademais, antes de rodar qualquer coisa no terminal utilize esse codigo para permitir o uso do React e do Vite

```bash
Set-ExecutionPolicy Unrestricted -Scope CurrentUser
```

Esses arquivos estão no drive em Documentos/MVP/Atual

Na pasta functions:

```bash
npm install
```
Na raiz (Selectio/):

```bash
npm install
npm run sandbox:mercado-pago
npm run dev
```
