use super::InsertStatement;
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

impl InsertStatement for Technologies {
    fn statement() -> &'static str {
        r#"
INSERT INTO technologies ("id", "name", "description", "website", "repository", "documentation")
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
ON CONFLICT ("id") DO UPDATE
SET
    "name" = $2,
    "description" = $3,
    "website" = $4,
    "repository" = $5,
    "documentation" = $6;
"#
    }
}
