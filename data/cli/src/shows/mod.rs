use crate::schema::Entity;
use serde::Deserialize;
use validator::Validate;

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct Show {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub description: String,
    pub hosts: Vec<String>,
}

impl Entity for Show {
    fn id(&self) -> String {
        self.name.clone()
    }

    fn create_sql() -> &'static str {
        r#"CREATE TABLE IF NOT EXISTS shows (
            name VARCHAR(255) NOT NULL PRIMARY KEY,
            description TEXT,
            hosts JSONB
        );"#
    }
}
