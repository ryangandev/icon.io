import { createIconIoServer } from './app.js';

const port = process.env.PORT || 3000;

const { httpServer } = createIconIoServer();

httpServer.listen(port, () => {
  console.log(`✅ Listening on port ${port}`);
});
