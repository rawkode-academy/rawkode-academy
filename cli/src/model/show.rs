use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Show {}

#[derive(Deserialize, Serialize, Debug)]
pub struct Shows {
    pub show: LabeledBlock<IndexMap<String, Show>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MinimalShows {
    pub show: Value,
}
