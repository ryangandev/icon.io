import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as url from 'url';
import path from 'path';

const app = express();
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
console.log('directory nane', __dirname);

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3001',
    },
});

io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id);

    socket.on('disconnect', () => {
        console.log('client: ' + socket.id + ' disconnected');
    });
});

app.get('/', (req: Request, res: Response) => {
    res.send('Hello, welcome to Icon.io server!');
});

app.get('/*', function (req: Request, res: Response) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = 3000;
server.listen(port, () => {
    console.log(`✔️ Listening on port ${port}`);
});
