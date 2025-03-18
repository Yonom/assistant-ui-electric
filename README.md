# assistant-ui + ElectricSQL

Resumable AI streams, built with:

- assistant-ui
- ElectricSQL
- PostgreSQL
- Cloudflare Workers
- Drizzle ORM

## Getting started

Start docker

```sh
cd docker-compose && docker compose up
```

Start backend

```sh
cd worker && pnpm i && pnpm drizzle-kit push && pnpm run dev
```

Start frontend

```sh
cd frontend && pnpm i && pnpm run dev
```
