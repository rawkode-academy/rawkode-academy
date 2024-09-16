import {
  TypeScriptProject,
  TypeScriptProjectOptions,
} from 'projen/lib/typescript';

export interface Options extends TypeScriptProjectOptions {}

export class GrafbaseTursoService extends TypeScriptProject {
  constructor(options: Options) {
    super(options);
  }
}
