use inquire::Text;

pub fn create() {
    let name = Text::new("What is your name?").prompt().unwrap();

    println!("Creating {}", name);
}
