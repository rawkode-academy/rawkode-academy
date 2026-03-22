use anyhow::{anyhow, Result};
use clap::Args;
use colored::Colorize;

use crate::{state, vm};

#[derive(Args)]
pub struct StopArgs {
    /// Keep the VM (don't destroy it)
    #[arg(long, short)]
    keep: bool,
}

pub async fn execute(args: StopArgs) -> Result<()> {
    let mut state = state::load()
        .map_err(|_| anyhow!("No playground is currently running"))?;

    let provider = vm::get_provider(&state.vm_provider)?;
    
    println!("🛑 Stopping playground for {}...", state.course_id.yellow());
    
    provider.stop_vm(&state.vm_name).await?;
    
    if !args.keep {
        println!("🗑️  Destroying VM...");
        provider.destroy_vm(&state.vm_name).await?;
        state::delete()?;
        println!("✅ Playground destroyed");
    } else {
        state.status = "stopped".to_string();
        state::save(&state)?;
        println!("✅ Playground stopped (use 'rka start' to resume)");
    }
    
    Ok(())
}