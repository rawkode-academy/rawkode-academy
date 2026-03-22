use anyhow::Result;
use clap::Args;
use colored::Colorize;
use which::which;

use crate::{utils, vm::{self, VmProvider}};

#[derive(Args)]
pub struct DoctorArgs {
    /// Show verbose output
    #[arg(long, short)]
    verbose: bool,
}

pub async fn execute(_args: DoctorArgs) -> Result<()> {
    println!("🩺 Running system checks...");
    println!();
    
    let mut all_good = true;
    
    // Check system resources
    println!("System Resources:");
    let cpus = utils::get_available_cpus()?;
    let memory = utils::get_available_memory_gb()?;
    
    let cpu_status = if cpus >= 2 { "✅" } else { all_good = false; "⚠️" };
    let mem_status = if memory >= 4 { "✅" } else { all_good = false; "⚠️" };
    
    println!("  {} CPUs: {}", cpu_status, cpus);
    println!("  {} Memory: {}GB", mem_status, memory);
    
    if cpus < 2 {
        println!("     {} Minimum 2 CPUs recommended", "⚠️".yellow());
    }
    if memory < 4 {
        println!("     {} Minimum 4GB RAM recommended", "⚠️".yellow());
    }
    
    // Check VM providers
    println!();
    println!("VM Providers:");
    
    // Check Lima
    let lima_status = if which("limactl").is_ok() {
        if let Ok(provider) = vm::lima::LimaProvider::new() {
            if provider.is_available().await {
                "✅"
            } else {
                "⚠️"
            }
        } else {
            "❌"
        }
    } else {
        "❌"
    };
    
    println!("  {} Lima", lima_status);
    if lima_status == "❌" {
        println!("     Install: brew install lima");
    }
    
    // Check Docker
    let docker_status = if which("docker").is_ok() {
        if let Ok(provider) = vm::docker::DockerProvider::new() {
            if provider.is_available().await {
                "✅"
            } else {
                "⚠️"
            }
        } else {
            "❌"
        }
    } else {
        "❌"
    };
    
    println!("  {} Docker", docker_status);
    if docker_status == "❌" {
        println!("     Install: https://docker.com/get-started");
    } else if docker_status == "⚠️" {
        println!("     Docker is installed but not running");
    }
    
    if lima_status == "❌" && docker_status != "✅" {
        all_good = false;
        println!();
        println!("{} At least one VM provider must be available", "❌".red());
    }
    
    // Check other dependencies
    println!();
    println!("Dependencies:");
    
    let deps = vec![
        ("curl", "Required for downloads"),
        ("nc", "Required for port checking"),
    ];
    
    for (cmd, desc) in deps {
        let status = if which(cmd).is_ok() { "✅" } else { all_good = false; "❌" };
        println!("  {} {} - {}", status, cmd, desc);
    }
    
    // Check network connectivity
    println!();
    println!("Network:");
    
    let api_reachable = check_api_connectivity().await;
    let api_status = if api_reachable { "✅" } else { all_good = false; "❌" };
    
    println!("  {} API connectivity", api_status);
    if !api_reachable {
        println!("     Cannot reach api.rawkode.academy");
    }
    
    // Summary
    println!();
    if all_good {
        println!("{} All checks passed!", "✅".green().bold());
        println!("   You're ready to use RKA!");
    } else {
        println!("{} Some issues found", "⚠️".yellow().bold());
        println!("   Fix the issues above for the best experience");
    }
    
    Ok(())
}

async fn check_api_connectivity() -> bool {
    reqwest::get("https://api.rawkode.academy/health")
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}