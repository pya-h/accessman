# AccessMan Admin Panel

Operator-facing web interface for AccessMan. Provides visual access to all Tier 2 operations: importing tokens, browsing and searching tokens, revoking tokens, viewing apps, and managing import results.

## Tech Stack

- **Framework**: Preact (~3KB) with `preact-iso` router
- **Build**: Vite 6
- **Styling**: CSS Modules + CSS custom properties
- **Language**: TypeScript
- **Unit Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright

No other runtime dependencies. Uses native `fetch` and vanilla TypeScript utilities.

## Quick Start

```bash
npm install
npm run dev        # starts Vite dev server with API proxy to localhost:3000
```

The dev server proxies `/api` requests to `http://localhost:3000`, so you need the backend running locally.

## Scripts

```bash
npm run dev        # Development server with HMR
npm run build      # Type-check + production build (outputs to dist/)
npm run preview    # Preview production build locally
npm run test       # Run unit tests (Vitest)
npm run test:watch # Run unit tests in watch mode
npm run test:e2e   # Run Playwright E2E tests
npm run push       # Build + copy output to ambackend/public/
```

## Project Structure

```
src/
  main.tsx                       # Entry point
  app.tsx                        # Root component (router, providers, layout)

  api/
    client.ts                    # Fetch wrapper (auth headers, error handling)
    tokens.ts                    # Token API calls (list, detail, revoke)
    apps.ts                      # App API calls (list, create)
    import.ts                    # Import API calls (bulk, per-app, reissue)

  auth/
    auth-context.tsx             # Auth state provider (credentials in sessionStorage)
    auth-guard.tsx               # Redirect to login if not authenticated

  pages/
    login/                       # Login page (security key + operator key)
    tokens/                      # Token list + detail pages
    apps/                        # App list + register
    import/                      # Import form + results display
    settings/                    # UI preferences (theme, font, density)

  components/
    layout/shell.tsx             # App shell (sidebar + content)
    table/data-table.tsx         # Reusable data table
    pagination/                  # Pagination controls
    status-badge.tsx             # Token status indicator
    json-viewer.tsx              # Formatted JSON display
    metadata-viewer.tsx          # Tabbed metadata (Raw / Table)
    format-template.tsx          # Import format hint
    search-input.tsx             # Debounced search input
    modal.tsx                    # Confirmation modal
    toast.tsx                    # Toast notifications
    empty-state.tsx              # Empty state placeholder

  styles/
    global.css                   # CSS reset, base styles
    tokens.css                   # Design tokens (CSS variables)

  lib/
    use-query.ts                 # Data-fetching hook
    use-debounce.ts              # Debounce hook
    settings.ts                  # UI preferences (localStorage)
    csv-export.ts                # CSV download utility

e2e/
  global-setup.ts                # Builds backend+panel, starts server on :3100, seeds data
  global-teardown.ts             # Stops test server
  prepare-db.cjs                 # Syncs schema via TypeORM from backend entities
  *.spec.ts                      # Test suites (login, tokens, import, apps, settings)
```

## Authentication

The panel collects a Security Key and Operator Key at login and stores them in `sessionStorage` (cleared when the tab closes). Every API request includes:

```
X-Security: {security key}
X-App-Name: am-panel
X-Operator-Key: {operator key}
```

If any API call returns 401/403, credentials are cleared and the user is redirected to login.

## Testing

### Unit Tests (25 tests)

Component and utility tests using Vitest + Testing Library.

```bash
npm test
```

### Playwright E2E Tests (63 tests)

Full-stack browser tests covering login, token management, import workflows, app management, settings, and error paths. The test suite:

- Builds and starts a real backend on port 3100 (via `global-setup.ts`)
- Syncs a test database schema from backend entities
- Seeds test data before running
- Runs in headless Chromium

```bash
# Requires PostgreSQL and DATABASE_TEST_URL configured in ambackend/.env
npm run test:e2e
```

## Deployment

The panel is a static SPA. In production, it is served by the backend via `@nestjs/serve-static` -- both panel and API run from the same container on the same origin. No CORS configuration needed.

```bash
# Build and copy to backend's public/ directory
npm run push

# Or build via Docker (from project root)
docker build -t accessman .
```

See the root [README.md](../README.md) for Docker and deployment details.
