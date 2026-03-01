use anyhow::Result;
use clap::{Args, CommandFactory};
use clap_complete::{generate, Shell};
use std::io;

use crate::Cli;

#[derive(Args)]
pub struct CompletionArgs {
    /// Shell to generate completions for
    #[arg(value_enum)]
    shell: Shell,
}

pub fn execute(args: CompletionArgs) -> Result<()> {
    let mut cmd = Cli::command();
    let name = cmd.get_name().to_string();
    generate(args.shell, &mut cmd, name, &mut io::stdout());
    Ok(())
}