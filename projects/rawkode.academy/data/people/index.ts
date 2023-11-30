/**
 * Why do we only store the GitHub handle?
 *
 * This collection is merely some glue between the Supabase auth systems
 * and our people collection. We need the handles to associate people that haven't signed
 * up to the website with other collections (episodes, mostly as guests).
 *
 * When someone signs up for the first time, we sync the rest of the field; and we don't want any syncs
 * from this script to overwrite those values.
 */
export enum githubHandles {
  rawkode,
  bketelsen,
};
