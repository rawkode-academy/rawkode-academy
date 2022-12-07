use crate::{people::Person, schema::Entity};
use async_graphql::SimpleObject;
use serde::Deserialize;
use sqlx::{sqlite::SqliteRow, FromRow, Row};
use validator::Validate;

pub(crate) mod graphql;

#[derive(Clone, Debug, Deserialize, SimpleObject, Validate)]
pub struct Show {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub description: String,
    pub hosts: Vec<String>,
    pub host: Vec<Person>,
}

impl FromRow<'_, SqliteRow> for Show {
    fn from_row(row: &SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            name: row.try_get("name")?,
            description: row.try_get("description")?,
            hosts: vec![],
        })
    }
}

impl Entity for Show {
    fn id(&self) -> String {
        self.name.clone()
    }

    fn create_sql() -> &'static str {
        r#"
          CREATE TABLE shows (
            name VARCHAR(255) NOT NULL PRIMARY KEY,
            description TEXT
          );

          CREATE TABLE show_hosts (
            show VARCHAR(255) NOT NULL REFERENCES shows(name),
            host VARCHAR(255) NOT NULL REFERENCES people(github_handle),
            PRIMARY KEY (show, host)
          );
        "#
    }
}
