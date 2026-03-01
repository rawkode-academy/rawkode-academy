use anyhow::{anyhow, Context, Result};
use clap::Args;
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use std::time::Duration;
use uuid::Uuid;

use crate::{
    api::{self, CloudInitResponse},
    state::{self, PlaygroundState, ResourceAllocation},
    utils,
    vm::{self, VmConfig, VmProvider},
};

#[derive(Args)]
pub struct StartArgs {
    /// Course ID to start
    course_id: String,

    /// VM provider to use (auto, lima, docker)
    #[arg(long, default_value = "auto")]
    provider: String,

    /// Number of CPUs for the VM
    #[arg(long, default_value = "2")]
    cpus: u32,

    /// Memory in GB for the VM
    #[arg(long, default_value = "4")]
    memory: u32,

    /// Disk size in GB for the VM
    #[arg(long, default_value = "20")]
    disk: u32,

    /// Force recreation if already exists
    #[arg(long, short)]
    force: bool,
}

pub async fn execute(args: StartArgs, api_endpoint: &str) -> Result<()> {
    // Check if already running
    if let Ok(state) = state::load() {
        if state.status == "running" && !args.force {
            return Err(anyhow!(
                "Playground already running for course {}. Use --force to recreate.",
                state.course_id.yellow()
            ));
        }
    }

    // Fetch cloud-init from API
    let spinner = create_spinner("Fetching playground configuration...");
    
    let api_client = api::Client::new(api_endpoint)?;
    let cloud_init_response = api_client
        .get_cloud_init(&args.course_id)
        .await
        .context("Failed to fetch playground configuration")?;
    
    spinner.finish_with_message(format!("✅ Configuration fetched for {}", args.course_id.green()));

    // Check system resources
    check_resources(&cloud_init_response, &args)?;

    // Get VM provider
    let provider = vm::get_provider(&args.provider)?;

    // Create and start VM
    let spinner = create_spinner("Creating virtual machine...");
    
    let vm_name = format!("rka-{}-{}", args.course_id, Uuid::new_v4().to_string().split('-').next().unwrap());
    let vm_config = VmConfig {
        name: vm_name.clone(),
        image: "ubuntu-22.04".to_string(),
        cpus: args.cpus.max(cloud_init_response.requirements.min_cpus),
        memory_gb: args.memory.max(cloud_init_response.requirements.min_memory_gb),
        disk_gb: args.disk.max(cloud_init_response.requirements.min_disk_gb),
        cloud_init: cloud_init_response.cloud_init,
    };

    provider.create_vm(&vm_config).await
        .context("Failed to create VM")?;
    
    provider.start_vm(&vm_name).await
        .context("Failed to start VM")?;
    
    spinner.finish_with_message("✅ Virtual machine created");

    // Wait for services
    let spinner = create_spinner("Waiting for services to start...");
    wait_for_services(&*provider, &vm_name).await?;
    spinner.finish_with_message("✅ Services are ready");

    // Setup port forwarding
    let ports = vec![3080, 8080, 8443, 6443]; // Teleport, HTTP, HTTPS, K8s API
    for port in &ports {
        provider.forward_port(&vm_name, *port, *port).await?;
    }

    // Save state
    let state = PlaygroundState {
        course_id: args.course_id.clone(),
        vm_name: vm_name.clone(),
        vm_provider: provider.name().to_string(),
        status: "running".to_string(),
        started_at: chrono::Utc::now(),
        teleport_url: "http://localhost:3080".to_string(),
        resources: ResourceAllocation {
            cpus: vm_config.cpus,
            memory_gb: vm_config.memory_gb,
            disk_gb: vm_config.disk_gb,
        },
    };
    
    state::save(&state)?;

    // Show success message
    print_success(&args.course_id);

    // Track provision event (async, don't wait)
    tokio::spawn(async move {
        let _ = api_client.track_provision(&args.course_id).await;
    });

    Ok(())
}

fn create_spinner(message: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} {msg}")
            .unwrap()
            .tick_chars("⠁⠂⠄⡀⢀⠠⠐⠈ "),
    );
    pb.set_message(message.to_string());
    pb.enable_steady_tick(Duration::from_millis(100));
    pb
}

fn check_resources(response: &CloudInitResponse, _args: &StartArgs) -> Result<()> {
    let required_cpus = response.requirements.min_cpus;
    let required_memory = response.requirements.min_memory_gb;
    
    let available_cpus = utils::get_available_cpus()?;
    let available_memory = utils::get_available_memory_gb()?;
    
    if available_cpus < required_cpus {
        return Err(anyhow!(
            "Insufficient CPUs: {} required, {} available",
            required_cpus, available_cpus
        ));
    }
    
    if available_memory < required_memory {
        return Err(anyhow!(
            "Insufficient memory: {}GB required, {}GB available",
            required_memory, available_memory
        ));
    }
    
    Ok(())
}

async fn wait_for_services(provider: &dyn VmProvider, vm_name: &str) -> Result<()> {
    let max_attempts = 60; // 5 minutes with 5 second intervals
    let mut attempts = 0;
    
    loop {
        if provider.is_service_ready(vm_name, 3080).await? {
            break;
        }
        
        attempts += 1;
        if attempts >= max_attempts {
            return Err(anyhow!("Timeout waiting for services to start"));
        }
        
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
    
    Ok(())
}

fn print_success(course_id: &str) {
    println!();
    println!("{}", "🎉 Playground is ready!".green().bold());
    println!();
    println!("  Course: {}", course_id.yellow());
    println!("  Web Terminal: {}", "http://localhost:3080".cyan().underline());
    println!();
    println!("To access your playground:");
    println!("  • Open {} in your browser", "http://localhost:3080".cyan());
    println!("  • Or run: {}", "rka exec bash".white().dimmed());
    println!();
    println!("To stop the playground: {}", "rka stop".white().dimmed());
}