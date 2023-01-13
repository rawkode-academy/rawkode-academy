use crate::model::*;
use glob::glob;
use miette::{miette, ErrReport, IntoDiagnostic, Result};
use serde::de::DeserializeOwned;
use sqlx::{postgres::types::PgInterval, Postgres, QueryBuilder};
use std::{collections::HashMap, fs::read_to_string, path::PathBuf};

pub(crate) fn find_hcl_files(path: PathBuf) -> Result<Vec<PathBuf>> {
    Ok(glob(&format!("{}/**/*.hcl", path.display()))
        .into_diagnostic()?
        .flatten()
        .collect::<Vec<PathBuf>>())
}

pub(crate) struct InMemoryDatabase {
    pub(crate) episodes: HashMap<String, Episode>,
    pub(crate) shows: HashMap<String, Show>,
    pub(crate) technologies: HashMap<String, Technology>,
    pub(crate) people: HashMap<String, Person>,
}

fn insert<T: DeserializeOwned>(block: &hcl::Block, map: &mut HashMap<String, T>) -> Result<()> {
    let value: T = hcl::from_body(block.body().to_owned()).into_diagnostic()?;
    let label = block
        .labels()
        .first()
        .map(|label| label.as_str().to_string())
        .ok_or_else(|| miette!("Block {} does not have a label", block.identifier()))?;

    map.insert(label, value);

    Ok(())
}

pub(crate) fn build_in_memory_database(files: Vec<PathBuf>) -> Result<InMemoryDatabase> {
    let mut episodes: HashMap<String, Episode> = HashMap::new();
    let mut shows: HashMap<String, Show> = HashMap::new();
    let mut technologies: HashMap<String, Technology> = HashMap::new();
    let mut people: HashMap<String, Person> = HashMap::new();

    for file in files {
        if let Ok(content) = read_to_string(file) {
            let content = content.as_str();

            let file_objects = hcl::from_str::<hcl::Body>(content).into_diagnostic()?;

            file_objects.into_iter().for_each(|object| {
                let Some(block) = object.as_block() else {
                    return;
                };

                match block.identifier() {
                    "person" => {
                        if insert(block, &mut people).is_err() {
                            eprintln!("Failed to parse person");
                        }
                    }

                    "show" => {
                        if insert(block, &mut shows).is_err() {
                            eprintln!("Failed to parse show");
                        }
                    }

                    "technology" => {
                        if insert(block, &mut technologies).is_err() {
                            eprintln!("Failed to parse technology");
                        }
                    }

                    "episode" => {
                        if insert(block, &mut episodes).is_err() {
                            eprintln!("Failed to parse episode");
                        }
                    }

                    _ => (),
                }
            });
        }
    }

    Ok(InMemoryDatabase {
        episodes,
        shows,
        technologies,
        people,
    })
}

impl InMemoryDatabase {
    pub async fn cleanup_all(self, pool: &sqlx::Pool<Postgres>) -> Result<()> {
        self.cleanup_episodes(pool)
            .await?
            .cleanup_shows(pool)
            .await?
            .cleanup_technologies(pool)
            .await?
            .cleanup_people(pool)
            .await?;

        Ok(())
    }

