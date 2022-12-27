use crate::cli::Cli;
use clap::Parser;
use cli::FileFormat;
use format::{Episodes, People, Shows, Technologies};
use glob::glob;
use hcl::from_str;
use miette::{IntoDiagnostic, Result};
use serde::de::DeserializeOwned;
use std::fs;
use std::path::PathBuf;

mod cli;
mod format;

fn check<T: DeserializeOwned>(files: Vec<PathBuf>) {
    for file in files {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Err(err) = from_str::<T>(&content).into_diagnostic() {
                eprintln!("{} - NOT OK\n {:?}", file.display(), err);
            } else {
                println!("{} - OK", file.display());
            }
        } else {
            eprintln!("{} - Cannot read file", file.display());
        }
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.subcommand {
        cli::SubCommand::Format(cli::Format { path: _ }) => {
            unimplemented!();
        }
        cli::SubCommand::Lint(cli::Lint { file_format, path }) => {
            let files: Vec<PathBuf> = if path.extension().map(|ext| ext == "hcl").unwrap_or(false) {
                vec![path]
            } else {
                glob(&format!("{}/**/*.hcl", path.display()))
                    .into_diagnostic()?
                    .flatten()
                    .collect::<Vec<PathBuf>>()
            };

            match file_format {
                FileFormat::Episode => check::<Episodes>(files),
                FileFormat::Show => check::<Shows>(files),
                FileFormat::Technology => check::<Technologies>(files),
                FileFormat::Person => check::<People>(files),
            };
        }
    }

    Ok(())
}
