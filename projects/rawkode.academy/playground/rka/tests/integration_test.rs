use assert_cmd::Command;
use predicates::prelude::*;

#[test]
fn test_cli_help() {
    let mut cmd = Command::cargo_bin("rka").unwrap();
    cmd.arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("Manage local playground environments"));
}

#[test]
fn test_cli_version() {
    let mut cmd = Command::cargo_bin("rka").unwrap();
    cmd.arg("--version")
        .assert()
        .success()
        .stdout(predicate::str::contains("rka"));
}

#[test]
fn test_doctor_command() {
    let mut cmd = Command::cargo_bin("rka").unwrap();
    cmd.arg("doctor")
        .assert()
        .success()
        .stdout(predicate::str::contains("Running system checks"));
}

#[test]
fn test_completion_bash() {
    let mut cmd = Command::cargo_bin("rka").unwrap();
    cmd.arg("completion")
        .arg("bash")
        .assert()
        .success()
        .stdout(predicate::str::contains("_rka()"));
}

#[test]
fn test_status_no_playground() {
    let mut cmd = Command::cargo_bin("rka").unwrap();
    cmd.arg("status")
        .assert()
        .failure()
        .stderr(predicate::str::contains("No playground is currently running"));
}

#[test]
fn test_invalid_command() {
    let mut cmd = Command::cargo_bin("rka").unwrap();
    cmd.arg("invalid-command")
        .assert()
        .failure();
}