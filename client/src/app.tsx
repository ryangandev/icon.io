import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  ScrollRestoration,
  useParams,
  type RouteObject,
} from 'react-router';
import { isGameType } from './games/catalog';
import { SessionProvider } from './net/session';
import CreateRoomPage from './pages/create-room';
import GamesPage from './pages/games';
import HomePage from './pages/home';
import HowToPlayPage from './pages/how-to-play';
import LobbyPage from './pages/lobby';
import NotFoundPage from './pages/not-found';
import RoomPage from './room/room-page';
import SoloPage from './solo/solo-page';

// The design system gallery, for development only: the build drops it.
const DesignGallery = import.meta.env.DEV
  ? lazy(() => import('./ui/gallery/gallery'))
  : null;

function Root() {
  return (
    <div className="zumpo">
      <Outlet />
      <ScrollRestoration />
    </div>
  );
}

/** A page under /games/:game, for a game that exists. */
function GamePage({
  page: Page,
}: {
  page: typeof LobbyPage | typeof CreateRoomPage | typeof SoloPage;
}) {
  const { game } = useParams();
  if (!isGameType(game)) return <NotFoundPage />;
  return <Page key={game} gameType={game} />;
}

function GameRoomPage() {
  const { game, roomId } = useParams();
  if (!isGameType(game) || !roomId) return <NotFoundPage />;
  return <RoomPage key={roomId} gameType={game} roomId={roomId} />;
}

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/how-to-play', element: <HowToPlayPage /> },
      { path: '/games', element: <GamesPage /> },
      { path: '/games/:game', element: <GamePage page={LobbyPage} /> },
      { path: '/games/:game/new', element: <GamePage page={CreateRoomPage} /> },
      { path: '/games/:game/solo', element: <GamePage page={SoloPage} /> },
      { path: '/games/:game/rooms/:roomId', element: <GameRoomPage /> },
      ...(DesignGallery
        ? [
            {
              path: '/design',
              element: (
                <Suspense>
                  <DesignGallery />
                </Suspense>
              ),
            },
          ]
        : []),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  );
}
