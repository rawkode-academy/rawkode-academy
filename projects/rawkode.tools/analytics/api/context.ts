import type { YogaInitialContext } from 'graphql-yoga';
import type { Context, Env } from './types';

export function createContext(
  initialContext: YogaInitialContext & { env: Env; executionContext: ExecutionContext },
): Context {
  return {
    env: initialContext.env,
    executionContext: initialContext.executionContext,
  };
}
