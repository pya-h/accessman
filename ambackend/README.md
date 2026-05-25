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

### Import Fields

| Field | Required | Description |
|---|---|---|
| `userId` | no (import), **yes** (reissue) | User identifier. Auto-generated UUID if omitted during import |
| `appName` | yes (global), no (per-app URL) | Target app name. Inferred from URL for `/api/import/:appName` |
| `expiresAt` | no | ISO 8601 date. No expiry if omitted |
| `token` | no | Custom token string. Auto-generated if omitted. Format: `{appName}_{CODE}`, CODE 8-64 chars |

### Custom Token Import

All import endpoints support an optional `token` field per item, allowing operators to provide their own token strings instead of having the service auto-generate them. Custom tokens must follow the format `{appName}_{CODE}` where CODE is 8-64 characters.

## Token Format

```
{appName}_{64_hex_chars}
```

Tokens are stored as SHA-256 hashes. The raw token is returned only once at creation time. Each token is scoped to one user + one app, with one active token allowed per pair.

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
    token.utils.ts           # generateToken, hashToken, extractAppName,
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

  migrations/
    <timestamp>-Init.ts      # Schema + admin app seed
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
