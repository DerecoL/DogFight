# DogFight

DogFight is a React/Vite game with a Fastify API and Prisma persistence.

## Local Development

Install dependencies:

```bash
npm install
```

Run tests that do not require a database:

```bash
npm test
```

Run the app locally:

```bash
npm run dev
```

The project now targets PostgreSQL. Database-backed API tests run only when `TEST_DATABASE_URL` or a PostgreSQL `DATABASE_URL` is set.

## Production Deployment

Production uses Docker Compose on Ubuntu:

- PostgreSQL stores player accounts and game state.
- Fastify serves `/api`.
- Caddy serves the Vite build, manages HTTPS, and proxies `/api` to Fastify.

See [docs/deployment/tencent-cloud.md](docs/deployment/tencent-cloud.md) for the Chinese Tencent Cloud deployment and operations guide.

Before production rollout, use [docs/deployment/readiness-checklist.md](docs/deployment/readiness-checklist.md) to track missing GitHub, Tencent Cloud, domain, secret, and backup settings.
