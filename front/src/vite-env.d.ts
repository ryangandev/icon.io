/// <reference types="vite/client" />

interface ImportMetaEnv {
    /**
     * Origin of the Socket.io backend during development.
     * In production the client connects to the origin that served the app,
     * because the Express server hosts both the API and the static bundle.
     */
    readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
