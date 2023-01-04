use super::InsertStatement;
use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;

use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Person {
    pub name: String,
    pub twitter: Option<String>,
    pub github: Option<String>,
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

impl InsertStatement for People {
    fn statement() -> &'static str {
        r#"
        INSERT INTO people ("name", "githubHandle", "twitterHandle", "youtubeHandle")
        VALUES (
            $1,
            $2,
            $3,
            $4
        )
        ON CONFLICT ("id") DO UPDATE
        SET
            "name" = $1,
            "githubHandle" = $2,
            "twitterHandle" = $3,
            "youtubeHandle" = $4;
        "#
    }
}
