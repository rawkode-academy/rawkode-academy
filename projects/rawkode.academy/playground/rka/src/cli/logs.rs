use anyhow::{anyhow, Result};
use clap::Args;

use crate::{state, vm};

#[derive(Args)]
pub struct LogsArgs {
    /// Number of lines to show
    #[arg(long, short = 'n', default_value = "50")]
    lines: usize,
    
    /// Follow log output
    #[arg(long, short)]
    follow: bool,
}

pub async fn execute(args: LogsArgs) -> Result<()> {
    let state = state::load()
        .map_err(|_| anyhow!("No playground is currently running"))?;

    let provider = vm::get_provider(&state.vm_provider)?;
    
    if args.follow {
        // For follow mode, we'd need to implement streaming
        // For now, just show a message
        println!("Follow mode not yet implemented. Showing last {} lines:", args.lines);
    }
    
    let logs = provider.get_logs(&state.vm_name, Some(args.lines)).await?;
    print!("{}", logs);
    
    Ok(())
}