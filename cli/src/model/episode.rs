use crate::model::{chapter_duration_de, chapter_duration_ser};
use chrono::{DateTime, Duration, Utc};
use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;
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
    pub youtube_category: u16,
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
