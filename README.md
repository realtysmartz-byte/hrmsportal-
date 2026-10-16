# Realty Smartz Private Limited HRMS

Internal HR management system for Realty Smartz Private Limited — *Committed to Deliver Excellence*.

## Monorepo structure

```
apps/web          Next.js 14 (App Router) — web portal
packages/db       Prisma + PostgreSQL
packages/api      tRPC routers (shared; ready for future mobile app)
packages/shared   Zod schemas, types, constants
```

## Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL (Neon or Supabase recommended)

## Setup

### 1. Environment

```bash
cp .env.example .env
cp .env.example apps/web/.env
cp .env.example packages/db/.env
```

Set a PostgreSQL `DATABASE_URL` (Neon, Supabase, or local) and a strong `NEXTAUTH_SECRET` in all three files.

**Local Postgres via Docker:**

```bash
docker compose up -d
```

Then use:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/realty_smartz_hrms?schema=public"
```

### 2. Install & initialize

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

### 3. Open the app

rshrms.in/



## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `pnpm dev`     | Start all apps           |
| `pnpm build`   | Build all packages/apps  |
| `pnpm db:push` | Push Prisma schema       |
| `pnpm db:seed` | Seed demo data           |
