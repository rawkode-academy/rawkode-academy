use super::InsertStatement;
use crate::model::{chapter_duration_de, chapter_duration_ser};
use chrono::{DateTime, Utc};
use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sqlx::{
    postgres::{types::PgInterval, PgHasArrayType},
    Type,
};

#[derive(Deserialize, Serialize, Debug, Type)]
pub struct Chapter {
    #[serde(
        serialize_with = "chapter_duration_ser",
        deserialize_with = "chapter_duration_de"
    )]
    pub time: PgInterval, // The chrono::Duration support is not that great, so we use the internal interval type instead
    pub title: String,
}

impl PgHasArrayType for Chapter {
    fn array_type_info() -> sqlx::postgres::PgTypeInfo {
        sqlx::postgres::PgTypeInfo::with_name("_chapter")
    }
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Episode {
    pub draft: bool,
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

impl InsertStatement for Episodes {
    fn statement() -> &'static str {
        r#"
        INSERT INTO episodes ("id", "title", "showId", "scheduledFor", "youtubeId", "youtubeCategory", "links", "chapters", "draft")
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
        )
        ON CONFLICT ("id") DO UPDATE
        SET
            "title" = $2,
            "showId" = $3,
            "scheduledFor" = $4,
            "youtubeId" = $5,
            "youtubeCategory" = $6,
            "links" = $7,
            "chapters" = $8,
            "draft" = $9;
        "#
    }
}
