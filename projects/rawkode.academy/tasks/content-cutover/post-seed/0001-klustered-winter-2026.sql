-- #1481 changed content/articles/klustered-winter-2026/index.mdx on main after the
-- production dump behind the articles seed was taken. Apply to platform-articles
-- after the seed. The body is the article converted with @rawkodeacademy/rich-text
-- (fromMarkdown, mdx: true).
UPDATE `articles` SET
	`title` = 'Klustered Winter 2026 starts Wednesday 18 November',
	`description` = 'Klustered returns on Wednesday, 18 November 2026 with a pre-season, then the Solo bracket in January, every Wednesday at 17:30 GMT.',
	`open_graph_title` = 'Klustered Winter 2026 starts Wednesday 18 November',
	`open_graph_subtitle` = 'A pre-season from 18 November, then the Solo bracket in January, at 17:30 GMT.',
	`body` = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Klustered is back. Winter 2026 starts on Wednesday, 18 November at 17:30 GMT with a pre-season, then the Solo bracket in January."}]},{"type":"paragraph","content":[{"type":"text","text":"Contestants race against the clock to diagnose and fix deliberately broken Kubernetes clusters. The community can sabotage the clusters, so the rest of us get to watch the troubleshooting unfold live."}]},{"type":"paragraph","content":[{"type":"text","text":"Want to compete? Applications for Winter 2026 are open. Click "},{"type":"text","text":"Apply","marks":[{"type":"link","attrs":{"href":"/shows/klustered/apply","target":null,"rel":null,"class":null,"title":null}}]},{"type":"text","text":", choose Solo or Team, and sign in to submit your application."}]},{"type":"paragraph","content":[{"type":"text","text":"Put Wednesday, 18 November, 17:30 GMT in your calendar. We’ll see who can get the cluster back on its feet."}]}]}',
	`revised_at` = 1792800000000,
	`updated_at` = 1792886400000
WHERE `id` = 'klustered-winter-2026';
