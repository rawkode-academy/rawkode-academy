use super::Show;
use anyhow::{anyhow, Result};
use async_graphql::{Context, InputObject};
use sqlx::SqlitePool;

#[derive(InputObject)]
pub struct ShowFilters {
    name: Option<String>,
}

pub async fn all_shows(ctx: &Context<'_>, filters: Option<ShowFilters>) -> Result<Vec<Show>> {
    let shows = ctx.data_unchecked::<SqlitePool>();
    let mut binds: Vec<String> = vec![];

    let mut query_string: String = "SELECT * FROM shows".into();

    if let Some(filter) = filters {
        query_string.push_str(" WHERE ");

        if let Some(name) = filter.name {
            query_string.push_str("name = ?");
            binds.push(name);
        }
    }

    let q = sqlx::query_as::<_, Show>(&query_string);
    let q = binds.into_iter().fold(q, |q, bind| q.bind(bind));

    match q.fetch_all(shows).await {
        Ok(shows) => Ok(shows),
        Err(err) => Err(anyhow!("Failed to fetch shows: {}", err)),
    }
}
