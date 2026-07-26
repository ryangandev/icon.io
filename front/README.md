<p align="center">
    <img alt="Icon.io Logo" src="https://github.com/ryangandev/icon.io/blob/main/front/public/favicon.ico" height="auto" width="200">
</p>

<h1 align="center">Icon.io [Frontend]</h1>

## ✨ Technology Stack

-   **React 19**
-   **TypeScript 7**
-   **Vite 8** (build tool)
-   **Ant Design 6**
-   **Socket.io**
-   **oxlint** (linter)

## 🛠️ Set Up - Development

-   If you are currently in the root directory, navigate to the `front` directory:

    ```zsh
    cd front
    ```

-   Install the dependencies for the frontend:

    ```zsh
    npm install
    ```

-   Start the development server:

    ```zsh
    npm run dev
    ```

-   The above steps will start the Vite dev server on port 3001. You will also need to start the backend to connect to the server in another terminal. Refer to the [Backend README](https://github.com/ryangandev/icon.io/blob/main/back/README.md) for instructions on how to start the backend.

-   If both the frontend and backend are running, you can access the application at `http://localhost:3001`.

## 📜 Scripts

| Script              | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server on port 3001 (`npm start` is an alias)     |
| `npm run build`     | Typecheck, then build straight into `../back/build/public`           |
| `npm run preview`   | Serve the production build locally                                   |
| `npm run typecheck` | Run `tsc --noEmit`                                                   |
| `npm run lint`      | Run oxlint                                                           |
| `npm run format`    | Format `src` with Prettier                                           |

## ⚙️ Environment Variables

Vite exposes variables prefixed with `VITE_` via `import.meta.env`.

| Variable          | Default                 | Purpose                                                                              |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `VITE_SOCKET_URL` | `http://localhost:3000` | Backend Socket.io origin in development. Ignored in production builds, where the client connects to the origin serving the page. |

Create a `.env.local` in `front/` to override it.

## 🛠️ Set Up - Deployment

-   If you want to deploy the application, the setup is a bit different. Refer to the [Root README](https://github.com/ryangandev/icon.io/blob/main/README.md)
