import { plural } from './plural';

export const lobby = {
  playTogether: 'Play together',
  findRoom: 'Find your room.',
  title: (game: string) => `${game} rooms`,
  subtitle: 'Join a room or make one for your friends.',
  rooms: 'Rooms',
  count: (count: number) => plural(count, 'room'),
  liveCount: (count: number) => `${plural(count, 'room')} · Updates live`,
  playingAs: (name: string) => `Playing as ${name}`,
  hostedBy: (name: string, setting: string) => `Hosted by ${name} · ${setting}`,
  createRoom: 'Create a room',
  emptyTitle: 'A little quiet in here.',
  emptyDescription:
    'Be the first to make a room. Bring a friend and get playing.',
  createFirstRoom: 'Create the first room',
  loadingTitle: 'Finding your people…',
  loadingDescription: 'Connecting to the room list.',
};
