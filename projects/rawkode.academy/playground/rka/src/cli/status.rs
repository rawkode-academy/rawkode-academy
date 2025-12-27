use anyhow::{anyhow, Result};
use clap::Args;
use colored::Colorize;
use chrono::Utc;

use crate::{state, vm};

#[derive(Args)]
pub struct StatusArgs {
    /// Show detailed information
    #[arg(long, short)]
    detailed: bool,
}

pub async fn execute(args: StatusArgs) -> Result<()> {
    let state = state::load()
        .map_err(|_| anyhow!("No playground is currently running"))?;

    let provider = vm::get_provider(&state.vm_provider)?;
    let vm_status = provider.vm_status(&state.vm_name).await?;
    
    println!("📊 Playground Status");
    println!();
    println!("  Course: {}", state.course_id.yellow());
    println!("  Status: {}", format_status(&vm_status));
    println!("  Provider: {}", state.vm_provider);
    println!("  Started: {}", format_duration(&state.started_at));
    
    if args.detailed {
        println!();
        println!("  Resources:");
        println!("    CPUs: {}", state.resources.cpus);
        println!("    Memory: {}GB", state.resources.memory_gb);
        println!("    Disk: {}GB", state.resources.disk_gb);
        println!();
        println!("  VM Name: {}", state.vm_name);
    }
    
    if vm_status == vm::VmStatus::Running {
        println!();
        println!("  Access URL: {}", state.teleport_url.cyan().underline());
    }
    
    Ok(())
}

fn format_status(status: &vm::VmStatus) -> String {
    match status {
        vm::VmStatus::Running => "Running".green().to_string(),
        vm::VmStatus::Stopped => "Stopped".yellow().to_string(),
        vm::VmStatus::NotFound => "Not Found".red().to_string(),
    }
}

fn format_duration(start: &chrono::DateTime<Utc>) -> String {
    let duration = Utc::now() - *start;
    
    if duration.num_days() > 0 {
        format!("{} days ago", duration.num_days())
    } else if duration.num_hours() > 0 {
        format!("{} hours ago", duration.num_hours())
    } else if duration.num_minutes() > 0 {
        format!("{} minutes ago", duration.num_minutes())
    } else {
        "Just now".to_string()
    }
}