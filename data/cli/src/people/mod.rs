use crate::loader::ID;
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

impl ID for Person {
    fn id(&self) -> String {
        self.github_handle.clone()
    }
}
