<p align="center">
    <img alt="Icon.io Logo" src="https://github.com/ryangandev/icon.io/blob/main/front/public/favicon.ico" height="auto" width="200">
</p>

<h1 align="center">Icon.io</h1>

## 🚀 About

Icon.io is a web-based, online multiplayer gaming platform developed using React and Node.js with TypeScript. It currently hosts Draw & Guess, which you can enjoy with your friends, and plans are underway to add more games soon!

Icon.io is an evolved version of my original project, [**Icon**](https://github.com/ryangandev/icon.io/tree/old-version), initially built as my final project for a Web Development class in a team of three at Drexel University. This refined version retains the same core technologies as the original, while incorporating bug fixes and adhering to best practices.

## 🛠️ How To Run - Development

### Prerequisites

Icon.io is built using React for the frontend and Node.js for the backend, each located within its respective directory: `front` and `back`. To get started, follow the instructions provided below.

### Frontend

-   For frontend setup, follow the instructions in the [Front README](https://github.com/ryangandev/icon.io/blob/main/front/README.md).

### Backend

-   For backend setup, follow the instructions in the [Back README](https://github.com/ryangandev/icon.io/blob/main/back/README.md).

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

-   The React frontend will be located in `build/public`.
-   These frontend assets will be served as static files by the backend.

### 3. Starting the Application

There are two options to start your application:

-   **Using PM2** (recommended for background running):

    If you have PM2 installed:

    ```zsh
    npm run start:deploy
    ```

    This will start the application on port 3000 and keep it running in the background.

-   **Without PM2**:

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

If you are interested in the old version of Icon.io, you can find it in the [old-version](https://github.com/ryangandev/icon.io/blob/old-version/README.md) branch.

## 📝 License

This project is [MIT](https://github.com/ryangandev/icon.io/blob/main/LICENSE) licensed.
