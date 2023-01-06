use hcl::{ser::Block, ser::LabeledBlock, Value};
use indexmap::IndexMap;

use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Technology {
    pub draft: bool,

    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aliases: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,

    pub tagline: String,
    pub description: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_source: Option<Block<OpenSource>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub twitter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub youtube: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct OpenSource {
    #[serde(default = "default_true", skip)]
    pub enabled: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Technologies {
    pub technology: LabeledBlock<IndexMap<String, Technology>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MinimalTechnologies {
    pub technology: Value,
}
