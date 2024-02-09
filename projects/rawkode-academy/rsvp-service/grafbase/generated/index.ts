// This is a generated file. It should not be edited manually.
//
// You can decide to commit this file or add it to your `.gitignore`.
//
// By convention, this module is imported as `@grafbase/generated`. To make this syntax possible,
// add a `paths` entry to your `tsconfig.json`.
//
//  "compilerOptions": {
//    "paths": {
//      "@grafbase/generated": ["./grafbase/generated"]
//    }
//  }

export type Schema = {
  'EventRSVPs': {
    __typename?: 'EventRSVPs';
    count: number;
    learnerIds: Array<string>;
  };
  'Query': {
    __typename?: 'Query';
    rsvpsForEvent?: Schema['EventRSVPs'];
  };
};

import { ResolverFn } from '@grafbase/sdk'

export type Resolver = {
  'Query.rsvpsForEvent': ResolverFn<Schema['Query'], { eventId: string,  }, Schema['EventRSVPs']>
}

