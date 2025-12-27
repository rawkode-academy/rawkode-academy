use anyhow::Result;
use clap::Args;
use colored::Colorize;

use crate::api;

#[derive(Args)]
pub struct ListArgs {
    /// Filter by difficulty (beginner, intermediate, advanced)
    #[arg(long, short)]
    difficulty: Option<String>,
}

pub async fn execute(args: ListArgs, api_endpoint: &str) -> Result<()> {
    let client = api::Client::new(api_endpoint)?;
    let mut courses = client.list_courses().await?;
    
    // Filter by difficulty if specified
    if let Some(difficulty) = args.difficulty {
        courses.retain(|c| c.difficulty.eq_ignore_ascii_case(&difficulty));
    }
    
    if courses.is_empty() {
        println!("No courses found");
        return Ok(());
    }
    
    println!("📚 Available Courses");
    println!();
    
    for course in courses {
        let difficulty_color = match course.difficulty.to_lowercase().as_str() {
            "beginner" => "green",
            "intermediate" => "yellow",
            "advanced" => "red",
            _ => "white",
        };
        
        println!("  {} {}", 
            course.id.cyan().bold(),
            format!("[{}]", course.difficulty).color(difficulty_color)
        );
        println!("  {}", course.name.bold());
        println!("  {}", course.description.dimmed());
        println!("  Duration: {} minutes", course.duration_minutes);
        println!();
    }
    
    println!("To start a course: {}", "rka start <course-id>".white().dimmed());
    
    Ok(())
}