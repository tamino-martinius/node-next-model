import { createCollectionHandlers } from '@next-model/nextjs-api';

import { dbReady, User } from '../../../lib/models';

export const runtime = 'nodejs';

const handlers = createCollectionHandlers(User, {
  authorize: ({ req }) => Boolean(req.headers.get('x-role')),
  actions: {
    create: { authorize: ({ req }) => req.headers.get('x-role') === 'admin' },
  },
});

// Wait for the sqlite bootstrap before any request touches the DB.
export const GET = async (req: Request) => {
  await dbReady;
  return handlers.GET(req);
};

export const POST = async (req: Request) => {
  await dbReady;
  return handlers.POST(req);
};
