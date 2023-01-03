use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Technology {
    pub website: String,
    pub documentation: String,
    pub repository: String,
    pub description: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Technologies {
    pub technology: LabeledBlock<IndexMap<String, Technology>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MinimalTechnologies {
    pub technology: Value,
}
