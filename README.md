# HW Landing

The front gate for the Howling Whispers ecosystem.

## v0.2 prototype

The `dev` branch is the cinematic gated landing experience:

- animated Howling Whispers wolf emblem with pointer-reactive metal highlight
- celestial copper theme, pointer aura, drifting particles and ripple wake
- real image-fragment shatter transition after successful authentication
- Discord OAuth gate framed as **Prove Yourself Worthy**
- hierarchical access seals for Stable, Closed Beta, Closed Alpha and Developer
- post-auth world reveal with locked and unlocked project paths
- responsive layout, reduced-motion support and safer DOM rendering
- basic security headers, persistent file-backed sessions and a health endpoint
- access-tier unit tests, TypeScript checks, production build and a runtime server smoke test

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

The Vite client runs on port `5173` and proxies `/api` and `/auth` to the Node gate server on port `8787`.

### Preview the gate before Discord is configured

While Vite is running in development mode, these local-only preview seals can exercise the full wolf-shatter and world reveal without bypassing production authentication:

- `http://localhost:5173/?preview=stable`
- `http://localhost:5173/?preview=beta`
- `http://localhost:5173/?preview=alpha`
- `http://localhost:5173/?preview=dev`

Vite compiles this preview path out of production behavior because it is guarded by `import.meta.env.DEV`.

## Discord setup

Create a Discord OAuth2 application and add this redirect while developing:

`http://localhost:8787/auth/discord/callback`

Fill in `.env` with the client ID, client secret, guild ID and the Discord role IDs that unlock each access tier.

Never commit `.env`, the Discord client secret, or the session secret.

### Access hierarchy

- **Stable**: every successfully authenticated Discord user
- **Closed Beta**: roles listed in `DISCORD_BETA_ROLE_IDS` or the legacy `DISCORD_EA_ROLE_IDS`
- **Closed Alpha**: roles listed in `DISCORD_ALPHA_ROLE_IDS`; Alpha automatically inherits Beta access
- **Developer**: roles listed in `DISCORD_DEV_ROLE_IDS`; Developer unlocks every project

Set `REQUIRE_GUILD_MEMBERSHIP=true` if passing the gate should also require membership in `DISCORD_GUILD_ID`.

Successful OAuth authentication regenerates the session before user/access data is stored.

## Production

```bash
npm run check
npm run build
NODE_ENV=production npm start
```

`npm run check` performs typechecking, unit tests, server syntax validation, the Vite build and a real `/api/health` startup smoke test.

`SESSION_SECRET` is mandatory in production. The Node server serves the built `dist` directory and handles Discord authentication.

The health endpoint is available at `/api/health` for deployment checks.

## Important security boundary

The landing page decides which project links a user can see, but hiding a link is **not** sufficient protection for a Closed Alpha or Closed Beta project. Any gated project must also enforce access at its own server, reverse proxy, or shared authorization layer before a real closed-test URL is connected here.

That second layer will be designed before any protected project is exposed through the hub.
