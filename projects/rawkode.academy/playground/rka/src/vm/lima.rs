use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use base64::{Engine as _, engine::general_purpose};
use serde_yaml::Value;
use std::path::PathBuf;
use std::process::Command;
use tempfile::NamedTempFile;
use tokio::process::Command as TokioCommand;
use which::which;

use super::{VmConfig, VmProvider, VmStatus};

pub struct LimaProvider {
    lima_path: PathBuf,
}

impl LimaProvider {
    pub fn new() -> Result<Self> {
        let lima_path = which("limactl").context("limactl not found. Please install Lima.")?;
        Ok(Self { lima_path })
    }

    async fn write_lima_config(&self, config: &VmConfig) -> Result<PathBuf> {
        let mut lima_config = serde_yaml::from_str::<Value>(
            r#"
images:
  - location: "https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-amd64.img"
    arch: "x86_64"
  - location: "https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-arm64.img"
    arch: "aarch64"

mounts:
  - location: "~"
    writable: false
  - location: "/tmp/lima"
    writable: true

ssh:
  localPort: 0
  loadDotSSHPubKeys: true

containerd:
  system: false
  user: false

provision:
  - mode: system
    script: |
      #!/bin/bash
      set -eux -o pipefail
      export DEBIAN_FRONTEND=noninteractive
"#,
        )?;

        // Add resource specifications
        lima_config["cpus"] = config.cpus.into();
        lima_config["memory"] = format!("{}GiB", config.memory_gb).into();
        lima_config["disk"] = format!("{}GiB", config.disk_gb).into();

        // Add cloud-init
        let cloud_init_b64 = general_purpose::STANDARD.encode(&config.cloud_init);
        lima_config["provision"][0]["script"] = format!(
            r#"#!/bin/bash
set -eux -o pipefail
export DEBIAN_FRONTEND=noninteractive

# Decode and apply cloud-init
echo '{}' | base64 -d > /tmp/user-data
cloud-init clean
cloud-init init --file /tmp/user-data
cloud-init modules --mode=config
cloud-init modules --mode=final
"#,
            cloud_init_b64
        )
        .into();

        // Write to temporary file
        let temp_file = NamedTempFile::new()?;
        serde_yaml::to_writer(&temp_file, &lima_config)?;
        
        Ok(temp_file.into_temp_path().to_path_buf())
    }
}

#[async_trait]
impl VmProvider for LimaProvider {
    fn name(&self) -> &str {
        "lima"
    }

    async fn is_available(&self) -> bool {
        Command::new(&self.lima_path)
            .arg("list")
            .output()
            .is_ok()
    }

    async fn create_vm(&self, config: &VmConfig) -> Result<()> {
        // Write Lima configuration
        let config_path = self.write_lima_config(config).await?;

        // Create VM
        let output = TokioCommand::new(&self.lima_path)
            .arg("start")
            .arg("--name")
            .arg(&config.name)
            .arg(&config_path)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Failed to create VM: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    async fn start_vm(&self, name: &str) -> Result<()> {
        let output = TokioCommand::new(&self.lima_path)
            .arg("start")
            .arg(name)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Failed to start VM: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    async fn stop_vm(&self, name: &str) -> Result<()> {
        let output = TokioCommand::new(&self.lima_path)
            .arg("stop")
            .arg(name)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Failed to stop VM: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    async fn destroy_vm(&self, name: &str) -> Result<()> {
        let output = TokioCommand::new(&self.lima_path)
            .arg("delete")
            .arg("--force")
            .arg(name)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Failed to destroy VM: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    async fn vm_status(&self, name: &str) -> Result<VmStatus> {
        let output = TokioCommand::new(&self.lima_path)
            .arg("list")
            .arg("--json")
            .output()
            .await?;

        if !output.status.success() {
            return Ok(VmStatus::NotFound);
        }

        let vms: Vec<serde_json::Value> = serde_json::from_slice(&output.stdout)?;
        
        for vm in vms {
            if vm["name"] == name {
                return match vm["status"].as_str() {
                    Some("Running") => Ok(VmStatus::Running),
                    Some("Stopped") => Ok(VmStatus::Stopped),
                    _ => Ok(VmStatus::NotFound),
                };
            }
        }

        Ok(VmStatus::NotFound)
    }

    async fn forward_port(&self, vm_name: &str, _host_port: u16, _vm_port: u16) -> Result<()> {
        // Lima handles port forwarding automatically via SSH
        // We just need to ensure the SSH tunnel is established
        let output = TokioCommand::new(&self.lima_path)
            .arg("shell")
            .arg(vm_name)
            .arg("--")
            .arg("true")
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!("Failed to setup port forwarding"));
        }

        Ok(())
    }

    async fn exec_command(&self, vm_name: &str, command: &[&str]) -> Result<String> {
        let mut cmd = TokioCommand::new(&self.lima_path);
        cmd.arg("shell").arg(vm_name).arg("--");
        
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
        let mut command = vec!["journalctl", "--no-pager"];
        
        let lines_str;
        if let Some(n) = lines {
            command.push("-n");
            lines_str = n.to_string();
            command.push(&lines_str);
        }

        self.exec_command(vm_name, &command).await
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