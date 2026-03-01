use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use base64::{Engine as _, engine::general_purpose};
use std::path::PathBuf;
use tokio::process::Command as TokioCommand;
use which::which;

use super::{VmConfig, VmProvider, VmStatus};

pub struct DockerProvider {
    docker_path: PathBuf,
}

impl DockerProvider {
    pub fn new() -> Result<Self> {
        let docker_path = which("docker").context("docker not found. Please install Docker.")?;
        Ok(Self { docker_path })
    }

    fn get_container_name(&self, vm_name: &str) -> String {
        format!("rka-{}", vm_name)
    }
}

#[async_trait]
impl VmProvider for DockerProvider {
    fn name(&self) -> &str {
        "docker"
    }

    async fn is_available(&self) -> bool {
        TokioCommand::new(&self.docker_path)
            .arg("info")
            .output()
            .await
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    async fn create_vm(&self, config: &VmConfig) -> Result<()> {
        let container_name = self.get_container_name(&config.name);
        
        // Create a container with systemd support
        let mut cmd = TokioCommand::new(&self.docker_path);
        cmd.arg("run")
            .arg("-d")
            .arg("--name").arg(&container_name)
            .arg("--privileged")
            .arg("--cgroupns=host")
            .arg("-v").arg("/sys/fs/cgroup:/sys/fs/cgroup:rw")
            .arg("--tmpfs").arg("/run")
            .arg("--tmpfs").arg("/run/lock")
            .arg("--tmpfs").arg("/tmp")
            .arg("--cap-add").arg("SYS_ADMIN")
            .arg("--cap-add").arg("NET_ADMIN")
            .arg("--security-opt").arg("apparmor=unconfined")
            .arg("--security-opt").arg("seccomp=unconfined");

        // Resource limits
        cmd.arg("--cpus").arg(config.cpus.to_string())
            .arg("--memory").arg(format!("{}g", config.memory_gb));

        // Port mappings
        for port in &[3080, 8080, 8443, 6443] {
            cmd.arg("-p").arg(format!("{}:{}", port, port));
        }

        // Environment for cloud-init
        let cloud_init_b64 = general_purpose::STANDARD.encode(&config.cloud_init);
        cmd.arg("-e").arg(format!("CLOUD_INIT_DATA={}", cloud_init_b64));

        // Use Ubuntu image with systemd
        cmd.arg("ubuntu:22.04");
        cmd.arg("/sbin/init");

        let output = cmd.output().await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Failed to create container: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        // Apply cloud-init inside the container
        let apply_cloud_init = format!(
            r#"
apt-get update && apt-get install -y cloud-init
echo "$CLOUD_INIT_DATA" | base64 -d > /var/lib/cloud/seed/nocloud-net/user-data
touch /var/lib/cloud/seed/nocloud-net/meta-data
cloud-init clean
cloud-init init
cloud-init modules --mode=config
cloud-init modules --mode=final
"#
        );

        self.exec_command(&config.name, &["bash", "-c", &apply_cloud_init]).await?;

        Ok(())
    }

    async fn start_vm(&self, name: &str) -> Result<()> {
        let container_name = self.get_container_name(name);
        
        let output = TokioCommand::new(&self.docker_path)
            .arg("start")
            .arg(&container_name)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Failed to start container: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    async fn stop_vm(&self, name: &str) -> Result<()> {
        let container_name = self.get_container_name(name);
        
        let output = TokioCommand::new(&self.docker_path)
            .arg("stop")
            .arg(&container_name)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Failed to stop container: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    async fn destroy_vm(&self, name: &str) -> Result<()> {
        let container_name = self.get_container_name(name);
        
        // Stop first if running
        let _ = self.stop_vm(name).await;
        
        let output = TokioCommand::new(&self.docker_path)
            .arg("rm")
            .arg("-f")
            .arg(&container_name)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Failed to destroy container: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    async fn vm_status(&self, name: &str) -> Result<VmStatus> {
        let container_name = self.get_container_name(name);
        
        let output = TokioCommand::new(&self.docker_path)
            .arg("inspect")
            .arg("-f")
            .arg("{{.State.Status}}")
            .arg(&container_name)
            .output()
            .await?;

        if !output.status.success() {
            return Ok(VmStatus::NotFound);
        }

        let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
        
        match status.as_str() {
            "running" => Ok(VmStatus::Running),
            "exited" | "stopped" => Ok(VmStatus::Stopped),
            _ => Ok(VmStatus::NotFound),
        }
    }

    async fn forward_port(&self, _vm_name: &str, _host_port: u16, _vm_port: u16) -> Result<()> {
        // Ports are already forwarded via -p flags during container creation
        Ok(())
    }

    async fn exec_command(&self, vm_name: &str, command: &[&str]) -> Result<String> {
        let container_name = self.get_container_name(vm_name);
        
        let mut cmd = TokioCommand::new(&self.docker_path);
        cmd.arg("exec").arg(&container_name);
        
        for arg in command {
            cmd.arg(arg);
        }

        let output = cmd.output().await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    async fn get_logs(&self, vm_name: &str, lines: Option<usize>) -> Result<String> {
        let container_name = self.get_container_name(vm_name);
        
        let mut cmd = TokioCommand::new(&self.docker_path);
        cmd.arg("logs");
        
        if let Some(n) = lines {
            cmd.arg("--tail").arg(n.to_string());
        }
        
        cmd.arg(&container_name);

        let output = cmd.output().await?;

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    async fn is_service_ready(&self, vm_name: &str, port: u16) -> Result<bool> {
        let result = self
            .exec_command(
                vm_name,
                &["nc", "-z", "localhost", &port.to_string()],
            )
            .await;

        Ok(result.is_ok())
    }
}