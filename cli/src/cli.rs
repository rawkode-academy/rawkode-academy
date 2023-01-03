use std::path::PathBuf;

use clap::{Parser, Subcommand, ValueEnum};

#[derive(Debug, Clone, ValueEnum)]
pub enum FileFormat {
    Episode,
    Show,
    Technology,
    Person,
}

#[derive(Debug, Parser)]
pub struct Format {
    #[arg(short, long)]
    pub path: PathBuf,

    #[arg(short, long, default_value_t = false)]
    pub apply: bool,
}

#[derive(Debug, Parser)]
pub struct Lint {
    #[arg(short, long)]
    pub path: PathBuf,
}

#[derive(Debug, Parser)]
pub struct Sync {
    #[arg(short, long, default_value_t = false)]
    pub apply: bool,
}

#[derive(Debug, Subcommand)]
pub(crate) enum SubCommand {
    Sync(Sync),
    Format(Format),
    Lint(Lint),
}

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
pub(crate) struct Cli {
    #[clap(subcommand)]
    pub(crate) subcommand: SubCommand,
}
