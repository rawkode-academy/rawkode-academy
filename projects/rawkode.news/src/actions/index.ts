import { newsIngestActions } from "./news-ingest";
import { postActions } from "./posts";
import { tagActions } from "./tags";

export const server = {
  ...postActions,
  ...tagActions,
  ...newsIngestActions,
};
