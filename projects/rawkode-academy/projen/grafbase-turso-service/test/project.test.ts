import { synthSnapshot } from 'projen/lib/util/synth';
import { GrafbaseTursoService } from '../src';

describe('GrafbaseTursoService', () => {
  test('project name is set properly', () => {
    // GIVEN
    const project = new GrafbaseTursoService({
      name: 'my-microservice',
      defaultReleaseBranch: 'main',
    });

    // WHEN
    const snapshot = synthSnapshot(project);

    // THEN
    expect(snapshot['package.json']!.name).toBe('my-microservice');
  });
});
