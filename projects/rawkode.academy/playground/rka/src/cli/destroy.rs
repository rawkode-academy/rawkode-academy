use anyhow::{anyhow, Result};
use clap::Args;
use colored::Colorize;

use crate::{state, vm};

#[derive(Args)]
pub struct DestroyArgs {
    /// Force destroy without confirmation
    #[arg(long, short)]
    force: bool,
}

pub async fn execute(args: DestroyArgs) -> Result<()> {
    let state = state::load()
        .map_err(|_| anyhow!("No playground is currently running"))?;

    if !args.force {
        println!("⚠️  This will destroy the playground for {}", state.course_id.yellow());
        println!("   All data will be lost!");
        println!();
        print!("Are you sure? [y/N] ");
        
        use std::io::{self, Write};
        io::stdout().flush()?;
        
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("Cancelled");
            return Ok(());
        }
    }

    let provider = vm::get_provider(&state.vm_provider)?;
    
    println!("🗑️  Destroying playground...");
    
    provider.destroy_vm(&state.vm_name).await?;
    state::delete()?;
    
    println!("✅ Playground destroyed");
    
    Ok(())
}