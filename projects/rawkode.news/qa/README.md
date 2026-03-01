# Headless QA

Run automated visual and accessibility QA scoped to this repository.

## Command

```bash
bun run qa:headless
```

## What it does

- Reuses an already-running server at `QA_BASE_URL` when detected
- Starts the local dev server only if no server is reachable (unless `QA_NO_SERVER=1`)
- Scans key routes in light and dark themes
- Captures screenshots at desktop, tablet, and mobile sizes
- Runs axe-core WCAG A/AA checks
- Records keyboard focus sampling

## Output

Generated artifacts are written to `qa/results/`:

- `report.md` summary report
- `results.json` raw scan data
- `screenshots/*.png` route/theme/viewport snapshots
- `dev-server.log` local server log for the run

## Environment Variables

- `QA_BASE_URL` (default `http://localhost:4321`)
- `QA_NO_SERVER=1` to force using an existing server only (never starts local dev server)
