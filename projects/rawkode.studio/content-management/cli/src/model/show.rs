use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;

use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Show {
    pub draft: bool,
    pub description: Option<String>,
    pub hosts: Option<Vec<String>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Shows {
    pub show: LabeledBlock<IndexMap<String, Show>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MinimalShows {
    pub show: Value,
}
