<p align="center">
    <img alt="Zumpo Logo" src="../client/public/favicon.svg" height="auto" width="200">
</p>

<h1 align="center">Zumpo [Backend]</h1>

## ✨ Technology Stack

- **Node.js 22.12+** (ESM)
- **TypeScript 7**
- **Express 5**
- **Socket.io**

## 🛠️ Set Up - Development

- If you are currently in the root directory, navigate to the `back` directory:

  ```zsh
  cd back
  ```

- Install the dependencies for the backend:

  ```zsh
  npm install
  ```

- Compile the server:

  ```zsh
  npm run build
  ```

- Start the server:

  ```zsh
  npm run start:dev
  ```

- Or compile and restart automatically on every change:

  ```zsh
  npm run watch
  ```

- The above steps start the server on port 3000. You will also need to start the frontend in another terminal to use the application. Refer to the [Front README](../client/README.md) for instructions on how to start the frontend.

- If both the frontend and backend are running, you can access the application at `http://localhost:3001`.

## 📜 Scripts

| Script                 | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run build`        | Empty `build/` and compile TypeScript                          |
| `npm run watch`        | Recompile and restart the dev server on change                 |
| `npm run start:dev`    | Run the compiled server in development mode                    |
| `npm run build:deploy` | Build the backend, then build the frontend into `build/public` |
| `npm run start:prod`   | Run the compiled server in production mode                     |
| `npm run start:deploy` | Run the production server under PM2                            |
| `npm run typecheck`    | Run `tsc --noEmit`                                             |

> **Build order matters.** `npm run build` empties `build/`, including the frontend
> bundle in `build/public`. Always build the backend _before_ the frontend -
> `build:deploy` does this for you.

## ⚙️ Environment Variables

| Variable      | Default                 | Purpose                                               |
| ------------- | ----------------------- | ----------------------------------------------------- |
| `PORT`        | `3000`                  | Port the HTTP + Socket.io server listens on           |
| `CORS_ORIGIN` | `http://localhost:3001` | Allowed origin for Socket.io in development           |
| `NODE_ENV`    | –                       | `production` serves the built SPA from `build/public` |

The server owns the game clock, so the phase lengths are server-side settings.
Shorten them to play through a whole game quickly while developing:

| Variable                     | Default | Purpose                                    |
| ---------------------------- | ------- | ------------------------------------------ |
| `WORD_SELECT_SECONDS`        | `15`    | How long the drawer has to pick a word     |
| `DRAWING_SECONDS`            | `90`    | Length of the drawing phase                |
| `REVIEW_SECONDS`             | `10`    | How long the word is shown after a turn    |
| `DRAWER_HOLD_SECONDS`        | `10`    | How long a turn waits for a dropped drawer |
| `MINESWEEPER_ROUND_SECONDS`  | `15`    | How long everybody has to pick a cell      |
| `MINESWEEPER_REVEAL_SECONDS` | `4`     | How long a round's outcome stays up        |
| `MAKE24_HAND_SECONDS`        | `60`    | How long everybody has to solve a hand     |
| `MAKE24_REVEAL_SECONDS`      | `5`     | How long a hand's results stay up          |
| `RECONNECT_GRACE_SECONDS`    | `30`    | How long a dropped player keeps their seat |

## 🛠️ Set Up - Deployment

- If you want to deploy the application, the setup is a bit different. Refer to the [Root README](../README.md)
