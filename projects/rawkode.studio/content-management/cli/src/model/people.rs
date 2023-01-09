use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;

use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Person {
    pub name: String,
    pub draft: bool,
    pub github: String,

    // Email is not allowed in the Git repository,
    // for privacy reasons
    // #[serde(skip)]
    // pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub biography: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub twitter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub youtube: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct People {
    pub person: LabeledBlock<IndexMap<String, Person>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MinimalPeople {
    pub person: Value,
}
