use crate::schema::Entity;
use serde::de::DeserializeOwned;
use std::collections::BTreeMap;
use std::fs;
use validator::Validate;

pub fn load<T: DeserializeOwned + Entity + Validate>(directory: &str) -> BTreeMap<String, T> {
    let mut collection: BTreeMap<String, T> = BTreeMap::new();

    for entry in std::fs::read_dir(directory).unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();

        if path.extension().unwrap() == "yaml" {
            let file_contents: String = fs::read_to_string(&path).unwrap();
            let item: T = serde_yaml::from_str(file_contents.as_str()).unwrap();

            match item.validate() {
                Ok(_) => (),
                Err(err) => panic!("Failed to load [Person]({:?}): {:?}", path, err.errors()),
            }

            collection.insert(item.id(), item);
        }
    }

    collection
}
