import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components//Header';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import RoomPage from './pages/RoomPage';
import NotFound from './pages/NotFound';
import './styles/App.css';

export default function App() {

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Header />} >
                    <Route index element={<LandingPage />} />
                    <Route path="/Landing" element={<LandingPage />} />
                    <Route path="/Home" element={<HomePage />} />
                    <Route path="/Lobby" element={<LobbyPage />} />
                    {/* Maybe add ? to make this optional? */}
                    <Route path="/Room/:roomId" element={<RoomPage />} />
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </Router>
    );
}