use anyhow::Result;
use std::fs;

pub fn get_available_cpus() -> Result<u32> {
    Ok(num_cpus::get() as u32)
}

pub fn get_available_memory_gb() -> Result<u32> {
    #[cfg(target_os = "linux")]
    {
        let meminfo = fs::read_to_string("/proc/meminfo")?;
        for line in meminfo.lines() {
            if line.starts_with("MemTotal:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let kb: u64 = parts[1].parse()?;
                    return Ok((kb / 1024 / 1024) as u32);
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("sysctl")
            .arg("-n")
            .arg("hw.memsize")
            .output()?;
        let bytes: u64 = String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse()?;
        return Ok((bytes / 1024 / 1024 / 1024) as u32);
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("wmic")
            .args(&["computersystem", "get", "TotalPhysicalMemory"])
            .output()?;
        let output_str = String::from_utf8_lossy(&output.stdout);
        for line in output_str.lines() {
            if let Ok(bytes) = line.trim().parse::<u64>() {
                return Ok((bytes / 1024 / 1024 / 1024) as u32);
            }
        }
    }

    // Fallback
    Ok(8)
}