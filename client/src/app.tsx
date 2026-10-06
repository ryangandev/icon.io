import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  ScrollRestoration,
  useParams,
  type RouteObject,
} from 'react-router';
import { isGameType } from './games/catalog';
import { SessionProvider } from './net/session';
import CreateRoomPage from './pages/create-room';
import HomePage from './pages/home';
import HowToPlayPage from './pages/how-to-play';
import LobbyPage from './pages/lobby';
import NamePage from './pages/name';
import NotFoundPage from './pages/not-found';
import RoomPage from './room/room-page';
import SoloPage from './solo/solo-page';
import { RequireName } from './shell/require-name';

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
      { path: '/name', element: <NamePage /> },
      { path: '/how-to-play', element: <HowToPlayPage /> },
      // Every game is on the home page; old links to the games page land there.
      { path: '/games', element: <Navigate to="/" replace /> },
      // A game on your own needs no name.
      { path: '/games/:game/solo', element: <GamePage page={SoloPage} /> },
      {
        element: <RequireName />,
        children: [
          { path: '/games/:game', element: <GamePage page={LobbyPage} /> },
          {
            path: '/games/:game/new',
            element: <GamePage page={CreateRoomPage} />,
          },
          { path: '/games/:game/rooms/:roomId', element: <GameRoomPage /> },
        ],
      },
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
