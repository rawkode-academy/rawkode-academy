create table `rsvp` (
	`user_id` text not null,
	`event_id` text not null,
	`created_at` integer default current_timestamp not null,
	primary key(`event_id`, `user_id`)
);
