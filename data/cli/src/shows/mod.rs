use crate::loader::ID;
use serde::Deserialize;
use validator::Validate;

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct Show {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub description: String,
    pub hosts: Vec<String>,
}

impl ID for Show {
    fn id(&self) -> String {
        self.name.clone()
    }
}
