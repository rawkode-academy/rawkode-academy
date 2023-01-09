use crate::model::{chapter_duration_de, chapter_duration_ser};
use chrono::{DateTime, Duration, Utc};
use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sqlx::{
    postgres::{types::PgInterval, PgHasArrayType},
    Type,
};
use url::Url;

#[derive(Debug, Type)]
#[sqlx(type_name = "chapter")]
pub struct PgChapter {
    pub time: PgInterval, // The chrono::Duration support is not that great, so we use the internal interval type instead
    pub title: String,
}

impl PgHasArrayType for PgChapter {
    fn array_type_info() -> sqlx::postgres::PgTypeInfo {
        sqlx::postgres::PgTypeInfo::with_name("_chapter")
    }
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Chapter {
    #[serde(
        serialize_with = "chapter_duration_ser",
        deserialize_with = "chapter_duration_de"
    )]
    pub time: Duration,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Episode {
    pub draft: bool,
    pub show: String,
    pub live: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_for: Option<DateTime<Utc>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub youtube_id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub youtube_category: Option<i32>,

    pub links: Vec<Url>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter: Option<LabeledBlock<IndexMap<String, Chapter>>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub guests: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub technologies: Option<Vec<String>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Episodes {
    pub episode: LabeledBlock<IndexMap<String, Episode>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MinimalEpisodes {
    pub episode: Value,
}
