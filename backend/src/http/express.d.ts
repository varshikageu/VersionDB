import type { GlobalRole } from '../domain/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      auth?: { userId: string; globalRole: GlobalRole };
    }
  }
}
export {};
