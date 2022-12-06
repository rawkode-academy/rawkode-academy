pub use crate::loader::load;
use crate::people::Person;
use crate::schema::Entity;
use crate::shows::Show;
use crate::technologies::Technology;
use sqlx::postgres::PgPoolOptions;
use sqlx::{Postgres, QueryBuilder};

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

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(
            std::env::var("POSTGRESQL_CONNECTION_STRING")
                .expect("POSTGRESQL_CONNECTION_STRING not set")
                .as_str(),
        )
        .await?;

    sqlx::query("DROP SCHEMA IF EXISTS public CASCADE")
        .execute(&pool)
        .await?;
    sqlx::query("CREATE SCHEMA public").execute(&pool).await?;
    sqlx::query(Person::create_sql()).execute(&pool).await?;
    sqlx::query(Show::create_sql()).execute(&pool).await?;
    sqlx::query(Technology::create_sql()).execute(&pool).await?;

    let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
        "INSERT INTO people (name, github_handle, twitter_handle, youtube_handle) ",
    );

    query_builder.push_values(people, |mut b, (_, person)| {
        b.push_bind(person.name)
            .push_bind(person.github_handle)
            .push_bind(person.twitter_handle)
            .push_bind(person.youtube_handle);
    });

    query_builder.build().execute(&pool).await?;

    Ok(())
}
