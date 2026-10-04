import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

/**
 * This migration intentionally uses ALTER TABLE only. D1 enforces foreign keys
 * for every statement and does not make a table-rebuild migration safe merely
 * because a local SQLite emulator accepts PRAGMA foreign_keys=OFF.
 *
 * The legacy relationship tables remain in place: Payload no longer reads them
 * for the singular changelog author field, but keeping them makes rollback lossless.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Preserve the complete changelog author relationship before adding the
  // singular editor-facing author field.
  await db.run(sql`UPDATE changelog SET source_data = json_set(CASE WHEN json_valid(source_data) THEN source_data ELSE '{}' END, '$.legacyAuthors', json(COALESCE((SELECT json_group_array(people_id) FROM (SELECT DISTINCT people_id FROM changelog_rels WHERE parent_id = changelog.id AND people_id IS NOT NULL ORDER BY "order", id)), '[]')));`)
  await db.run(sql`UPDATE _changelog_v SET version_source_data = json_set(CASE WHEN json_valid(version_source_data) THEN version_source_data ELSE '{}' END, '$.legacyAuthors', json(COALESCE((SELECT json_group_array(people_id) FROM (SELECT DISTINCT people_id FROM _changelog_v_rels WHERE parent_id = _changelog_v.id AND people_id IS NOT NULL ORDER BY "order", id)), '[]')));`)
  await db.run(sql`ALTER TABLE changelog ADD author_id integer REFERENCES people(id) ON UPDATE no action ON DELETE set null;`)
  await db.run(sql`UPDATE changelog SET author_id = (SELECT people_id FROM changelog_rels WHERE parent_id = changelog.id ORDER BY "order", id LIMIT 1);`)
  await db.run(sql`ALTER TABLE _changelog_v ADD version_author_id integer REFERENCES people(id) ON UPDATE no action ON DELETE set null;`)
  await db.run(sql`UPDATE _changelog_v SET version_author_id = (SELECT people_id FROM _changelog_v_rels WHERE parent_id = _changelog_v.id ORDER BY "order", id LIMIT 1);`)

  // Keep the original source identifier in provenance while exposing a real
  // Payload relationship to shows. The old columns are then removed without
  // replacing the parent tables, so all dependent FKs remain untouched.
  await db.run(sql`UPDATE seasons SET source_data = json_set(CASE WHEN json_valid(source_data) THEN source_data ELSE '{}' END, '$.showId', show_id) WHERE typeof(show_id) = 'text' AND show_id IS NOT NULL AND json_extract(source_data, '$.showId') IS NULL AND json_extract(source_data, '$.show_id') IS NULL;`)
  await db.run(sql`UPDATE _seasons_v SET version_source_data = json_set(CASE WHEN json_valid(version_source_data) THEN version_source_data ELSE '{}' END, '$.showId', version_show_id) WHERE typeof(version_show_id) = 'text' AND version_show_id IS NOT NULL AND json_extract(version_source_data, '$.showId') IS NULL AND json_extract(version_source_data, '$.show_id') IS NULL;`)
  await db.run(sql`DROP INDEX IF EXISTS seasons_show_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS seasonId_personSlug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS seasonId_userId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_seasonId_version_personSlug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_seasonId_version_userId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS seasonId_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_seasonId_version_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_competitorId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_competitorId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS teamId_competitorId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_competitorId_1_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_teamId_version_competitorId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_competitorId_1_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_seed_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_competitorId_2_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_teamId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_seed_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_competitorId_2_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_teamId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS matchId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_matchId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS showId_slug_idx;`)
  await db.run(sql`ALTER TABLE seasons RENAME COLUMN show_id TO legacy_show_id;`)
  await db.run(sql`ALTER TABLE seasons ADD show_id integer REFERENCES shows(id) ON UPDATE no action ON DELETE set null;`)
  await db.run(sql`UPDATE seasons SET show_id = COALESCE((SELECT id FROM shows WHERE shows.legacy_id = seasons.legacy_show_id LIMIT 1), (SELECT id FROM shows WHERE CAST(shows.id AS TEXT) = seasons.legacy_show_id LIMIT 1)) WHERE legacy_show_id IS NOT NULL;`)
  await db.run(sql`ALTER TABLE seasons DROP COLUMN legacy_show_id;`)
  await db.run(sql`CREATE INDEX seasons_show_idx ON seasons (show_id);`)
  await db.run(sql`CREATE UNIQUE INDEX showId_slug_idx ON seasons (show_id,slug);`)

  await db.run(sql`DROP INDEX IF EXISTS _seasons_v_version_version_show_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_showId_version_slug_idx;`)
  await db.run(sql`ALTER TABLE _seasons_v RENAME COLUMN version_show_id TO legacy_version_show_id;`)
  await db.run(sql`ALTER TABLE _seasons_v ADD version_show_id integer REFERENCES shows(id) ON UPDATE no action ON DELETE set null;`)
  await db.run(sql`UPDATE _seasons_v SET version_show_id = COALESCE((SELECT id FROM shows WHERE shows.legacy_id = _seasons_v.legacy_version_show_id LIMIT 1), (SELECT id FROM shows WHERE CAST(shows.id AS TEXT) = _seasons_v.legacy_version_show_id LIMIT 1)) WHERE legacy_version_show_id IS NOT NULL;`)
  await db.run(sql`ALTER TABLE _seasons_v DROP COLUMN legacy_version_show_id;`)
  await db.run(sql`CREATE INDEX _seasons_v_version_version_show_idx ON _seasons_v (version_show_id);`)
  await db.run(sql`CREATE INDEX version_showId_version_slug_idx ON _seasons_v (version_show_id,version_slug);`)
  await db.run(sql`CREATE UNIQUE INDEX seasonId_personSlug_idx ON competitors (season_id,person_slug);`)
  await db.run(sql`CREATE UNIQUE INDEX seasonId_userId_idx ON competitors (season_id,user_id);`)
  await db.run(sql`CREATE INDEX version_seasonId_version_personSlug_idx ON _competitors_v (version_season_id,version_person_slug);`)
  await db.run(sql`CREATE INDEX version_seasonId_version_userId_idx ON _competitors_v (version_season_id,version_user_id);`)
  await db.run(sql`CREATE UNIQUE INDEX seasonId_slug_idx ON brackets (season_id,slug);`)
  await db.run(sql`CREATE INDEX version_seasonId_version_slug_idx ON _brackets_v (version_season_id,version_slug);`)
  await db.run(sql`CREATE UNIQUE INDEX bracketId_competitorId_idx ON bracket_applications (bracket_id,competitor_id);`)
  await db.run(sql`CREATE INDEX version_bracketId_version_competitorId_idx ON _bracket_applications_v (version_bracket_id,version_competitor_id);`)
  await db.run(sql`CREATE UNIQUE INDEX bracketId_slug_idx ON teams (bracket_id,slug);`)
  await db.run(sql`CREATE INDEX version_bracketId_version_slug_idx ON _teams_v (version_bracket_id,version_slug);`)
  await db.run(sql`CREATE UNIQUE INDEX teamId_competitorId_idx ON team_members (team_id,competitor_id);`)
  await db.run(sql`CREATE UNIQUE INDEX bracketId_competitorId_1_idx ON team_members (bracket_id,competitor_id);`)
  await db.run(sql`CREATE INDEX version_teamId_version_competitorId_idx ON _team_members_v (version_team_id,version_competitor_id);`)
  await db.run(sql`CREATE INDEX version_bracketId_version_competitorId_1_idx ON _team_members_v (version_bracket_id,version_competitor_id);`)
  await db.run(sql`CREATE UNIQUE INDEX bracketId_seed_idx ON bracket_entries (bracket_id,seed);`)
  await db.run(sql`CREATE UNIQUE INDEX bracketId_competitorId_2_idx ON bracket_entries (bracket_id,competitor_id);`)
  await db.run(sql`CREATE UNIQUE INDEX bracketId_teamId_idx ON bracket_entries (bracket_id,team_id);`)
  await db.run(sql`CREATE INDEX version_bracketId_version_seed_idx ON _bracket_entries_v (version_bracket_id,version_seed);`)
  await db.run(sql`CREATE INDEX version_bracketId_version_competitorId_2_idx ON _bracket_entries_v (version_bracket_id,version_competitor_id);`)
  await db.run(sql`CREATE INDEX version_bracketId_version_teamId_idx ON _bracket_entries_v (version_bracket_id,version_team_id);`)
  await db.run(sql`CREATE UNIQUE INDEX matchId_idx ON match_results (match_id);`)
  await db.run(sql`CREATE INDEX version_matchId_idx ON _match_results_v (version_match_id);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Reverse the typed show relationship without dropping either parent table.
  await db.run(sql`DROP INDEX IF EXISTS showId_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS seasons_show_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS seasonId_personSlug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS seasonId_userId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_seasonId_version_personSlug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_seasonId_version_userId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS seasonId_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_seasonId_version_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_competitorId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_competitorId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS teamId_competitorId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_competitorId_1_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_teamId_version_competitorId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_competitorId_1_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_seed_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_competitorId_2_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS bracketId_teamId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_seed_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_competitorId_2_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_bracketId_version_teamId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS matchId_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS version_matchId_idx;`)
  await db.run(sql`ALTER TABLE seasons RENAME COLUMN show_id TO migrated_show_id;`)
  await db.run(sql`ALTER TABLE seasons ADD show_id text;`)
  await db.run(sql`UPDATE seasons SET show_id = COALESCE(CASE WHEN json_valid(source_data) THEN json_extract(source_data, '$.showId') END, CASE WHEN json_valid(source_data) THEN json_extract(source_data, '$.show_id') END, (SELECT legacy_id FROM shows WHERE shows.id = seasons.migrated_show_id LIMIT 1), CAST(migrated_show_id AS TEXT));`)
  await db.run(sql`ALTER TABLE seasons DROP COLUMN migrated_show_id;`)

  await db.run(sql`DROP INDEX IF EXISTS version_showId_version_slug_idx;`)
  await db.run(sql`DROP INDEX IF EXISTS _seasons_v_version_version_show_idx;`)
  await db.run(sql`ALTER TABLE _seasons_v RENAME COLUMN version_show_id TO migrated_version_show_id;`)
  await db.run(sql`ALTER TABLE _seasons_v ADD version_show_id text;`)
  await db.run(sql`UPDATE _seasons_v SET version_show_id = COALESCE(CASE WHEN json_valid(version_source_data) THEN json_extract(version_source_data, '$.showId') END, CASE WHEN json_valid(version_source_data) THEN json_extract(version_source_data, '$.show_id') END, (SELECT legacy_id FROM shows WHERE shows.id = _seasons_v.migrated_version_show_id LIMIT 1), CAST(migrated_version_show_id AS TEXT));`)
  await db.run(sql`ALTER TABLE _seasons_v DROP COLUMN migrated_version_show_id;`)

  // Reflect edits made through the new singular relationship before removing
  // it. Preserve secondary legacy authors, update the first row according to
  // Payload's actual one-based ordering (while tolerating older zero-based
  // fixtures), and remove all rows when the singular relationship was cleared.
  await db.run(sql`DELETE FROM changelog_rels WHERE path = 'authors' AND parent_id IN (SELECT id FROM changelog WHERE author_id IS NULL);`)
  await db.run(sql`UPDATE changelog_rels SET people_id = (SELECT author_id FROM changelog WHERE changelog.id = changelog_rels.parent_id) WHERE path = 'authors' AND id = (SELECT candidate.id FROM changelog_rels AS candidate WHERE candidate.parent_id = changelog_rels.parent_id AND candidate.path = 'authors' ORDER BY CASE WHEN candidate."order" IS NULL THEN 1 ELSE 0 END, candidate."order", candidate.id LIMIT 1) AND EXISTS (SELECT 1 FROM changelog WHERE changelog.id = changelog_rels.parent_id AND changelog.author_id IS NOT NULL);`)
  await db.run(sql`DELETE FROM changelog_rels WHERE path = 'authors' AND id <> (SELECT candidate.id FROM changelog_rels AS candidate WHERE candidate.parent_id = changelog_rels.parent_id AND candidate.path = 'authors' ORDER BY CASE WHEN candidate."order" IS NULL THEN 1 ELSE 0 END, candidate."order", candidate.id LIMIT 1) AND people_id = (SELECT author_id FROM changelog WHERE changelog.id = changelog_rels.parent_id) AND EXISTS (SELECT 1 FROM changelog WHERE changelog.id = changelog_rels.parent_id AND changelog.author_id IS NOT NULL);`)
  await db.run(sql`INSERT INTO changelog_rels (id,"order",parent_id,path,people_id) SELECT COALESCE((SELECT MAX(id) FROM changelog_rels),0)+ROW_NUMBER() OVER (ORDER BY id),1,id,'authors',author_id FROM changelog WHERE author_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM changelog_rels WHERE parent_id = changelog.id AND path = 'authors');`)

  // Payload stores version-group relationships under version.<fieldName>.
  // Normalize older fixtures that used the live path, then reconcile the
  // current singular version.author value into the pre-migration
  // version.authors path before dropping the direct FK.
  await db.run(sql`UPDATE _changelog_v_rels SET path = 'version.authors' WHERE path = 'authors';`)
  await db.run(sql`DELETE FROM _changelog_v_rels WHERE path IN ('version.author','version.authors') AND parent_id IN (SELECT id FROM _changelog_v WHERE version_author_id IS NULL);`)
  await db.run(sql`UPDATE _changelog_v_rels SET people_id = (SELECT version_author_id FROM _changelog_v WHERE _changelog_v.id = _changelog_v_rels.parent_id) WHERE path = 'version.authors' AND id = (SELECT candidate.id FROM _changelog_v_rels AS candidate WHERE candidate.parent_id = _changelog_v_rels.parent_id AND candidate.path = 'version.authors' ORDER BY CASE WHEN candidate."order" IS NULL THEN 1 ELSE 0 END, candidate."order", candidate.id LIMIT 1) AND EXISTS (SELECT 1 FROM _changelog_v WHERE _changelog_v.id = _changelog_v_rels.parent_id AND _changelog_v.version_author_id IS NOT NULL);`)
  await db.run(sql`DELETE FROM _changelog_v_rels WHERE path = 'version.authors' AND id <> (SELECT candidate.id FROM _changelog_v_rels AS candidate WHERE candidate.parent_id = _changelog_v_rels.parent_id AND candidate.path = 'version.authors' ORDER BY CASE WHEN candidate."order" IS NULL THEN 1 ELSE 0 END, candidate."order", candidate.id LIMIT 1) AND people_id = (SELECT version_author_id FROM _changelog_v WHERE _changelog_v.id = _changelog_v_rels.parent_id) AND EXISTS (SELECT 1 FROM _changelog_v WHERE _changelog_v.id = _changelog_v_rels.parent_id AND _changelog_v.version_author_id IS NOT NULL);`)
  await db.run(sql`INSERT INTO _changelog_v_rels (id,"order",parent_id,path,people_id) SELECT COALESCE((SELECT MAX(id) FROM _changelog_v_rels),0)+ROW_NUMBER() OVER (ORDER BY id),1,id,'version.authors',version_author_id FROM _changelog_v WHERE version_author_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM _changelog_v_rels WHERE parent_id = _changelog_v.id AND path = 'version.authors');`)
  await db.run(sql`DELETE FROM _changelog_v_rels WHERE path = 'version.author';`)
  await db.run(sql`ALTER TABLE changelog DROP COLUMN author_id;`)
  await db.run(sql`ALTER TABLE _changelog_v DROP COLUMN version_author_id;`)
}
