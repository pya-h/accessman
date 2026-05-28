# AccessMan Backend

Centralized access token management service. Issues, verifies, and manages opaque access tokens across multiple applications.

## Tech Stack

- **Runtime**: Node.js >= 20
- **Framework**: NestJS 11 + Fastify 5
- **Database**: PostgreSQL + TypeORM (migrations only, no synchronize)
- **Language**: TypeScript

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your database URL and security keys

# Create database
createdb accessman

# Run migrations
npm run migration:run

# Start development server
npm run start:dev
```

The server starts at `http://localhost:3000` with all routes under `/api`.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://postgres:postgres@localhost:5432/accessman` | PostgreSQL connection string |
| `SECURITY_KEY` | yes | - | Shared security key for all API requests |
| `OPERATOR_KEY` | yes | - | Additional key for operator-level access |
| `PORT` | no | `3000` | Server port |
| `ADMIN_APP_NAME` | no | `am-panel` | App name for admin/operator access |
| `DATABASE_TEST_URL` | no | - | PostgreSQL connection for E2E tests |

## Security Model

All API requests require two headers: `X-Security` (shared key) and `X-App-Name` (registered app name).

- **Tier 1** (consuming apps): `X-Security` + `X-App-Name` -- verify tokens, update metadata
- **Tier 2** (operators): `X-Security` + `X-App-Name` (admin) + `X-Operator-Key` -- import, revoke, list, manage apps

## API Endpoints

### Tier 1 -- App-Level

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/tokens/verify` | Verify a token and get metadata |
| `PATCH` | `/api/tokens/metadata` | Update a token's metadata (full replace) |

### Tier 2 -- Operator-Level

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/import` | Bulk import tokens (JSON or CSV) |
| `POST` | `/api/import/:appName` | Per-app import (appName from URL) |
| `POST` | `/api/import/reissue` | Re-issue tokens (revoke old + issue new) |
| `GET` | `/api/tokens` | List tokens with filters and pagination |
| `GET` | `/api/tokens/:id` | Get single token detail |
| `POST` | `/api/tokens/:id/revoke` | Revoke a token |
| `GET` | `/api/apps` | List all registered apps |
| `POST` | `/api/apps` | Register a new app |
| `GET` | `/api/settings` | Read token-generation settings |
| `PATCH` | `/api/settings` | Update code length / character set / app-name prefix |

### Import Fields

| Field | Required | Description |
|---|---|---|
| `userId` | no (import), **yes** (reissue) | User identifier. Auto-generated UUID if omitted during import |
| `appName` | yes (global), no (per-app URL) | Target app name. Inferred from URL for `/api/import/:appName` |
| `expiresAt` | no | ISO 8601 date. No expiry if omitted |
| `token` | no | Custom token string. Auto-generated if omitted. Any string 4-64 chars (no app prefix required) |

### Custom Token Import

All import endpoints support an optional `token` field per item, allowing operators to provide their own token strings instead of having the service auto-generate them. A custom token is any string 4-64 characters — no app-name prefix is required.

## Token Format

By default a token is a random code of the configured length (default 4), drawn from lowercase letters + digits, with no app-name prefix:

```
a1b2
```

Generation is controlled by the `GET`/`PATCH /api/settings` endpoints:
- `codeLength` (4-64, default 4)
- `letterCase` (`lower`/`upper`/`both`, default `lower`) — letters are always included
- `includeNumbers` (default true) — digits 0-9
- `includeSpecial` (default false) — basic symbols `!@#$%^&*`
- `prefixAppName` (default false) — display-only `{appName}_` prefix

Tokens are stored as SHA-256 hashes and the raw token is returned only once at creation time. Each token is scoped to one user + one app (one active token per pair); the owning app is verified against the `X-App-Name` header, not the token text.

## Scripts

```bash
npm run start:dev          # Development with watch mode
npm run build              # Compile to dist/
npm run start:prod         # Run compiled output

npm run test               # Unit tests
npm run test:e2e           # E2E tests (requires DATABASE_TEST_URL)
npm run test:cov           # Coverage report
npm run test:verify        # Run verify/metadata integration test (requires running server)
npm run seed               # Populate DB with realistic sample data (requires running server)

npm run migration:run      # Run pending migrations
npm run migration:revert   # Revert last migration
npm run migration:generate # Auto-generate migration from entity changes
npm run migration:show     # Show migration status

npm run lint               # Lint and auto-fix
npm run format             # Format with Prettier
```

## Project Structure

```
src/
  main.ts                    # Fastify bootstrap, global pipes, CSV parser
  app.module.ts              # Root module
  typeorm.config.ts          # DataSource for CLI and NestJS

  config/
    security.config.ts       # Security keys and admin app name

  common/
    guards/
      app-security.guard.ts  # Tier 1: validates X-Security + X-App-Name
      operator.guard.ts      # Tier 2: validates X-Operator-Key + admin app
    decorators/
      app-name.decorator.ts  # @RequestApp() parameter decorator

  apps/
    app.entity.ts
    apps.service.ts
    apps.controller.ts
    apps.module.ts
    dto/create-app.dto.ts

  tokens/
    token.entity.ts
    token.utils.ts           # generateToken, hashToken,
                             # validateCustomToken, processCustomToken
    tokens.service.ts
    tokens.controller.ts
    tokens.module.ts
    dto/
      verify-token.dto.ts
      update-metadata.dto.ts
      list-tokens-query.dto.ts

  import/
    import.service.ts        # importTokens, reIssueTokens, resolveItems, parseCsv
    import.controller.ts
    import.module.ts
    dto/
      import-item.dto.ts         # userId optional
      import-item-per-app.dto.ts # userId optional, no appName
      reissue-item.dto.ts        # userId required

  settings/
    settings.entity.ts       # Single-row token-generation settings
    settings.service.ts      # get / update singleton row
    settings.controller.ts   # GET / PATCH /api/settings
    settings.module.ts
    dto/update-settings.dto.ts

  migrations/
    <timestamp>-Init.ts            # Schema + admin app seed
    <timestamp>-AddLastVerifiedAt.ts
    <timestamp>-CreateSettings.ts  # settings table + singleton row
```

## Testing

Unit tests mock the database layer and cover all service methods. E2E tests spin up a real NestJS app with a test database and test all endpoints including security guards.

```bash
# Unit tests (80 tests)
npm test

# E2E tests (77 tests, requires DATABASE_TEST_URL in .env)
npm run test:e2e

# Verify/metadata integration test (requires running server + devkit/.env)
npm run test:verify
```

## Deployment

### Docker (recommended)

The service is built and deployed via the multi-stage Dockerfile in the project root. The container bundles the backend, panel static files, and runs migrations on startup.

```bash
docker build -t accessman ..
docker run -p 3000:3000 --env-file .env accessman
```

### Manual

```bash
npm run build
npm run migration:run
npm run start:prod
```

In production, the panel's static files should be placed in `public/` (done automatically by `ampanel`'s `npm run push` or by the Docker build).
