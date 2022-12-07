use super::Person;
use anyhow::{anyhow, Result};
use async_graphql::{Context, InputObject};
use sqlx::SqlitePool;

#[derive(InputObject)]
pub struct PersonFilters {
    github_handle: Option<String>,
}

pub async fn all_people(ctx: &Context<'_>, filters: Option<PersonFilters>) -> Result<Vec<Person>> {
    let people = ctx.data_unchecked::<SqlitePool>();
    let mut binds: Vec<String> = vec![];

    let mut query_string: String = "SELECT * FROM people".into();

    if let Some(filter) = filters {
        query_string.push_str(" WHERE ");

        if let Some(github_handle) = filter.github_handle {
            query_string.push_str("github_handle = ?");
            binds.push(github_handle);
        }
    }

    let q = sqlx::query_as::<_, Person>(&query_string);
    let q = binds.into_iter().fold(q, |q, bind| q.bind(bind));

    match q.fetch_all(people).await {
        Ok(people) => Ok(people),
        Err(err) => Err(anyhow!("Failed to fetch people: {}", err)),
    }
}
