use super::InsertStatement;
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

impl InsertStatement for Shows {
    fn statement() -> &'static str {
        r#"
        INSERT INTO shows ("id", "name")
        VALUES (
            $1,
            $2
        )
        ON CONFLICT ("id") DO UPDATE
        SET
            "name" = $2;
        "#
    }
}
