# KaamSathi web

Next.js 15 (App Router) employer portal (`/app`), ops console (`/ops`) and marketing site (`/`).

The browser never talks to the Django API directly: auth route handlers under `app/api/auth/*`
keep JWTs in httpOnly cookies, and `app/api/proxy/[...path]` forwards API calls with the
`Authorization` and `X-Org-Id` headers attached.

```bash
cp .env.example .env.local   # API_BASE_URL defaults to http://localhost:8000/api/v1
pnpm install
pnpm dev                     # http://localhost:3000
```

| Command | What |
| --- | --- |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | checks |
| `pnpm messages` | rebuild `messages/{en,ne}.json` from `messages/src/<area>.<locale>.json` |
| `pnpm messages:check` | CI: generated files up to date and en/ne keys match |

Every UI string lives in both English and Nepali; see `../docs/GLOSSARY.md` for terms.
