use crate::model::{
    Episodes, MinimalEpisodes, MinimalPeople, MinimalShows, MinimalTechnologies, People, Shows,
    Technologies,
};
use crate::utils::find_hcl_files;
use hcl::from_str;
use miette::{miette, IntoDiagnostic, Result};
use std::{fs::read_to_string, path::PathBuf};

pub fn command(path: PathBuf) -> Result<()> {
    let files = find_hcl_files(path)?;

    println!("Linting {} files", files.len());
    println!();

    let mut errors = false;

    for file in files {
        if let Ok(content) = read_to_string(&file) {
            match try_check(&content) {
                Ok(_) => println!("{} - OK", file.display()),
                Err(err) => {
                    // only parsing errors count towards exit code = 1
                    errors = true;

                    eprintln!("{} - NOT OK\n {:?}", file.display(), err)
                }
            }
        } else {
            eprintln!("{} - NOT OK", file.display());
        }
    }

    if errors {
        std::process::exit(1);
    }

    Ok(())
}

fn try_check(content: &str) -> Result<()> {
    if from_str::<MinimalEpisodes>(content).is_ok() {
        hcl::from_str::<Episodes>(content)
            .into_diagnostic()
            .map(|_| ())
    } else if from_str::<MinimalShows>(content).is_ok() {
        hcl::from_str::<Shows>(content)
            .into_diagnostic()
            .map(|_| ())
    } else if from_str::<MinimalTechnologies>(content).is_ok() {
        hcl::from_str::<Technologies>(content)
            .into_diagnostic()
            .map(|_| ())
    } else if from_str::<MinimalPeople>(content).is_ok() {
        hcl::from_str::<People>(content)
            .into_diagnostic()
            .map(|_| ())
    } else {
        Err(miette!("Format of file is not supported"))
    }
}
