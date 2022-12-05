use inquire::Select;
use std::fmt::Display;

// Commands
mod sync;

// Schema
mod people;
mod shows;
mod technologies;

enum Commands {
    CreateNewTechnology,
    Sync,
}

impl Display for Commands {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Commands::CreateNewTechnology => write!(f, "Create a New Technology"),
            Commands::Sync => write!(f, "Sync"),
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let command_list: Vec<Commands> = vec![Commands::CreateNewTechnology, Commands::Sync];

    match Select::new("What would you like to do?", command_list).prompt() {
        Ok(Commands::CreateNewTechnology) => technologies::create(),
        Ok(Commands::Sync) => sync::run().await?,
        Err(_) => println!("I'm a little confused. Let's try again later."),
    }

    Ok(())
}
