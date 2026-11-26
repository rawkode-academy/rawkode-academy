-- Portainer sponsored the Portainer in Production course videos.
INSERT INTO `collaborators` (`id`, `name`, `website_url`) VALUES
	('portainer', 'Portainer', 'https://www.portainer.io');
--> statement-breakpoint
INSERT INTO `video_collaborations` (`video_id`, `collaborator_id`) VALUES
	('aqzmvsr41szkg2uqg0yp2cu4', 'portainer'),
	('f9qr4s42d566gqtkdzzknxn9', 'portainer'),
	('ivg9hwb376cu64psybqhd5k0', 'portainer'),
	('k5xzx8dfmvu7s3nzdqy32kzy', 'portainer'),
	('xi7tekr74r3qfd7pv30lkp0s', 'portainer');
