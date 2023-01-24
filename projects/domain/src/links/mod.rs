use crate::people::Person;
use crate::taxonomy::Categories;
use serde::{Deserialize, Serialize};
use typeshare::typeshare;

#[typeshare]
#[derive(Serialize, Deserialize)]
pub(crate) struct Link {
    url: String,
    person: Person,
    category: Vec<Categories>,
}
