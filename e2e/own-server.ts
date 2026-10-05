import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

/**
 * A server of a test's own on `port`, beside the one every other test shares,
 * started from the production build as the host does; resolves once it
 * listens.
 */
export async function startServer(port: number): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['server/build/server/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    child.once('exit', (code) => reject(new Error(`server exited: ${code}`)));
    child.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Listening on port')) resolve();
    });
  });
  return child;
}
