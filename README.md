<p align="center">
    <img alt="Zumpo Logo" src="front/public/favicon.svg" height="auto" width="200">
</p>

<h1 align="center">Zumpo</h1>

## 🚀 About

**Zumpo** is a home for little browser games, alone or together, built with React and Node.js in TypeScript.
It hosts Draw & Guess, Minesweeper, Make 24 and Pairs: play on your own straight away, or open a room and send your friends the link.
Every game is short, easy to start and easy to share, and more are on the way.

Zumpo began as [**Icon**](https://github.com/ryangandev/zumpo/tree/old-version), my final project for a Web Development class at Drexel University, built in a team of three.

## 🧱 Stack

| Layer    | Tech                                                   |
| -------- | ------------------------------------------------------ |
| Frontend | React 19 · TypeScript 7 · Vite 8 · Base UI · Socket.io |
| Backend  | Node.js 22.12+ · TypeScript 7 · Express 5 · Socket.io  |

## 🎮 Games

| Game                                         | Players     | What it is                                                     |
| -------------------------------------------- | ----------- | -------------------------------------------------------------- |
| [Draw & Guess](docs/games/draw-and-guess.md) | 2–8         | One player draws a word, everyone else races to type it        |
| [Minesweeper](docs/games/minesweeper.md)     | Solo or 2–8 | Classic on your own; together, a shared board picked in secret |
| [Make 24](docs/games/make-24.md)             | Solo or 2–8 | Four numbers and plus, minus, times, divide: make 24           |
| [Pairs](docs/games/pairs.md)                 | Solo or 2–6 | Flip two cards, remember where everything is, find every pair  |

Each game is a module on a shared room layer that owns seats, ownership, the
reconnect grace and the lobby. See [`docs/README.md`](docs/README.md) for the
architecture, current status, known issues, and the roadmap.

## ✅ Checks

The two applications keep their own dependencies, but linting, type-checking, tests and the build all run from the repository root:

```zsh
npm ci && npm run install:all
npm run verify
```

`verify` is lint → typecheck → format check → design token check → test → build, which is exactly what CI runs on every pull request. The individual steps are `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run design:tokens -- --check`, `npm test` and `npm run build`.

Linting and formatting are root-level commands with one shared config each, [`.oxlintrc.json`](.oxlintrc.json) and [`.prettierrc.json`](.prettierrc.json), covering both packages. `npm run format` rewrites; CI runs `npm run format:check`.

## 🛠️ How To Run - Development

Zumpo is built using React for the frontend and Node.js for the backend, each located within its respective directory: `front` and `back`. To run the app in development, follow the instructions provided below.

### Frontend

- For frontend setup, follow the instructions in the [Front README](front/README.md).

### Backend

- For backend setup, follow the instructions in the [Back README](back/README.md).

## 🛠️ How To Run - Deployment

Follow the steps below to create and deploy a production build of the application:

### 1. Installing Dependencies

Ensure you install dependencies for both the frontend and backend:

**Frontend**:

```zsh
cd front
npm install
```

**Backend**:

```zsh
cd back
npm install
```

### 2. Building for Production

Execute the commands below to create a production-ready build for both the frontend and backend:

```zsh
cd back
npm run build:deploy
```

This command will generate a combined build in a folder named `build` within the `back` directory:

- The React frontend will be located in `build/public`.
- These frontend assets will be served as static files by the backend.

### 3. Starting the Application

There are two options to start your application:

- **Using PM2** (recommended for background running):

  If you have PM2 installed:

  ```zsh
  npm run start:deploy
  ```

  This will start the application on port 3000 and keep it running in the background.

- **Without PM2**:

  If you don't have PM2 or prefer not to use it:

  ```zsh
  npm run start:prod
  ```

### 4. Accessing the Application

Once the application is running, you can access it at:

```
http://localhost:3000
```

## 🗃️ Old Version

If you are interested in the original Icon, you can find it in the [old-version](https://github.com/ryangandev/zumpo/blob/old-version/README.md) branch.

## 📝 License

This project is [MIT](LICENSE) licensed.
