use std::path::PathBuf;

use clap::Parser;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
pub(crate) struct Cli {
    pub(crate) file_path: PathBuf,
}
