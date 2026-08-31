# HW Landing

The front gate for the Howling Whispers ecosystem.

## Current prototype

The `dev` branch contains the first gated landing experience:

- animated Howling Whispers wolf emblem
- dark celestial/copper theme
- cursor aura, particles and ripple field
- Discord OAuth gate framed as "Prove Yourself Worthy"
- role-based access tiers for Stable, Early Access, Closed Alpha and developer access
- post-auth reveal into the project world
- responsive layout and reduced-motion support

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

The Vite client runs on port `5173` and proxies `/api` and `/auth` to the Node gate server on port `8787`.

## Discord setup

Create a Discord OAuth2 application and add this redirect while developing:

`http://localhost:8787/auth/discord/callback`

Fill in `.env` with the client ID, client secret, guild ID and the Discord role IDs that should unlock each access tier.

Never commit `.env` or the Discord client secret.

## Production

```bash
npm run build
npm start
```

The Node server serves the built `dist` directory and handles Discord authentication.

## Access model

- **Stable**: authenticated members
- **Early Access**: Discord roles listed in `DISCORD_EA_ROLE_IDS`
- **Closed Alpha**: Discord roles listed in `DISCORD_ALPHA_ROLE_IDS`
- **Developer**: Discord roles listed in `DISCORD_DEV_ROLE_IDS`, which unlock every project

The actual project URLs and role mapping are still prototype data and should be finalized before the first deployment.
