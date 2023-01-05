use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;

use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Technology {
    pub draft: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,

    pub open_source: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub twitter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub youtube: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Technologies {
    pub technology: LabeledBlock<IndexMap<String, Technology>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MinimalTechnologies {
    pub technology: Value,
}
