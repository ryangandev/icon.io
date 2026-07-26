<p align="center">
    <img alt="Icon.io Logo" src="https://github.com/ryangandev/icon.io/blob/main/front/public/favicon.ico" height="auto" width="200">
</p>

<h1 align="center">Icon.io [Backend]</h1>

## ✨ Technology Stack

-   **Node.js 20+** (ESM)
-   **TypeScript 7**
-   **Express 5**
-   **Socket.io**

## 🛠️ Set Up - Development

-   If you are currently in the root directory, navigate to the `back` directory:

    ```zsh
    cd back
    ```

-   Install the dependencies for the backend:

    ```zsh
    npm install
    ```

-   Compile the server:

    ```zsh
    npm run build
    ```

-   Start the server:

    ```zsh
    npm run start:dev
    ```

-   Or compile and restart automatically on every change:

    ```zsh
    npm run watch
    ```

-   The above steps start the server on port 3000. You will also need to start the frontend in another terminal to use the application. Refer to the [Front README](https://github.com/ryangandev/icon.io/blob/main/front/README.md) for instructions on how to start the frontend.

-   If both the frontend and backend are running, you can access the application at `http://localhost:3001`.

## 📜 Scripts

| Script                | What it does                                                       |
| --------------------- | ------------------------------------------------------------------ |
| `npm run build`       | Clean `build/` and compile TypeScript                              |
| `npm run watch`       | Recompile and restart the dev server on change                     |
| `npm run start:dev`   | Run the compiled server in development mode                        |
| `npm run build:deploy`| Build the backend, then build the frontend into `build/public`      |
| `npm run start:prod`  | Run the compiled server in production mode                         |
| `npm run start:deploy`| Run the production server under PM2                                |
| `npm run typecheck`   | Run `tsc --noEmit`                                                 |

> **Build order matters.** `npm run build` wipes `build/`, including the frontend
> bundle in `build/public`. Always build the backend *before* the frontend —
> `build:deploy` does this for you.

## ⚙️ Environment Variables

| Variable      | Default                 | Purpose                                              |
| ------------- | ----------------------- | ---------------------------------------------------- |
| `PORT`        | `3000`                  | Port the HTTP + Socket.io server listens on          |
| `CORS_ORIGIN` | `http://localhost:3001` | Allowed origin for Socket.io in development          |
| `NODE_ENV`    | –                       | `production` serves the built SPA from `build/public` |

## 🛠️ Set Up - Deployment

-   If you want to deploy the application, the setup is a bit different. Refer to the [Root README](https://github.com/ryangandev/icon.io/blob/main/README.md)
