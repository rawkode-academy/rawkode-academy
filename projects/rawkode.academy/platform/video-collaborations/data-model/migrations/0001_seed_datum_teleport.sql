-- Collaborators and the videos they are credited on, read from the Academy's videos.
INSERT INTO `collaborators` (`id`, `name`, `website_url`) VALUES ('datum', 'Datum', 'https://www.datum.net'), ('teleport', 'Teleport', 'https://goteleport.com');
--> statement-breakpoint
INSERT INTO `video_collaborations` (`video_id`, `collaborator_id`) VALUES
	('dywvwcapxttxtrzzifmfs328', 'datum'),
	('dxaqz2c8h6d4o7wjae2x5avo', 'datum'),
	('vg1sef3eut9r5g6ed388w7uh', 'datum'),
	('z2b4nywsfqohxi00jarfdn1n', 'datum'),
	('qhc6jajwhi2ul563ncovdrg9', 'teleport'),
	('bx2e90jd6p1u2pkvgj1wo6b7', 'teleport'),
	('s7mhnkw81wdgfe5tc4a2ky18', 'teleport'),
	('h1qevuz6tezzpolx3afeo0r2', 'teleport'),
	('c94kkvztdlqc5vvil0c91p95', 'teleport'),
	('twq63ce7cr33d3nn6olb2aa2', 'teleport'),
	('m33ycy3p5m13rbpi3h4bkbv0', 'teleport'),
	('te9uhekxxgat60sku1r85kuv', 'teleport'),
	('ycuvz85u2a7678qr5o4a488z', 'teleport'),
	('dtax4c66pvgyj704bvojhsou', 'teleport'),
	('ag2zatp44xhj015i1fe4ejs1', 'teleport'),
	('usjlx0m96px21ont4ouar9a7', 'teleport'),
	('n7tneoc9na93g1cpnfz7cx6i', 'teleport'),
	('hn0j9iu8ps7jaegq6iykq50c', 'teleport'),
	('wdrgonuy73469iogpfz4afx3', 'teleport'),
	('pgrokuuhvovem0ajyew4tncu', 'teleport'),
	('qamuh4bhe90e6gwbs5bsoufk', 'teleport');
