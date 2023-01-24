use serde::{Deserialize, Serialize};
use typeshare::typeshare;

#[typeshare]
#[derive(Serialize, Deserialize)]
pub(crate) enum ContentTypes {
    Article,
    CodeRepository,
    Tweet,
    Video,
}

#[typeshare]
#[derive(Serialize, Deserialize)]
pub(crate) enum Categories {
    CloudNative,
    DevOps,
    Kubernetes,
}
