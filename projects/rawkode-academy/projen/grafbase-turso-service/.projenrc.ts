import { cdk } from 'projen';

const project = new cdk.JsiiProject({
  name: '@rawkodeacademy/projen-grafbase-turso-service',
  releaseTagPrefix: 'projen/grafbase-turso-service/',
  description:
    'A service using Turso database with Grafbase for the GraphQL API',
  repositoryUrl: 'https://github.com/RawkodeAcademy/RawkodeAcademy',
  npmRegistryUrl: 'https://npm.pkg.github.com',
  github: false,
  jsiiVersion: '^5.3.0',
  author: 'David Flanagan',
  authorAddress: 'david@rawkode.dev',
  defaultReleaseBranch: 'main',
  projenrcTs: true,
  peerDeps: ['constructs', 'projen'],
});

project.synth();
