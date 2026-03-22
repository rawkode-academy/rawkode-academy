use anyhow::{anyhow, Result};
use clap::Args;
use colored::Colorize;

use crate::{state, vm};

#[derive(Args)]
pub struct PortForwardArgs {
    /// Local port
    local_port: u16,
    
    /// Remote port (defaults to same as local)
    remote_port: Option<u16>,
}

pub async fn execute(args: PortForwardArgs) -> Result<()> {
    let state = state::load()
        .map_err(|_| anyhow!("No playground is currently running"))?;

    let provider = vm::get_provider(&state.vm_provider)?;
    
    let remote_port = args.remote_port.unwrap_or(args.local_port);
    
    println!("🔌 Forwarding port {} -> {}", args.local_port, remote_port);
    
    provider.forward_port(&state.vm_name, args.local_port, remote_port).await?;
    
    println!("✅ Port forwarding established");
    println!("   Access at: {}", format!("http://localhost:{}", args.local_port).cyan().underline());
    println!();
    println!("Press Ctrl+C to stop forwarding");
    
    // Keep the process running
    tokio::signal::ctrl_c().await?;
    
    Ok(())
}