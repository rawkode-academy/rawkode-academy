pub use crate::loader::load;
use crate::people::Person;
use crate::shows::Show;
use crate::technologies::Technology;

pub async fn sync() -> Result<(), anyhow::Error> {
    let people = load::<Person>("people");
    let shows = load::<Show>("shows");
    let _technologies = load::<Technology>("technologies");

    shows.into_iter().for_each(|(_, show)| {
        println!("Validating {} hosts {:?}", show.name, show.hosts);

        show.hosts.iter().for_each(|host| {
            people
                .iter()
                .find(|(_, person)| {
                    println!("Checking if {} == {}", person.github_handle, host);
                    person.github_handle == *host
                })
                .expect(format!("Host '{}' not found on show '{}'", host, show.name).as_str());
        });
    });

    Ok(())
}
