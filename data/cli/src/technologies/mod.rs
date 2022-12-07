use crate::schema::Entity;
use serde::Deserialize;
use validator::Validate;

mod graphql;

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct Technology {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub description: String,

    #[validate(url)]
    pub code_repository: Option<String>,

    #[validate(url)]
    pub website: Option<String>,

    #[validate(url)]
    pub documentation: Option<String>,

    #[validate(length(min = 4, max = 15))]
    #[serde(alias = "twitter")]
    pub twitter_handle: Option<String>,

    #[validate(length(min = 3, max = 30))]
    #[serde(alias = "youtube")]
    pub youtube_handle: Option<String>,
}

impl Entity for Technology {
    fn id(&self) -> String {
        self.name.clone()
    }

    fn create_sql() -> &'static str {
        r#"
            CREATE TABLE IF NOT EXISTS technologies (
                name VARCHAR(255) NOT NULL PRIMARY KEY,
                description TEXT,
                code_repository VARCHAR(255),
                website VARCHAR(255),
                documentation VARCHAR(255),
                twitter_handle VARCHAR(15),
                youtube_handle VARCHAR(30)
            );"#
    }
}
