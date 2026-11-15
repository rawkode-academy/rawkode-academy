/** Explicit API surface exposed to mobile bearer sessions. */
const mobileMethods: Record<string, readonly string[]> = {
  '/api/games/kubele/stats': ['GET', 'POST'],
  '/api/games/cnicon/rounds': ['GET'],
  '/api/games/cnicon/status': ['GET'],
  '/api/games/cnicon/stats': ['GET'],
  '/api/games/cnicon/leaderboard': ['GET'],
  '/api/games/cnicon/achievements': ['GET'],
  '/api/games/cnicon/score': ['POST'],
};

export function isMobileGamePath(path: string): boolean {
  return Object.hasOwn(mobileMethods, path);
}

export function isMobileGameMethodAllowed(path: string, method: string): boolean {
  return Object.hasOwn(mobileMethods, path) && (mobileMethods[path]?.includes(method) ?? false);
}
