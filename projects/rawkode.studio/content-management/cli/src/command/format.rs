use crate::{
    command::get_paths,
    model::{Episodes, People, Shows, Technologies},
};
use hcl::from_str;
use miette::{miette, IntoDiagnostic, Result};
use std::{
    fs::{read_to_string, write},
    path::PathBuf,
};

pub fn format(path: PathBuf, apply: bool) -> Result<()> {
    let files = get_paths(path);

    println!("Formatting {} files", files.len());
    println!();

    for file in files {
        if let Ok(content) = read_to_string(&file) {
            if let Ok(formatted_content) = try_parse(&content) {
                if apply {
                    write(&file, formatted_content).into_diagnostic()?;
                    println!("{} - OK", file.display())
                } else {
                    println!("{} - DRY RUN", file.display())
                }
            } else {
                eprintln!("{} - NOT OK", file.display());
            }
        }
    }

    Ok(())
}

fn try_parse(content: &str) -> Result<String> {
    if let Ok(content) = from_str::<Episodes>(content) {
        hcl::to_string(&content).into_diagnostic()
    } else if let Ok(content) = from_str::<Shows>(content) {
        hcl::to_string(&content).into_diagnostic()
    } else if let Ok(content) = from_str::<Technologies>(content) {
        hcl::to_string(&content).into_diagnostic()
    } else if let Ok(content) = from_str::<People>(content) {
        hcl::to_string(&content).into_diagnostic()
    } else {
        Err(miette!("Format of file is not supported"))
    }
}
