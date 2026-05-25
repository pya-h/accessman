# AccessMan

Centralized access token management service for the Umbra platform. Issues, verifies, and manages opaque access tokens across multiple applications and websites.

AccessMan is **not** an authentication service -- it governs access tokens that grant specific users the ability to perform specific operations within consuming applications.

## Architecture

```
accessman/
  ambackend/     # Backend API service (NestJS + Fastify + PostgreSQL)
  ampanel/       # Admin panel SPA (Preact + Vite)
  devkit/        # API call templates for development/testing
  specs/         # Documentation (PRD, TDD, TASKS, etc.)
  Dockerfile     # Production container (ambackend + ampanel)
```

## How It Works

1. **Operators** import tokens for users via the API or admin panel (bulk JSON/CSV)
2. **Operators** distribute raw tokens to users through their own channels
3. **Consuming apps** verify tokens against AccessMan on each user action
4. **Consuming apps** store authorization data in the token's metadata blob

AccessMan handles issuance, storage, and verification. Consuming apps handle distribution, authorization logic, and what metadata means.

## Token Format

```
{appName}_{64_hex_chars}
```

Tokens are stored as SHA-256 hashes and returned only once at creation time. Each token is scoped to one user + one app. Operators can optionally provide custom token strings during import.

## Security Model

| Tier | Headers | Access Level |
|---|---|---|
| Tier 1 | `X-Security` + `X-App-Name` | Verify tokens, update metadata |
| Tier 2 | `X-Security` + `X-App-Name` (admin) + `X-Operator-Key` | Import, revoke, list, manage apps |

## Components

### Backend (`ambackend/`)

The core API service. NestJS 11 with Fastify 5, PostgreSQL via TypeORM.

Key endpoints:
- `POST /api/tokens/verify` -- verify a token
- `PATCH /api/tokens/metadata` -- update token metadata
- `POST /api/import` -- bulk import tokens (JSON/CSV, userId optional)
- `POST /api/import/:appName` -- per-app import (appName from URL)
- `POST /api/import/reissue` -- re-issue tokens (revoke + issue new, userId required)
- `GET /api/tokens` -- list/filter tokens (operator)
- `POST /api/tokens/:id/revoke` -- revoke a token (operator)

See [ambackend/README.md](ambackend/README.md) for setup and full API reference.

### Admin Panel (`ampanel/`)

Operator-facing web interface built with Preact + Vite. Provides visual access to all operator workflows:

- **Token management**: paginated table with search, filtering by app/status/user, detail view
- **Import interface**: paste or upload JSON/CSV, choose import or reissue mode, per-app scoping
- **Import results**: one-time display of raw tokens with copy/download, error summary
- **App management**: view registered apps, register new ones
- **Revocation**: revoke tokens from list or detail view with confirmation
- **Settings**: theme (light/dark), font size, table density

The panel authenticates using Tier 2 credentials entered at login, stored in `sessionStorage`. No server-side sessions.

### DevKit (`devkit/`)

`.http` files for testing all API endpoints using IDE HTTP client extensions (e.g., VSCode REST Client). See [devkit/README.md](devkit/README.md).

## Quick Start

```bash
cd ambackend
npm install
cp .env.example .env    # configure database URL and security keys
npm run migration:run
npm run start:dev       # http://localhost:3000
```

## Documentation

| Document | Description |
|---|---|
| [specs/PRD.md](specs/PRD.md) | Product requirements |
| [specs/TDD.md](specs/TDD.md) | Technical design |
| [specs/OVERVIEW.md](specs/OVERVIEW.md) | Technical overview |
| [specs/PANEL_PRD.md](specs/PANEL_PRD.md) | Admin panel requirements |
| [specs/TASKS.md](specs/TASKS.md) | Implementation task tracking |
| [specs/NOTES.md](specs/NOTES.md) | Side notes and suggestions |

## Docker

```bash
docker build -t accessman .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e SECURITY_KEY=... \
  -e OPERATOR_KEY=... \
  accessman
```

Migrations run automatically on container startup.
