# HW Landing

The front gate for the Howling Whispers ecosystem.

## v0.3 prototype

The `dev` branch is the cinematic gated landing experience:

- animated Howling Whispers wolf emblem with pointer-reactive metal highlight
- celestial copper theme, pointer aura, drifting particles and ripple wake
- real image-fragment shatter transition after successful authentication
- Discord gate framed as **Prove Yourself Worthy**
- shared Discord SSO with the existing Coda Admin authentication authority
- hierarchical access seals for Stable, Closed Beta, Closed Alpha and Developer
- post-auth world reveal with locked and unlocked project paths
- responsive layout, reduced-motion support and safer DOM rendering
- security headers, health endpoint and runtime server smoke test
- access-tier and shared-SSO unit tests plus TypeScript checks and production build verification

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

The Vite client runs on port `5173` and proxies `/api` and `/auth` to the Node gate server on port `8787`.

### Preview the gate without SSO

While Vite is running in development mode, these local-only preview seals can exercise the full wolf-shatter and world reveal:

- `http://localhost:5173/?preview=stable`
- `http://localhost:5173/?preview=beta`
- `http://localhost:5173/?preview=alpha`
- `http://localhost:5173/?preview=dev`

Vite compiles this preview path out of production behavior because it is guarded by `import.meta.env.DEV`.

## Shared Discord SSO

HW Landing does not own a second Discord client secret or a second OAuth callback. It delegates sign-in to the existing Coda Admin Discord OAuth authority at `admin.thehowlingwhispers.com`.

The existing Coda session cookie is scoped to `.thehowlingwhispers.com`. After Coda authenticates the user, the browser returns to the apex landing site and HW Landing asks Coda server-to-server for the current signed-in identity, guild membership and that member's own Discord role IDs.

This keeps the proven OAuth implementation, CSRF state handling and session store in one place.

Required production values:

```env
CODA_AUTH_BASE_URL=https://admin.thehowlingwhispers.com
PUBLIC_BASE_URL=https://thehowlingwhispers.com
CODA_COOKIE_DOMAIN=.thehowlingwhispers.com
```

Coda Admin must allow `https://thehowlingwhispers.com` in `CODA_OAUTH_RETURN_URLS` and expose `/api/coda/auth/landing`.

### Access hierarchy

- **Stable**: every authenticated member of the configured Howling Whispers Discord guild
- **Closed Beta**: roles listed in `DISCORD_BETA_ROLE_IDS` or the legacy `DISCORD_EA_ROLE_IDS`
- **Closed Alpha**: roles listed in `DISCORD_ALPHA_ROLE_IDS`; Alpha automatically inherits Beta access
- **Developer**: roles listed in `DISCORD_DEV_ROLE_IDS`; Developer unlocks every project

The landing server receives role IDs from Coda only after the shared session is validated. Discord secrets remain in Coda Admin.

## Production

```bash
npm run check
npm run build
NODE_ENV=production npm start
```

`npm run check` performs typechecking, unit tests, server syntax validation, the Vite build and a real `/api/health` startup smoke test.

The Node server serves the built `dist` directory and brokers the landing session through Coda SSO. No landing-specific Discord client secret is required.

The health endpoint is available at `/api/health` for deployment checks.

## Important security boundary

The landing page decides which project links a user can see, but hiding a link is **not** sufficient protection for a Closed Alpha or Closed Beta project. Any gated project must also enforce access at its own server, reverse proxy, or shared authorization layer before a real closed-test URL is connected here.

That second layer will be designed before any protected project is exposed through the hub.