    async fn cleanup_episodes(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> =
            QueryBuilder::new(r#"DELETE FROM episodes WHERE "id" NOT IN ("#);

        let mut separated = query_builder.separated(", ");

        for (id, _) in self.episodes.iter() {
            separated.push_bind(id);
        }

        separated.push_unseparated(");");

        let query = query_builder.build();

        query.execute(pool).await.into_diagnostic()?;

        Ok(self)
    }

    async fn cleanup_shows(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> =
            QueryBuilder::new(r#"DELETE FROM shows WHERE "id" NOT IN ("#);

        let mut separated = query_builder.separated(", ");

        for (id, _) in self.shows.iter() {
            separated.push_bind(id);
        }

        separated.push_unseparated(");");

        let query = query_builder.build();

        query.execute(pool).await.into_diagnostic()?;

        Ok(self)
    }

    async fn cleanup_technologies(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> =
            QueryBuilder::new(r#"DELETE FROM technologies WHERE "id" NOT IN ("#);

        let mut separated = query_builder.separated(", ");

        for (id, _) in self.technologies.iter() {
            separated.push_bind(id);
        }

        separated.push_unseparated(");");

        let query = query_builder.build();

        query.execute(pool).await.into_diagnostic()?;

        Ok(self)
    }

    async fn cleanup_people(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> =
            QueryBuilder::new(r#"DELETE FROM people WHERE "id" NOT IN ("#);

        let mut separated = query_builder.separated(", ");

        for (id, _) in self.people.iter() {
            separated.push_bind(id);
        }

        separated.push_unseparated(");");

        let query = query_builder.build();

        query.execute(pool).await.into_diagnostic()?;

        Ok(self)
    }

    pub async fn validate_dependencies(self) -> Result<Self> {
        let mut errors: Vec<DependencyError> = vec![];

        for (id, episode) in self.episodes.iter() {
            // Check if the show exists
            if !self
                .shows
                .iter()
                .any(|(show_id, _)| *show_id == episode.show)
            {
                errors.push(DependencyError {
                    source_code: format!(
                        "Cannot find show '{}' for episode '{}'.",
                        episode.show, id
                    ),
                    model_name: "show".to_string(),
                    help: format!("Add a show with the name '{}'.", episode.show),
                })
            }

            // Check if the person exists
            for guest in episode
                .guests
                .as_ref()
                .unwrap_or(&Vec::<String>::new())
                .iter()
            {
                if !self
                    .people
                    .iter()
                    .any(|(_, person)| *guest == person.github)
                {
                    errors.push(DependencyError {
                        source_code: format!(
                            "Cannot find person '{}' for episode '{}'.",
                            guest, id
                        ),
                        model_name: "person".to_string(),
                        help: format!("Add a person with the name '{}'.", guest),
                    })
                }
            }

            // Check if the technology exists
            for technology in episode
                .technologies
                .as_ref()
                .unwrap_or(&Vec::<String>::new())
                .iter()
            {
                if !self
                    .technologies
                    .iter()
                    .any(|(technology_id, _)| technology_id == technology)
                {
                    errors.push(DependencyError {
                        source_code: format!(
                            "Cannot find technology '{}' for episode '{}'.",
                            technology, id
                        ),
                        model_name: "technology".to_string(),
                        help: format!("Add a technology with the name '{}'.", technology),
                    })
                }
            }
        }

        for (id, show) in self.shows.iter() {
            // Check if the person exists
            for host in show.hosts.as_ref().unwrap_or(&Vec::<String>::new()).iter() {
                if !self.people.iter().any(|(_, person)| *host == person.github) {
                    errors.push(DependencyError {
                        source_code: format!("Cannot find person '{}' for show '{}'.", host, id),
                        model_name: "person".to_string(),
                        help: format!("Add a person with the name '{}'.", host),
                    })
                }
            }
        }

        if errors.is_empty() {
            Ok(self)
        } else {
            Err(ErrReport::from(DependencyErrors { errors }))?
        }
    }

    pub async fn sync_all(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        self.sync_technologies(pool)
            .await?
            .sync_shows(pool)
            .await?
            .sync_people(pool)
            .await?
            .sync_episodes(pool)
            .await
    }

    async fn sync_people(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
            r#"INSERT INTO people ("id", "name", "biography", "website", "githubHandle", "twitterHandle", "youtubeHandle", "draft")"#,
        );

        query_builder.push_values(self.people.iter(), |mut q, (id, person)| {
            q.push_bind(id)
                .push_bind(&person.name)
                .push_bind(&person.biography)
                .push_bind(&person.website)
                .push_bind(&person.github)
                .push_bind(&person.twitter)
                .push_bind(&person.youtube)
                .push_bind(person.draft);
        });

        query_builder.push(
            r#" ON CONFLICT ("id") DO UPDATE
            SET
                "name" = EXCLUDED."name",
                "biography" = EXCLUDED."biography",
                "website" = EXCLUDED."website",
                "githubHandle" = EXCLUDED."githubHandle",
                "twitterHandle" = EXCLUDED."twitterHandle",
                "youtubeHandle" = EXCLUDED."youtubeHandle",
                "draft" = EXCLUDED."draft";"#,
        );

        let query = query_builder.build();

        query.execute(pool).await.into_diagnostic()?;

        Ok(self)
    }

    async fn sync_shows(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> =
            QueryBuilder::new(r#"INSERT INTO shows ("id", "name", "description", "draft")"#);

        query_builder.push_values(self.shows.iter(), |mut q, (id, show)| {
            q.push_bind(id)
                .push_bind(&show.name)
                .push_bind(&show.description)
                .push_bind(show.draft);
        });

        query_builder.push(
            r#" ON CONFLICT ("id") DO UPDATE
            SET
                "name" = EXCLUDED."name",
                "description" = EXCLUDED."description",
                "draft" = EXCLUDED."draft"
            ;
            "#,
        );

        let query = query_builder.build();

        query.execute(pool).await.into_diagnostic()?;

        Ok(self)
    }

    async fn sync_technologies(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
            r#"INSERT INTO technologies ("id", "name", "aliases", "tagline", "description", "website", "open_source", "repository", "documentation", "twitter_handle", "youtube_handle", "draft")"#,
        );

        query_builder.push_values(self.technologies.iter(), |mut q, (id, technology)| {
            let (open_source, repository) = match &technology.open_source {
                Some(os) => (true, os.repository.clone()),
                None => (false, None),
            };

            q.push_bind(id)
                .push_bind(&technology.name)
                .push_bind(&technology.aliases)
                .push_bind(&technology.tagline)
                .push_bind(&technology.description)
                .push_bind(&technology.website)
                .push_bind(open_source)
                .push_bind(repository)
                .push_bind(&technology.documentation)
                .push_bind(&technology.twitter)
                .push_bind(&technology.youtube)
                .push_bind(technology.draft);
        });

        query_builder.push(
            r#" ON CONFLICT ("id") DO UPDATE
            SET
                "name" = EXCLUDED."name",
                "aliases" = EXCLUDED."aliases",

                "tagline" = EXCLUDED."tagline",
                "description" = EXCLUDED."description",

                "website" = EXCLUDED."website",
                "documentation" = EXCLUDED."documentation",

                "open_source" = EXCLUDED."open_source",
                "repository" = EXCLUDED."repository",

                "twitter_handle" = EXCLUDED."twitter_handle",
                "youtube_handle" = EXCLUDED."youtube_handle",

                "draft" = EXCLUDED."draft"
            ;
            "#,
        );

        let query = query_builder.build();

        query.execute(pool).await.into_diagnostic()?;

        Ok(self)
    }

    async fn sync_episodes(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
            r#"INSERT INTO episodes ("id", "title", "showId", "live", "scheduledFor", "youtubeId", "youtubeCategory", "links", "chapters", "draft")"#,
        );

        query_builder.push_values(self.episodes.iter(), |mut q, (id, episode)| {
            let links = episode
                .links
                .iter()
                .map(|link| link.to_string())
                .collect::<Vec<String>>();

            let chapters = episode
                .chapter
                .as_ref()
                .map(|chapter| {
                    chapter
                        .iter()
                        .filter_map(|(title, chapter)| {
                            chapter
                                .time
                                .try_into()
                                .ok()
                                .map(|time: PgInterval| PgChapter {
                                    title: title.to_string(),
                                    time,
                                })
                        })
                        .collect::<Vec<PgChapter>>()
                })
                .unwrap_or_default();

            q.push_bind(id)
                .push_bind(&episode.title)
                .push_bind(&episode.show)
                .push_bind(episode.live)
                .push_bind(episode.scheduled_for)
                .push_bind(&episode.youtube_id)
                .push_bind(episode.youtube_category)
                .push_bind(links)
                .push_bind(chapters)
                .push_bind(episode.draft);
        });

        query_builder.push(
            r#" ON CONFLICT ("id") DO UPDATE
            SET
                "title" = EXCLUDED."title",
                "showId" = EXCLUDED."showId",
                "live" = EXCLUDED."live",
                "scheduledFor" = EXCLUDED."scheduledFor",
                "youtubeId" = EXCLUDED."youtubeId",
                "youtubeCategory" = EXCLUDED."youtubeCategory",
                "links" = EXCLUDED."links",
                "chapters" = EXCLUDED."chapters",
                "draft" = EXCLUDED."draft"
            ;
            "#,
        );

        let mut transaction = pool.begin().await.into_diagnostic()?;

        let episodes_query = query_builder.build();

        episodes_query
            .execute(&mut transaction)
            .await
            .into_diagnostic()?;

        if let Some(mut quests_query_builder) = self.episode_quests_query() {
            let query = quests_query_builder.build();

            query.execute(&mut transaction).await.into_diagnostic()?;
        }

        if let Some(mut technologies_query_builder) = self.episode_technologies_query() {
            let query = technologies_query_builder.build();

            query.execute(&mut transaction).await.into_diagnostic()?;
        }

        transaction.commit().await.into_diagnostic()?;

        Ok(self)
    }

    fn episode_quests_query(&self) -> Option<QueryBuilder<Postgres>> {
        let episodes_with_guests = self
            .episodes
            .iter()
            .flat_map(|(name, episode)| {
                episode
                    .guests
                    .as_deref()
                    .unwrap_or_default()
                    .iter()
                    .map(|guest| (name, guest))
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();

        if episodes_with_guests.is_empty() {
            None
        } else {
            let mut query_builder =
                QueryBuilder::new(r#"INSERT INTO episode_guests ("episodeId", "personId")"#);

            query_builder.push_values(
                episodes_with_guests.clone(),
                |mut q, (episode_id, guest)| {
                    q.push_bind(episode_id).push_bind(guest);
                },
            );

            query_builder.push(r#" ON CONFLICT ("episodeId", "personId") DO NOTHING;"#);

            Some(query_builder)
        }
    }

    fn episode_technologies_query(&self) -> Option<QueryBuilder<Postgres>> {
        let episodes_with_technologies = self
            .episodes
            .iter()
            .flat_map(|(name, episode)| {
                episode
                    .technologies
                    .as_deref()
                    .unwrap_or_default()
                    .iter()
                    .map(|technology| (name, technology))
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();

        if episodes_with_technologies.is_empty() {
            None
        } else {
            let mut query_builder = QueryBuilder::new(
                r#"INSERT INTO episode_technologies ("episodeId", "technologyId")"#,
            );

            query_builder.push_values(
                episodes_with_technologies.clone(),
                |mut q, (episode_id, technology)| {
                    q.push_bind(episode_id).push_bind(technology);
                },
            );

            query_builder.push(r#" ON CONFLICT ("episodeId", "technologyId") DO NOTHING;"#);

            Some(query_builder)
        }
    }
}
