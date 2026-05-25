# DevKit

API call templates, test scripts, and seed tooling for AccessMan development. Uses `.http` files compatible with IDE HTTP client extensions like [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) for VSCode.

## Setup

1. Copy `.env.example` to `.env` and fill in values matching your `ambackend/.env`
2. Install an HTTP client extension in your IDE
3. Open any `.http` file and click "Send Request" above each request block

## Files

| File | Description |
|---|---|
| `guards.http` | Security guard rejection tests (missing/wrong headers) |
| `apps.http` | App management: list apps, create app, duplicate test |
| `import.http` | All import operations: JSON/CSV, per-app, duplicate, custom token import, re-issue |
| `tokens.http` | Token verify, metadata update, list/filter, detail, revoke |
| `test-verify-metadata.js` | Self-provisioning test script for verify, metadata, and lastVerifiedAt |
| `seed.js` | Database seed script -- populates apps, tokens, and metadata with realistic data |

## Seed Script

Populates the database with realistic apps, tokens, and metadata. Exercises all endpoint variations: bulk JSON import, per-app import, CSV import, custom token import, metadata CRUD, verify, list/filter, detail, revoke, and reissue.

```bash
# From ambackend/
npm run seed

# Or directly
node devkit/seed.js
```

Configure the number of tokens and apps via `SEED_TOKEN_COUNT` and `SEED_APP_COUNT` in `devkit/.env`.

## Test Script

Run the verify/metadata test script against a running server:

```bash
# From ambackend/
npm run test:verify

# Or directly
node devkit/test-verify-metadata.js
```

The script is self-provisioning -- it imports its own tokens, then tests verify, metadata CRUD, rejection cases, and lastVerifiedAt tracking. Reads connection details from `devkit/.env`.

## Variables

Variables are loaded from `.env` via `{{$dotenv VAR}}` syntax:

| Variable | Description |
|---|---|
| `HOST` | Backend URL (e.g., `http://localhost:3000/api`) |
| `SECURITY_KEY` | Shared security key |
| `OPERATOR_KEY` | Operator-level key |
| `ADMIN_APP_NAME` | Admin app name (default: `am-panel`) |
| `SEED_TOKEN_COUNT` | Number of tokens to create in seed (default: `50`) |
| `SEED_APP_COUNT` | Target number of apps in seed (default: `8`) |

The `.env` file is gitignored. Only `.env.example` is tracked.
