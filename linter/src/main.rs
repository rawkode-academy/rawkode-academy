use crate::cli::Cli;
use clap::Parser;
use format::Episode;
use miette::{miette, IntoDiagnostic, Result};
use std::fs;

mod cli;
mod format;

fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.file_path.exists() {
        let content = fs::read_to_string(&cli.file_path).into_diagnostic()?;
        knuffel::parse::<Episode>(cli.file_path.display().to_string().as_str(), &content)
            .into_diagnostic()?;
    } else {
        return Err(miette!(
            "The file with path {:?} does not exist.",
            &cli.file_path
        ));
    }

    Ok(())
}
