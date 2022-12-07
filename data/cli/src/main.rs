use axum::{extract::Extension, routing::get, Router, Server};
use inquire::Select;
use sqlx::sqlite::SqlitePoolOptions;
use std::fmt::Display;

mod graphql;
mod loader;
mod people;
mod schema;
mod shows;
mod sync;
use sync::sync;
mod technologies;

enum Commands {
    Sync,
    Serve,
}

impl Display for Commands {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Commands::Sync => write!(f, "Sync"),
            Commands::Serve => write!(f, "Serve (GraphQL API)"),
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let command_list: Vec<Commands> = vec![Commands::Sync, Commands::Serve];
    let pool = SqlitePoolOptions::new().connect(":memory:").await?;

    match Select::new("What would you like to do?", command_list).prompt() {
        Ok(Commands::Sync) => sync(&pool).await?,
        Ok(Commands::Serve) => {
            sync(&pool).await?;

            let schema = graphql::get_schema(pool);

            let app = Router::new()
                .route(
                    "/",
                    get(graphql::graphql_playground).post(graphql::graphql_handler),
                )
                .layer(Extension(schema));

            println!("GraphiQL IDE: http://localhost:8000");

            Server::bind(&"127.0.0.1:8000".parse().unwrap())
                .serve(app.into_make_service())
                .await
                .unwrap();
        }
        Err(_) => println!("I'm a little confused. Let's try again later."),
    }

    Ok(())
}
