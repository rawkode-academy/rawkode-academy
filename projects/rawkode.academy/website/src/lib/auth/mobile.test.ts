import { describe, expect, it } from 'vitest';
import { isMobileGameMethodAllowed, isMobileGamePath } from './mobile';

describe('mobile bearer routes', () => {
  it('permits only intended reads and score submissions', () => {
    expect(isMobileGameMethodAllowed('/api/games/kubele/stats', 'GET')).toBe(true);
    expect(isMobileGameMethodAllowed('/api/games/kubele/stats', 'POST')).toBe(true);
    expect(isMobileGameMethodAllowed('/api/games/cnicon/score', 'POST')).toBe(true);
    expect(isMobileGameMethodAllowed('/api/games/cnicon/achievements', 'GET')).toBe(true);
    expect(isMobileGameMethodAllowed('/api/games/cnicon/achievements', 'POST')).toBe(false);
    expect(isMobileGameMethodAllowed('/api/games/cnicon/score', 'DELETE')).toBe(false);
  });
  it('does not match adjacent paths or object prototype names', () => {
    for (const path of ['/api/games/cnicon/score/extra', '/api/games/kubele/score', 'toString']) {
      expect(isMobileGamePath(path)).toBe(false);
      expect(isMobileGameMethodAllowed(path, 'GET')).toBe(false);
    }
  });
});
