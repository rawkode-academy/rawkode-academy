use crate::utils::{build_in_memory_database, find_hcl_files};
use miette::{IntoDiagnostic, Result};
use sqlx::postgres::PgPoolOptions;
use std::path::PathBuf;

pub async fn command(path: PathBuf, _apply: bool) -> Result<()> {
    let files = find_hcl_files(path)?;

    println!("Syncing {} files", files.len());
    let database = build_in_memory_database(files)?;

    let connection_string = std::env::var("DATABASE_DSN")
        .unwrap_or_else(|_| "postgres://academy:academy@localhost:5432/academy".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&connection_string)
        .await
        .into_diagnostic()?;

    database.sync_all(pool).await?;

    Ok(())
}
