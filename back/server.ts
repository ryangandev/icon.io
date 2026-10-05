import { createZumpoServer } from './app.js';

const port = process.env.PORT || 3000;

const { httpServer } = createZumpoServer();

httpServer.listen(port, () => {
  console.log(`✅ Listening on port ${port}`);
});
