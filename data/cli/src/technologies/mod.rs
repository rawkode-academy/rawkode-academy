use crate::loader::ID;
use serde::Deserialize;
use validator::Validate;

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

impl ID for Technology {
    fn id(&self) -> String {
        self.name.clone()
    }
}
