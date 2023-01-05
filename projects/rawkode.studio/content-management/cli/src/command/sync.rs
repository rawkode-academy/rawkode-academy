use crate::{
    command::get_paths,
    model::{slugify, Episodes, InsertStatement, People, PgChapter, Shows, Technologies},
};
use hcl::from_str;
use miette::{miette, IntoDiagnostic, Result};
use sqlx::{
    postgres::{types::PgInterval, PgPoolOptions},
    Pool, Postgres,
};
use std::{fs::read_to_string, path::PathBuf};

pub async fn sync(path: PathBuf, apply: bool) -> Result<()> {
    // add shows first, because they are referenced by episodes
    let files = vec![
        get_paths(path.join("shows")),
        get_paths(path.join("technologies")),
        get_paths(path.join("people")),
        get_paths(path.join("episodes")),
    ];

    let files = files.into_iter().flatten().collect::<Vec<PathBuf>>();

    println!("Syncing {} files", files.len());
    println!();

    let connection_string = std::env::var("DATABASE_DSN")
        .unwrap_or_else(|_| "postgres://academy:academy@localhost:5432/academy".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&connection_string)
        .await
        .into_diagnostic()?;

    for file in files {
        if let Ok(content) = read_to_string(&file) {
            if apply {
                match try_insert(&content, &pool).await {
                    Ok(_) => println!("{} - OK", file.display()),
                    Err(error) => eprintln!("{} - NOT OK: {:#?}", file.display(), error),
                }
            } else {
                println!("{} - DRY RUN", file.display());
            }
        }
    }

    Ok(())
}

async fn try_insert(content: &str, pool: &Pool<Postgres>) -> Result<()> {
    if let Ok(shows) = from_str::<Shows>(content) {
        let statement = <Shows as InsertStatement>::statement();

        for (title, show) in shows.show.iter() {
            sqlx::query(statement)
                .bind(slugify(title))
                .bind(title)
                .bind(show.draft)
                .execute(pool)
                .await
                .into_diagnostic()?;
        }

        Ok(())
    } else if let Ok(technologies) = from_str::<Technologies>(content) {
        let statement = <Technologies as InsertStatement>::statement();

        for (title, technology) in technologies.technology.iter() {
            sqlx::query(statement)
                .bind(slugify(title))
                .bind(title)
                .bind(&technology.description)
                .bind(&technology.website)
                .bind(&technology.repository)
                .bind(&technology.documentation)
                .bind(technology.draft)
                .execute(pool)
                .await
                .into_diagnostic()?;
        }

        Ok(())
    } else if let Ok(people) = from_str::<People>(content) {
        let statement = <People as InsertStatement>::statement();

        for (name, person) in people.person.iter() {
            sqlx::query(statement)
                .bind(name)
                .bind(&person.github)
                .bind(&person.twitter)
                .bind(&person.youtube)
                .bind(person.draft)
                .execute(pool)
                .await
                .into_diagnostic()?;
        }

        Ok(())
    } else if let Ok(episodes) = from_str::<Episodes>(content) {
        let statement = <Episodes as InsertStatement>::statement();

        for (title, episode) in episodes.episode.iter() {
            let links = episode
                .links
                .iter()
                .map(|link| link.to_string())
                .collect::<Vec<String>>();

            let chapters = episode
                .chapter
                .as_ref()
                .map(|chapter| {
                    chapter
                        .iter()
                        .filter_map(|(title, chapter)| {
                            chapter
                                .time
                                .try_into()
                                .ok()
                                .map(|time: PgInterval| PgChapter {
                                    title: title.to_string(),
                                    time,
                                })
                        })
                        .collect::<Vec<PgChapter>>()
                })
                .unwrap_or_default();

            sqlx::query(statement)
                .bind(slugify(&format!("{} {}", episode.show, title)))
                .bind(title)
                .bind(&episode.show)
                .bind(episode.published_at)
                .bind(&episode.youtube_id)
                .bind(episode.youtube_category)
                .bind(&links)
                .bind(&chapters)
                .bind(episode.draft)
                .execute(pool)
                .await
                .into_diagnostic()?;
        }

        Ok(())
    } else {
        Err(miette!("Format of file is not supported"))
    }
}
