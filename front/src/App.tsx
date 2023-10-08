import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './layout';
import Landing from './pages/landing-page';
import Gamehub from './pages/gamehub-page';
import DrawAndGuessLobby from './pages/lobbies/draw-and-guess-lobby';
import DrawAndGuessRoom from './pages/rooms/draw-and-guess-room';
import NotFound from './pages/not-found-page';
import { SocketProvider } from './providers/socket-provider';
import ValidateAuth from './components/validate-auth';
import RequireSocket from './components/require-socket';

export default function App() {
    return (
        <SocketProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        {/* Page Components */}
                        <Route index element={<Landing />} />
                        <Route path="/Landing" element={<Landing />} />

                        <Route element={<ValidateAuth />}>
                            <Route path="/Gamehub" element={<Gamehub />} />
                            <Route element={<RequireSocket />}>
                                <Route
                                    path="/Gamehub/DrawAndGuess/Lobby"
                                    element={<DrawAndGuessLobby />}
                                />
                                <Route
                                    path="/Gamehub/DrawAndGuess/Room/:roomId"
                                    element={<DrawAndGuessRoom />}
                                />
                            </Route>
                        </Route>
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </Router>
        </SocketProvider>
    );
}
