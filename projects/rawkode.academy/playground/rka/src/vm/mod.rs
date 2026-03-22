use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::sync::Arc;

pub mod lima;
pub mod docker;

#[derive(Debug, Clone)]
pub struct VmConfig {
    pub name: String,
    #[allow(dead_code)]
    pub image: String,
    pub cpus: u32,
    pub memory_gb: u32,
    pub disk_gb: u32,
    pub cloud_init: String,
}

#[async_trait]
pub trait VmProvider: Send + Sync {
    fn name(&self) -> &str;
    
    async fn is_available(&self) -> bool;
    
    async fn create_vm(&self, config: &VmConfig) -> Result<()>;
    
    async fn start_vm(&self, name: &str) -> Result<()>;
    
    async fn stop_vm(&self, name: &str) -> Result<()>;
    
    async fn destroy_vm(&self, name: &str) -> Result<()>;
    
    async fn vm_status(&self, name: &str) -> Result<VmStatus>;
    
    async fn forward_port(&self, vm_name: &str, host_port: u16, vm_port: u16) -> Result<()>;
    
    async fn exec_command(&self, vm_name: &str, command: &[&str]) -> Result<String>;
    
    async fn get_logs(&self, vm_name: &str, lines: Option<usize>) -> Result<String>;
    
    async fn is_service_ready(&self, vm_name: &str, port: u16) -> Result<bool>;
}

#[derive(Debug, Clone, PartialEq)]
pub enum VmStatus {
    Running,
    Stopped,
    NotFound,
}

pub fn get_provider(name: &str) -> Result<Arc<dyn VmProvider>> {
    match name {
        "lima" => Ok(Arc::new(lima::LimaProvider::new()?)),
        "docker" => Ok(Arc::new(docker::DockerProvider::new()?)),
        "auto" => {
            // Try providers in order of preference
            if let Ok(lima) = lima::LimaProvider::new() {
                if tokio::runtime::Handle::current()
                    .block_on(lima.is_available())
                {
                    return Ok(Arc::new(lima));
                }
            }
            
            if let Ok(docker) = docker::DockerProvider::new() {
                if tokio::runtime::Handle::current()
                    .block_on(docker.is_available())
                {
                    return Ok(Arc::new(docker));
                }
            }
            
            Err(anyhow!("No suitable VM provider found. Install Lima or Docker."))
        }
        _ => Err(anyhow!("Unknown provider: {}", name)),
    }
}