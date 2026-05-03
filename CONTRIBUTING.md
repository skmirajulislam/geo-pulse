# Contributing to World Monitor

Thanks for contributing.

## Prerequisites

- Node.js 20+
- npm 9+
- Git
- MongoDB + Redis (for full backend behavior)

## Local setup

1. Clone and enter the repo:

   ```bash
   git clone <repo-url>
   cd World-Monitor
   ```

2. Create env files:
   - `backend/.env` (from `backend/.env.example`)
   - `frontend/.env` (from `frontend/.env.example`)
3. Start both apps:
   - macOS/Linux: `./activation.sh`
   - Windows PowerShell: `.\activation.ps1`

The activation scripts install missing dependencies (when internet is available), run frontend/backend on separate ports, and stop both cleanly on exit.

## Development workflow

1. Create a feature branch:

   ```bash
   git checkout -b feature/your-change
   ```

2. Make focused changes.
3. Validate before commit:

   ```bash
   cd backend && npm start
   cd ../frontend && npm run build
   ```

4. Commit with a clear message and open a PR.

## Docker (backend)

From `backend/`:

```bash
npm run docker:build
npm run docker:run
```

## Pull request guidelines

- Keep PRs small and scoped.
- Include:
  - What changed
  - Why it changed
  - Screenshots for UI updates
  - Any env/config updates
- Link related issue(s) if available.

## Security and secrets

- **Never commit secrets** (`.env`, API keys, tokens).
- Use placeholders in example files only.
- Push protection is enabled; secret leaks will block pushes.
- If a secret is exposed, rotate/revoke it immediately.

## Dependency updates

- Dependabot is configured for scheduled updates.
- Review dependency PRs carefully and run local checks before merging.
