use glob::glob;
use miette::IntoDiagnostic;
use std::path::PathBuf;

pub mod format;
pub mod lint;
pub mod sync;

pub use format::*;
pub use lint::*;
pub use sync::*;

fn get_paths(path: PathBuf) -> Vec<PathBuf> {
    if path.extension().map(|ext| ext == "hcl").unwrap_or(false) {
        vec![path]
    } else {
        glob(&format!("{}/**/*.hcl", path.display()))
            .into_diagnostic()
            .unwrap()
            .flatten()
            .collect::<Vec<PathBuf>>()
    }
}
