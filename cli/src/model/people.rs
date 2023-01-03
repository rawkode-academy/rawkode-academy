use crate::model::escape_sql;

use super::Insert;
use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;
use miette::{IntoDiagnostic, Result};
use postgres::Client;
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

const INSERT_STATEMENT: &str = r#"
INSERT INTO people ("name", "githubHandle", "twitterHandle", "youtubeHandle")
VALUES (
    '{name}',
    '{githubHandle}',
    '{twitterHandle}',
    '{youtubeHandle}'
)
ON CONFLICT ("id") DO UPDATE
SET
    "name" = '{name}',
    "githubHandle" = '{githubHandle}',
    "twitterHandle" = '{twitterHandle}',
    "youtubeHandle" = '{youtubeHandle}';
"#;

impl Insert for People {
    fn insert(&self, client: &mut Client) -> Vec<Result<()>> {
        let mut results = vec![];

        for (_, person) in self.person.iter() {
            let github_handle = match &person.github {
                Some(github) => github,
                None => "<no handle defined>",
            };

            let twitter_handle = match &person.twitter {
                Some(twitter) => twitter,
                None => "<no handle defined>",
            };

            let youtube_handle = match &person.youtube {
                Some(youtube) => youtube,
                None => "<no handle defined>",
            };

            let query = INSERT_STATEMENT
                .replace("{name}", &escape_sql(&person.name))
                .replace("{githubHandle}", github_handle)
                .replace("{twitterHandle}", twitter_handle)
                .replace("{youtubeHandle}", youtube_handle);

            results.push(
                client
                    .simple_query(query.as_str())
                    .map(|_| ())
                    .into_diagnostic(),
            )
        }

        results
    }
}
