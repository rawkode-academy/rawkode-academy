use super::{slugify, Insert};
use hcl::{ser::LabeledBlock, Value};
use indexmap::IndexMap;
use miette::{IntoDiagnostic, Result};
use postgres::Client;
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

const INSERT_STATEMENT: &str = r#"
INSERT INTO technologies ("id", "name", "description", "website", "repository", "documentation")
VALUES (
    '{id}',
    '{name}',
    '{description}',
    '{website}',
    '{repository}',
    '{documentation}'
)
ON CONFLICT ("id") DO UPDATE
SET
    "name" = '{name}',
    "description" = '{description}',
    "website" = '{website}',
    "repository" = '{repository}',
    "documentation" = '{documentation}';
"#;

impl Insert for Technologies {
    fn insert(&self, client: &mut Client) -> Vec<Result<()>> {
        let mut results = vec![];

        for (id, technology) in self.technology.iter() {
            let query = INSERT_STATEMENT
                .replace("{id}", &slugify(id))
                .replace("{name}", id)
                .replace("{description}", &technology.description)
                .replace("{website}", &technology.website)
                .replace("{repository}", &technology.repository)
                .replace("{documentation}", &technology.documentation);

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
