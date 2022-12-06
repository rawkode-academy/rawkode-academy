use inquire::Select;
use std::fmt::Display;

mod loader;
mod people;
mod shows;
mod sync;
use sync::sync;
mod technologies;

enum Commands {
    Sync,
}

impl Display for Commands {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Commands::Sync => write!(f, "Sync"),
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let command_list: Vec<Commands> = vec![Commands::Sync];

    match Select::new("What would you like to do?", command_list).prompt() {
        Ok(Commands::Sync) => sync().await?,
        Err(_) => println!("I'm a little confused. Let's try again later."),
    }

    Ok(())
}
