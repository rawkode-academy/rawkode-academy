use anyhow::{anyhow, Result};
use clap::Args;

use crate::{state, vm};

#[derive(Args)]
pub struct ExecArgs {
    /// Command to execute
    #[arg(required = true)]
    command: Vec<String>,
    
    /// Run interactively
    #[arg(long, short)]
    interactive: bool,
}

pub async fn execute(args: ExecArgs) -> Result<()> {
    let state = state::load()
        .map_err(|_| anyhow!("No playground is currently running"))?;

    let provider = vm::get_provider(&state.vm_provider)?;
    
    let command: Vec<&str> = args.command.iter().map(|s| s.as_str()).collect();
    
    if args.interactive {
        // For interactive mode, we need to use the provider's shell directly
        // This is a simplified version - full implementation would need PTY support
        use std::process::Command;
        
        match provider.name() {
            "lima" => {
                Command::new("limactl")
                    .args(&["shell", &state.vm_name])
                    .status()?;
            }
            "docker" => {
                Command::new("docker")
                    .args(&["exec", "-it", &format!("rka-{}", state.vm_name)])
                    .args(&command)
                    .status()?;
            }
            _ => return Err(anyhow!("Interactive mode not supported for this provider")),
        }
    } else {
        let output = provider.exec_command(&state.vm_name, &command).await?;
        print!("{}", output);
    }
    
    Ok(())
}