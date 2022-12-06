use crate::schema::Entity;
use serde::Deserialize;
use validator::Validate;

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct Person {
    #[validate(length(min = 1, max = 255))]
    pub name: String,

    #[validate(email)]
    pub email: Option<String>,

    pub biography: Option<String>,

    #[validate(length(min = 1, max = 39))]
    #[serde(alias = "github")]
    pub github_handle: String,

    #[validate(length(min = 4, max = 15))]
    #[serde(alias = "twitter")]
    pub twitter_handle: Option<String>,

    #[validate(length(min = 3, max = 30))]
    #[serde(alias = "youtube")]
    pub youtube_handle: Option<String>,
}

impl Entity for Person {
    fn id(&self) -> String {
        self.github_handle.clone()
    }

    fn create_sql() -> &'static str {
        r#"
            CREATE TABLE IF NOT EXISTS people (
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                biography TEXT,
                github_handle VARCHAR(39) NOT NULL PRIMARY KEY,
                twitter_handle VARCHAR(15),
                youtube_handle VARCHAR(30)
            );"#
    }
}
