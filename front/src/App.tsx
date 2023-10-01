import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Landing from './pages/Landing';
import Home from './pages/Home';
import LobbyPage from './pages/LobbyPage';
import RoomPage from './pages/RoomPage';
import NotFound from './pages/NotFound';
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
                        <Route path="/Lobby" element={<LobbyPage />} />
                        <Route path="/Room/:roomId" element={<RoomPage />} />
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </Router>
        </SocketProvider>
    );
}
