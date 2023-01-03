use crate::{
    command::get_paths,
    model::{Episodes, Insert, People, Shows, Technologies},
};
use hcl::from_str;
use miette::{miette, ErrReport, IntoDiagnostic, Result};
use native_tls::TlsConnector;
use postgres::{config::SslMode, Client, Config, NoTls};
use postgres_native_tls::MakeTlsConnector;
use std::{fs::read_to_string, path::PathBuf, str::FromStr};

pub fn sync(path: PathBuf, apply: bool) -> Result<()> {
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

    let mut client = if let Ok(database_string) = std::env::var("POSTGRESQL_CONNECTION_STRING") {
        let config = Config::from_str(&database_string).into_diagnostic()?;

        match config.get_ssl_mode() {
            SslMode::Require | SslMode::Prefer => {
                let connector = TlsConnector::builder().build().into_diagnostic()?;
                let connector = MakeTlsConnector::new(connector);

                config.connect(connector).into_diagnostic()?
            }
            _ => config.connect(NoTls).into_diagnostic()?,
        }
    } else {
        let database_string = "postgres://academy:academy@localhost:5432/academy";

        let config = Config::from_str(database_string).into_diagnostic()?;

        config.connect(NoTls).into_diagnostic()?
    };

    for file in files {
        if let Ok(content) = read_to_string(&file) {
            if let Ok(insert_trait) = try_parse(&content) {
                if apply {
                    match insert(&mut client, insert_trait) {
                        Ok(_) => println!("{} - OK", file.display()),
                        Err(error) => eprintln!("{} - NOT OK: {:#?}", file.display(), error),
                    }
                } else {
                    println!("{} - DRY RUN", file.display());
                }
            } else {
                eprintln!("{} - NOT OK", file.display());
            }
        }
    }

    Ok(())
}

fn insert(client: &mut Client, insert: Box<dyn Insert>) -> Result<()> {
    let (results, errors): (Vec<_>, Vec<_>) =
        insert.insert(client).into_iter().partition(Result::is_ok);

    for result in results {
        result.unwrap();
    }

    if errors.is_empty() {
        Ok(())
    } else {
        let errors = errors
            .into_iter()
            .map(|result| result.err().unwrap())
            .collect::<Vec<ErrReport>>();

        Err(miette!("{:#?}", errors))
    }
}

fn try_parse(content: &str) -> Result<Box<dyn Insert>> {
    if let Ok(content) = from_str::<Shows>(content) {
        Ok(Box::new(content))
    } else if let Ok(content) = from_str::<Technologies>(content) {
        Ok(Box::new(content))
    } else if let Ok(content) = from_str::<People>(content) {
        Ok(Box::new(content))
    } else if let Ok(content) = from_str::<Episodes>(content) {
        Ok(Box::new(content))
    } else {
        Err(miette!("Format of file is not supported"))
    }
}
