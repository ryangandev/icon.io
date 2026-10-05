<p align="center">
    <img alt="Zumpo Logo" src="public/favicon.svg" height="auto" width="200">
</p>

<h1 align="center">Zumpo [Frontend]</h1>

## ✨ Technology Stack

- **React 19**
- **TypeScript 7**
- **Vite 8** (build tool)
- **The Zumpo design system** in `src/ui/`, on **Base UI** headless primitives and CSS Modules
- **React Router 8**
- **Socket.io**
- **oxlint** (linter)

## 🛠️ Set Up - Development

- If you are currently in the root directory, navigate to the `front` directory:

  ```zsh
  cd front
  ```

- Install the dependencies for the frontend:

  ```zsh
  npm install
  ```

- Start the development server:

  ```zsh
  npm run dev
  ```

- The above steps will start the Vite dev server on port 3001. You will also need to start the backend to connect to the server in another terminal. Refer to the [Backend README](../server/README.md) for instructions on how to start the backend.

- If both the frontend and backend are running, you can access the application at `http://localhost:3001`.

- The Zumpo design system gallery is at `http://localhost:3001/design` while the dev server runs; it needs no backend.

## 📜 Scripts

| Script              | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server on port 3001 (`npm start` is an alias)    |
| `npm run build`     | Typecheck, then build straight into `../server/build/public`        |
| `npm run preview`   | Serve the production build locally                                  |
| `npm run typecheck` | Run `tsc --noEmit`                                                  |
| `npm test`          | Run the Vitest suite once (`npm run test:watch` to keep it running) |

Linting and formatting run from the repository root (`npm run lint`, `npm run format`), over both apps.

## ⚙️ Environment Variables

Vite exposes variables prefixed with `VITE_` via `import.meta.env`.

| Variable          | Default                 | Purpose                                                                                                                          |
| ----------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SOCKET_URL` | `http://localhost:3000` | Backend Socket.io origin in development. Ignored in production builds, where the client connects to the origin serving the page. |

Create a `.env.local` in `client/` to override it.

## 🛠️ Set Up - Deployment

- If you want to deploy the application, the setup is a bit different. Refer to the [Root README](../README.md)
