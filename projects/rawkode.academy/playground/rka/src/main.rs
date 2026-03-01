use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod cli;
mod api;
mod state;
mod vm;
mod utils;

#[derive(Parser)]
#[command(
    name = "rka",
    about = "Rawkode Academy CLI",
    long_about = "Manage local playground environments for Rawkode Academy courses",
    version,
    author
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    #[arg(global = true, long, env = "RKA_API_ENDPOINT", default_value = "https://api.rawkode.academy/graphql")]
    api_endpoint: String,

    #[arg(global = true, long, short)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Start a playground environment
    Start(cli::start::StartArgs),
    
    /// Stop a running playground
    Stop(cli::stop::StopArgs),
    
    /// Show status of current playground
    Status(cli::status::StatusArgs),
    
    /// Destroy a playground environment
    Destroy(cli::destroy::DestroyArgs),
    
    /// List available courses
    List(cli::list::ListArgs),
    
    /// Show logs from the playground
    Logs(cli::logs::LogsArgs),
    
    /// Execute a command in the playground
    Exec(cli::exec::ExecArgs),
    
    /// Forward a port from the playground
    PortForward(cli::port_forward::PortForwardArgs),
    
    /// Check system compatibility and dependencies
    Doctor(cli::doctor::DoctorArgs),
    
    /// Generate shell completions
    Completion(cli::completion::CompletionArgs),
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    // Initialize logging
    let filter = if cli.verbose {
        "debug"
    } else {
        "error"
    };
    
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| filter.into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    // Handle commands
    match cli.command {
        Commands::Start(args) => cli::start::execute(args, &cli.api_endpoint).await,
        Commands::Stop(args) => cli::stop::execute(args).await,
        Commands::Status(args) => cli::status::execute(args).await,
        Commands::Destroy(args) => cli::destroy::execute(args).await,
        Commands::List(args) => cli::list::execute(args, &cli.api_endpoint).await,
        Commands::Logs(args) => cli::logs::execute(args).await,
        Commands::Exec(args) => cli::exec::execute(args).await,
        Commands::PortForward(args) => cli::port_forward::execute(args).await,
        Commands::Doctor(args) => cli::doctor::execute(args).await,
        Commands::Completion(args) => cli::completion::execute(args),
    }
}