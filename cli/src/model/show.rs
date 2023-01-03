use crate::model::escape_sql;

use super::{slugify, Insert};
use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;
use miette::{IntoDiagnostic, Result};
use postgres::Client;
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

const INSERT_STATEMENT: &str = r#"
INSERT INTO shows ("id", "name")
VALUES (
    '{id}',
    '{name}'
)
ON CONFLICT ("id") DO UPDATE
SET
    "name" = '{name}';
"#;

impl Insert for Shows {
    fn insert(&self, client: &mut Client) -> Vec<Result<()>> {
        let mut results = vec![];

        for (id, _) in self.show.iter() {
            let query = INSERT_STATEMENT
                .replace("{id}", &slugify(id))
                .replace("{name}", &escape_sql(id));

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
