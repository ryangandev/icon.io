import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './layout';
import Landing from './pages/landing-page';
import Home from './pages/home-page';
import DrawAndGuessLobby from './pages/lobbies/draw-and-guess-lobby';
import DrawAndGuessRoom from './pages/rooms/draw-and-guess-room';
import NotFound from './pages/not-found-page';
import { SocketProvider } from './providers/socket-provider';

export default function App() {
    return (
        <SocketProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        {/* Page Components */}
                        <Route index element={<Landing />} />
                        <Route path="/Landing" element={<Landing />} />
                        <Route path="/Home" element={<Home />} />
                        <Route path="/Lobby" element={<DrawAndGuessLobby />} />
                        <Route
                            path="/Room/:roomId"
                            element={<DrawAndGuessRoom />}
                        />
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </Router>
        </SocketProvider>
    );
}
