import * as migration_20261004_153744 from './20261004_153744';
import * as migration_20261004_154006 from './20261004_154006';
import * as migration_20261004_154154 from './20261004_154154';
import * as migration_20261004_154336 from './20261004_154336';
import * as migration_20261004_161607_oidc from './20261004_161607_oidc';

export const migrations = [
  {
    up: migration_20261004_153744.up,
    down: migration_20261004_153744.down,
    name: '20261004_153744',
  },
  {
    up: migration_20261004_154006.up,
    down: migration_20261004_154006.down,
    name: '20261004_154006',
  },
  {
    up: migration_20261004_154154.up,
    down: migration_20261004_154154.down,
    name: '20261004_154154',
  },
  {
    up: migration_20261004_154336.up,
    down: migration_20261004_154336.down,
    name: '20261004_154336',
  },
  {
    up: migration_20261004_161607_oidc.up,
    down: migration_20261004_161607_oidc.down,
    name: '20261004_161607_oidc'
  },
];
