use crate::people::graphql as people_graphql;
use crate::people::Person;
use crate::shows::graphql as shows_graphql;
use crate::shows::Show;
use anyhow::Result;
use async_graphql::{
    http::{playground_source, GraphQLPlaygroundConfig},
    Context, EmptyMutation, EmptySubscription, Object, Schema,
};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    response::{Html, IntoResponse},
    Extension,
};
use sqlx::SqlitePool;

pub type GraphQLSchema = Schema<QueryRoot, EmptyMutation, EmptySubscription>;

pub fn get_schema(pool: SqlitePool) -> GraphQLSchema {
    Schema::build(QueryRoot, EmptyMutation, EmptySubscription)
        .data(pool)
        .finish()
}

pub async fn graphql_playground() -> impl IntoResponse {
    Html(playground_source(GraphQLPlaygroundConfig::new("/")))
}

pub async fn graphql_handler(
    schema: Extension<GraphQLSchema>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    schema.execute(req.into_inner()).await.into()
}

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn all_people(
        &self,
        ctx: &Context<'_>,
        filters: Option<people_graphql::PersonFilters>,
    ) -> Result<Vec<Person>> {
        people_graphql::all_people(ctx, filters).await
    }

    async fn all_shows(
        &self,
        ctx: &Context<'_>,
        filters: Option<shows_graphql::ShowFilters>,
    ) -> Result<Vec<Show>> {
        shows_graphql::all_shows(ctx, filters).await
    }
}
