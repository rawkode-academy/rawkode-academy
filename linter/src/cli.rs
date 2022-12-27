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
}

#[derive(Debug, Parser)]
pub struct Lint {
    #[arg(short, long, value_enum, default_value_t = FileFormat::Episode)]
    pub file_format: FileFormat,

    #[arg(short, long)]
    pub path: PathBuf,
}

#[derive(Debug, Subcommand)]
pub(crate) enum SubCommand {
    Format(Format),
    Lint(Lint),
}

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
pub(crate) struct Cli {
    #[clap(subcommand)]
    pub(crate) subcommand: SubCommand,
}
