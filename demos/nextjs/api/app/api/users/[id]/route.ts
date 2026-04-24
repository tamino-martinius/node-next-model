import { createMemberHandlers, type MemberRouteContext } from '@next-model/nextjs-api';

import { dbReady, User } from '../../../../lib/models';

export const runtime = 'nodejs';

const handlers = createMemberHandlers(User, {
  authorize: ({ req }) => Boolean(req.headers.get('x-role')),
  actions: {
    delete: { authorize: ({ req }) => req.headers.get('x-role') === 'admin' },
    update: { authorize: ({ req }) => req.headers.get('x-role') === 'admin' },
  },
});

export const GET = async (req: Request, ctx: MemberRouteContext) => {
  await dbReady;
  return handlers.GET(req, ctx);
};

export const PATCH = async (req: Request, ctx: MemberRouteContext) => {
  await dbReady;
  return handlers.PATCH(req, ctx);
};

export const DELETE = async (req: Request, ctx: MemberRouteContext) => {
  await dbReady;
  return handlers.DELETE(req, ctx);
};
