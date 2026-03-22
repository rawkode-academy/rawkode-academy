use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaygroundState {
    pub course_id: String,
    pub vm_name: String,
    pub vm_provider: String,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub teleport_url: String,
    pub resources: ResourceAllocation,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceAllocation {
    pub cpus: u32,
    pub memory_gb: u32,
    pub disk_gb: u32,
}

fn get_state_file() -> Result<PathBuf> {
    let proj_dirs = ProjectDirs::from("academy", "rawkode", "rka")
        .context("Failed to determine project directories")?;
    
    let data_dir = proj_dirs.data_dir();
    fs::create_dir_all(data_dir)?;
    
    Ok(data_dir.join("state.json"))
}

pub fn save(state: &PlaygroundState) -> Result<()> {
    let state_file = get_state_file()?;
    let json = serde_json::to_string_pretty(state)?;
    fs::write(&state_file, json)
        .with_context(|| format!("Failed to write state to {:?}", state_file))?;
    Ok(())
}

pub fn load() -> Result<PlaygroundState> {
    let state_file = get_state_file()?;
    let contents = fs::read_to_string(&state_file)
        .with_context(|| format!("Failed to read state from {:?}", state_file))?;
    let state = serde_json::from_str(&contents)
        .context("Failed to parse state file")?;
    Ok(state)
}

pub fn delete() -> Result<()> {
    let state_file = get_state_file()?;
    if state_file.exists() {
        fs::remove_file(&state_file)
            .with_context(|| format!("Failed to delete state file {:?}", state_file))?;
    }
    Ok(())
}

#[allow(dead_code)]
pub fn exists() -> bool {
    get_state_file()
        .map(|path| path.exists())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests;