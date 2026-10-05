# Zumpo client

The React SPA: the platform pages, each game's room and solo views, and the Zumpo design system in `src/ui/`.
How it works is in [docs/architecture.md](../docs/architecture.md#client); run it from the repository root with `npm run dev` (see the [root README](../README.md)).

## Stack

React 19, TypeScript 7, Vite 8, React Router 8 and Socket.IO, with the Zumpo design system built on [Base UI](https://base-ui.com) headless primitives and CSS Modules.

## Scripts

Run from the repository root as `npm run <script> -w client`.

| Script      | What it does                                                 |
| ----------- | ------------------------------------------------------------ |
| `dev`       | The Vite dev server on port 3001, with the `/design` gallery |
| `build`     | Typecheck, then build straight into `../server/build/public` |
| `typecheck` | `tsc --noEmit`                                               |
| `test`      | The Vitest suite once (`test:watch` keeps it running)        |

## Environment variables

Vite exposes variables prefixed with `VITE_` through `import.meta.env`; put overrides in `client/.env.local`.

| Variable          | Default                 | Purpose                                                                                                 |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `VITE_SOCKET_URL` | `http://localhost:3000` | The server's Socket.IO origin in development. Production builds connect to the origin serving the page. |
