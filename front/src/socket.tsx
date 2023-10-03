// import { createContext } from 'react';
import { io } from 'socket.io-client';

// "undefined" means the URL will be computed from the `window.location` object
const URL =
    process.env.NODE_ENV === 'production'
        ? 'undefined'
        : 'http://localhost:3000';

// https://stackoverflow.com/a/67270359
export const socket = io(URL, {
    autoConnect: false,
});
// const SocketContext = createContext<Socket>(socket);

// const SocketProvider = ({ children } :any) => {
//     return (
//         <SocketContext.Provider value={ socket }>{ children }</SocketContext.Provider>
//     );
// };
// export { SocketContext, SocketProvider };
