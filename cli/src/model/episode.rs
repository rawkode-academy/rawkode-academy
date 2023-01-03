use super::{slugify, Insert};
use crate::model::{chapter_duration_de, chapter_duration_ser, escape_sql};
use chrono::{DateTime, Duration, Utc};
use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;
use miette::{IntoDiagnostic, Result};
use postgres::Client;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Chapter {
    #[serde(
        deserialize_with = "chapter_duration_de",
        serialize_with = "chapter_duration_ser"
    )]
    pub time: Duration,
    pub title: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Episode {
    pub show: String,
    pub published_at: DateTime<Utc>,
    pub youtube_id: String,
    pub youtube_category: i32,
    // FIXME: pub links: Vec<Url>,
    pub links: Vec<String>,
    pub chapters: Vec<Chapter>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Episodes {
    pub episode: LabeledBlock<IndexMap<String, Episode>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MinimalEpisodes {
    pub episode: Value,
}

const INSERT_STATEMENT: &str = r#"
INSERT INTO episodes ("id", "title", "showId", "scheduledFor", "youtubeId", "youtubeCategory", "links", "chapters")
VALUES (
    '{id}',
    '{title}',
    '{showId}',
    '{scheduledFor}',
    '{youtubeId}',
    {youtubeCategory},
    {links},
    {chapters}
)
ON CONFLICT ("id") DO UPDATE
SET
    "title" = '{title}',
    "showId" = '{showId}',
    "scheduledFor" = '{scheduledFor}',
    "youtubeId" = '{youtubeId}',
    "youtubeCategory" = {youtubeCategory},
    "links" = {links},
    "chapters" = {chapters};
"#;

impl Insert for Episodes {
    fn insert(&self, client: &mut Client) -> Vec<Result<()>> {
        let mut results = vec![];

        for (id, episode) in self.episode.iter() {
            let links = if episode.links.is_empty() {
                "array[]::text[]".to_string()
            } else {
                format!(
                    "array[{}]",
                    episode
                        .links
                        .iter()
                        .map(|link| format!("'{}'", link))
                        .collect::<Vec<String>>()
                        .join(", ")
                )
            };

            let chapters = if episode.chapters.is_empty() {
                "array[]::chapter[]".to_string()
            } else {
                format!(
                    "array[{}]",
                    episode
                        .chapters
                        .iter()
                        .map(|chapter| format!(
                            "row('{}', '{}')::chapter",
                            chapter.time,
                            escape_sql(&chapter.title)
                        ))
                        .collect::<Vec<String>>()
                        .join(", ")
                )
            };

            let query = INSERT_STATEMENT
                .replace("{id}", &slugify(id))
                .replace("{title}", &escape_sql(id))
                .replace("{showId}", &slugify(&episode.show))
                .replace(
                    "{scheduledFor}",
                    &episode
                        .published_at
                        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
                )
                .replace("{youtubeId}", &episode.youtube_id)
                .replace("{youtubeCategory}", &episode.youtube_category.to_string())
                .replace("{links}", &links)
                .replace("{chapters}", &chapters);

            results.push(
                client
                    .simple_query(query.as_str())
                    .map(|_| ())
                    .into_diagnostic(),
            )
        }

        results
    }
}
