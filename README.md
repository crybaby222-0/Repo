# Kira Bot — Backend

Backend completo do dashboard Kira Bot.

## Stack

- **Node.js 20+** + **TypeScript** + **Express**
- **PostgreSQL** + **Prisma ORM**
- **JWT** + **argon2** (hash de senhas)
- **Baileys** (integração WhatsApp)
- **Stripe** (assinaturas)
- **Zod** (validação)
- **Helmet** + **express-rate-limit** (segurança)

## Pré-requisitos

- Node.js 20 ou superior
- PostgreSQL 14 ou superior (local ou hospedado — Neon, Supabase, Railway, etc.)
- Conta Stripe (test mode é suficiente para começar)

## Instalação

```bash
# 1. Instale dependências
npm install

# 2. Copie .env.example e edite
cp .env.example .env
nano .env

# 3. Gere o client Prisma e rode as migrations
npm run prisma:generate
npm run prisma:migrate

# 4. Crie o admin padrão (admin@kirabot.com / admin1234)
npm run seed

# 5. Rode em dev
npm run dev
```

API sobe em `http://localhost:3333`.

## Configuração no frontend (Lovable)

No projeto frontend, defina a variável de ambiente:

```
VITE_API_URL=https://seu-servidor.com
```

## Endpoints principais

### Auth
- `POST /auth/register` — `{ name, email, password }`
- `POST /auth/login` — `{ email, password }` → `{ token, user }`
- `POST /auth/forgot-password` — `{ email }`
- `POST /auth/reset-password` — `{ token, password }`
- `GET  /auth/me` — (Bearer) → `user`

### Bot WhatsApp
- `GET  /bot` — status atual + QR (se houver)
- `POST /bot/connect` — inicia sessão Baileys
- `POST /bot/disconnect` — desconecta
- `POST /bot/restart` — reinicia

### Assinatura (Stripe)
- `GET  /subscription` — assinatura atual
- `POST /subscription/checkout` — `{ plan: "starter"|"pro"|"business" }` → `{ url }`
- `POST /webhooks/stripe` — recebe eventos Stripe (configure em dashboard.stripe.com)

### Admin (role=ADMIN)
- `GET   /admin/metrics`
- `GET   /admin/users?q=...`
- `PATCH /admin/users/:id/ban` — `{ banned: boolean }`
- `PATCH /admin/users/:id/plan` — `{ plan, status }`
- `GET   /admin/payments`
- `GET   /admin/logs`

## Configurando Stripe

1. Crie produtos e preços (assinaturas mensais) no [dashboard Stripe](https://dashboard.stripe.com/test/products).
2. Copie os `price_xxx` para o `.env` (`STRIPE_PRICE_STARTER`, etc.).
3. Configure o webhook apontando para `https://seu-servidor.com/webhooks/stripe`
   com os eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`.
4. Copie o `whsec_...` para `STRIPE_WEBHOOK_SECRET`.

Em desenvolvimento local, use o Stripe CLI:
```bash
stripe listen --forward-to localhost:3333/webhooks/stripe
```

## Baileys / WhatsApp

A sessão de cada bot é salva em `./baileys-auth/<botId>/`.
**Não rode em ambientes serverless** — Baileys precisa de WebSocket persistente
e filesystem. Use VPS, Railway, Render ou semelhante.

## Segurança

- Senhas: argon2id (vencedor da Password Hashing Competition)
- JWT armazenado em `localStorage` no frontend (considere httpOnly cookie em produção)
- Rate limit: 5 tentativas/5min em login e endpoints de auth
- CORS restrito a `CORS_ORIGIN`
- Helmet ativa headers seguros (HSTS, CSP, etc.)
- Validação Zod em todos os payloads

## Deploy sugerido

- **Railway** ou **Render** para o servidor + PostgreSQL gerenciado
- **Neon** ou **Supabase** se preferir Postgres separado
- Configure as env vars na plataforma de hospedagem
- Lembre-se de rodar `npm run prisma:deploy` no build/release

## Estrutura

```
src/
  controllers/   # handlers HTTP
  routes/        # roteamento Express
  middlewares/   # auth, errors, rate limit
  services/      # lógica de domínio (baileys, subscription)
  lib/           # prisma, env, jwt, mailer, logger
  server.ts      # bootstrap
prisma/
  schema.prisma  # schema do banco
  seed.ts        # cria admin padrão
```
# Repo
