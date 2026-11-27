-- Reverts 0004_collaborator_announcement. Run manually: wrangler d1 execute DB --remote --file revert/0004_collaborator_announcement.sql
ALTER TABLE `collaborators` DROP COLUMN `announcement_url`;
ALTER TABLE `collaborators` DROP COLUMN `announcement`;
