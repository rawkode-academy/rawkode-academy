use crate::model::*;
use glob::glob;
use miette::{miette, IntoDiagnostic, Result};
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
    pub async fn sync_all(self, pool: sqlx::Pool<Postgres>) -> Result<()> {
        self.sync_technologies(&pool)
            .await?
            .sync_shows(&pool)
            .await?
            .sync_people(&pool)
            .await?
            .sync_episodes(&pool)
            .await?;

        Ok(())
    }

    pub async fn sync_people(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        // People have no ID. It's generated in the DB by GitHub Handle
        let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
            r#"INSERT INTO people ("name", "biography", "website", "githubHandle", "twitterHandle", "youtubeHandle", "draft")"#,
        );

        query_builder.push_values(self.people.iter(), |mut q, (name, person)| {
            q.push_bind(name)
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

    pub async fn sync_shows(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> =
            QueryBuilder::new(r#"INSERT INTO shows ("id", "name", "description", "draft")"#);

        query_builder.push_values(self.shows.iter(), |mut q, (name, show)| {
            q.push_bind(slugify(name))
                .push_bind(name)
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

    pub async fn sync_technologies(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
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

    pub async fn sync_episodes(self, pool: &sqlx::Pool<Postgres>) -> Result<Self> {
        let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
            r#"INSERT INTO episodes ("id", "title", "showId", "live", "scheduledFor", "youtubeId", "youtubeCategory", "links", "chapters", "draft")"#,
        );

        query_builder.push_values(self.episodes.iter(), |mut q, (name, episode)| {
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

            q.push_bind(slugify(name))
                .push_bind(name)
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

        let query = query_builder.build();

        query.execute(pool).await.into_diagnostic()?;

        Ok(self)
    }
}
