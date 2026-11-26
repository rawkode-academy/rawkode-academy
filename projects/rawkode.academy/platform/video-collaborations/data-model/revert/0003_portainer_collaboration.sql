-- Reverts 0003_portainer_collaboration. Run manually: wrangler d1 execute DB --remote --file revert/0003_portainer_collaboration.sql
DELETE FROM `video_collaborations` WHERE `collaborator_id` = 'portainer';
DELETE FROM `collaborators` WHERE `id` = 'portainer';
