import { createZumpoServer } from './app.js';

const port = process.env.PORT || 3000;

/** The most a shutdown may take before the process exits regardless. */
const SHUTDOWN_DEADLINE_MS = 5000;

const zumpo = createZumpoServer();

zumpo.httpServer.listen(port, () => {
  console.log(`✅ Listening on port ${port}`);
});

/**
 * The host stops the process with SIGTERM on every deploy and restart (and
 * `tsc-watch` does on every rebuild). Closing properly tells every room page
 * why its room ended, which an exit without a word leaves it to discover.
 */
const shutDown = (signal: NodeJS.Signals) => {
  console.log(`${signal}: closing every room and connection.`);
  setTimeout(() => process.exit(1), SHUTDOWN_DEADLINE_MS).unref();
  void zumpo.close().then(() => process.exit(0));
};

process.once('SIGTERM', shutDown);
process.once('SIGINT', shutDown);
