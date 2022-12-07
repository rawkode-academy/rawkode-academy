pub use crate::loader::load;
use crate::people::Person;
use crate::schema::Entity;
use crate::shows::Show;
use crate::technologies::Technology;
use sqlx::{
    database::HasArguments, Database, Encode, Execute, Executor, Pool, QueryBuilder, SqlitePool,
    Type,
};

// = note: the following trait bounds were not satisfied:
// `<&'c mut <T as sqlx::Database>::Connection as Executor<'c>>::Database = T`
// which is required by `&Pool<T>: Executor`
// `&'c mut <T as sqlx::Database>::Connection: Executor<'c>`
// which is required by `&Pool<T>: Executor`
//`<T as HasArguments<'_>>::Arguments: IntoArguments<T>`
pub async fn sync<'c, 'q, E, T>(pool: Pool<T>) -> Result<(), anyhow::Error>
where
    // T: Database + for<'p> HasArguments<'p>,
    // T: HasArguments<'q, Database = T>,
    E: Execute<'q, T>,
    T: Database + Executor<'c, Database = T>,
    //77 |     + for<'q> HasArguments<'q, Database = Self>
    std::option::Option<std::string::String>: Encode<'q, T>,
{
    let people = load::<Person>("people");
    let shows = load::<Show>("shows");
    let technologies = load::<Technology>("technologies");

    shows.iter().for_each(|(_, show)| {
        show.hosts.iter().for_each(|host| {
            people
                .iter()
                .find(|(_, person)| person.github_handle == *host)
                .expect(format!("Host '{}' not found on show '{}'", host, show.name).as_str());
        });
    });

    // Postgres
    // let pool = PgPoolOptions::new()
    //     .max_connections(5)
    //     .connect(
    //         std::env::var("POSTGRESQL_CONNECTION_STRING")
    //             .expect("POSTGRESQL_CONNECTION_STRING not set")
    //             .as_str(),
    //     )
    //     .await?;

    // Clear Database
    // let _ = &pool
    //     .execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
    //     .await?;

    // Agnostic

    let _ = &pool.execute(Person::create_sql()).await?;
    let _ = &pool.execute(Show::create_sql()).await?;
    let _ = &pool.execute(Technology::create_sql()).await?;

    // Sync People
    let mut query_builder: QueryBuilder<T> = QueryBuilder::new(
        "INSERT INTO people (name, github_handle, twitter_handle, youtube_handle) ",
    );

    query_builder.push_values(&people, |mut b, (_, person)| {
        b.push_bind(&person.name)
            .push_bind(&person.github_handle)
            .push_bind(&person.twitter_handle)
            .push_bind(&person.youtube_handle);
    });

    query_builder.build().execute(&pool).await?;

    // Sync Shows
    let mut query_builder: QueryBuilder<T> = QueryBuilder::new("INSERT INTO shows (name) ");

    query_builder.push_values(&shows, |mut b, (_, show)| {
        b.push_bind(&show.name);
    });

    query_builder.build().execute(&pool).await?;

    // Sync Show Hosts
    let mut query_builder: QueryBuilder<T> =
        QueryBuilder::new("INSERT INTO show_hosts (show, host) ");

    query_builder.push_values(&shows, |mut b, (_, show)| {
        show.hosts.iter().for_each(|host| {
            b.push_bind(&show.name).push_bind(host);

            ()
        });
    });

    query_builder.build().execute(&pool).await?;

    // Sync Technologies
    let mut query_builder: QueryBuilder<T> =
        QueryBuilder::new("INSERT INTO technologies (name, description, website, documentation, code_repository, twitter_handle, youtube_handle) ");

    query_builder.push_values(technologies, |mut b, (_, technology)| {
        b.push_bind(technology.name)
            .push_bind(technology.description)
            .push_bind(technology.website)
            .push_bind(technology.documentation)
            .push_bind(technology.code_repository)
            .push_bind(technology.twitter_handle)
            .push_bind(technology.youtube_handle);
    });

    query_builder.build().execute(&pool).await?;

    Ok(())
}
