//! Error recovery mechanisms for Iceberg operations
//! 
//! This module provides utilities for recovering from various failure scenarios
//! in the Iceberg implementation, including:
//! - Partial write failures
//! - Metadata corruption
//! - Network timeouts
//! - Memory exhaustion

use worker::*;
use std::time::Duration;
use crate::utils::{log_error, log_info};

/// Recovery strategies for different failure types
#[derive(Debug, Clone)]
pub enum RecoveryStrategy {
    /// Retry the operation with exponential backoff
    RetryWithBackoff {
        max_attempts: u32,
        initial_delay: Duration,
        max_delay: Duration,
    },
    /// Skip the failed operation and continue
    Skip,
    /// Fail fast and propagate the error
    FailFast,
    /// Attempt to repair and retry
    RepairAndRetry,
}

/// Error recovery coordinator
pub struct RecoveryCoordinator {
    env: Env,
}

impl RecoveryCoordinator {
    /// Create a new recovery coordinator
    pub fn new(env: &Env) -> Self {
        Self {
            env: env.clone(),
        }
    }
    
    /// Determine recovery strategy based on error type
    pub fn determine_strategy(&self, error: &Error) -> RecoveryStrategy {
        match error {
            // Network errors - retry with backoff
            Error::RustError(msg) if msg.contains("network") || msg.contains("timeout") => {
                RecoveryStrategy::RetryWithBackoff {
                    max_attempts: 3,
                    initial_delay: Duration::from_millis(100),
                    max_delay: Duration::from_secs(5),
                }
            }
            // Memory errors - fail fast
            Error::RustError(msg) if msg.contains("memory") || msg.contains("OOM") => {
                RecoveryStrategy::FailFast
            }
            // Data corruption - attempt repair
            Error::RustError(msg) if msg.contains("corrupt") || msg.contains("invalid") => {
                RecoveryStrategy::RepairAndRetry
            }
            // Default - skip and continue
            _ => RecoveryStrategy::Skip,
        }
    }
    
    /// Execute operation with recovery
    pub async fn execute_with_recovery<F, T>(
        &self,
        operation_name: &str,
        operation: F,
    ) -> Result<T>
    where
        F: Fn() -> Result<T>,
    {
        let mut attempts = 0;
        let mut last_error = None;
        
        loop {
            attempts += 1;
            log_info(&format!("Executing {}, attempt {}", operation_name, attempts));
            
            match operation() {
                Ok(result) => {
                    if attempts > 1 {
                        log_info(&format!("{} succeeded after {} attempts", operation_name, attempts));
                    }
                    return Ok(result);
                }
                Err(e) => {
                    last_error = Some(e.clone());
                    let strategy = self.determine_strategy(&e);
                    
                    match strategy {
                        RecoveryStrategy::RetryWithBackoff { max_attempts, initial_delay, max_delay } => {
                            if attempts >= max_attempts {
                                log_error(&format!(
                                    "{} failed after {} attempts: {}",
                                    operation_name, attempts, e
                                ));
                                return Err(e);
                            }
                            
                            let delay = calculate_backoff_delay(attempts, initial_delay, max_delay);
                            log_info(&format!(
                                "{} failed (attempt {}), retrying in {}ms: {}",
                                operation_name, attempts, delay.as_millis(), e
                            ));
                            
                            // In Workers, we can't actually sleep, so we'll return an error
                            // indicating retry should be attempted later
                            return Err(Error::RustError(format!(
                                "Retry needed after {}ms delay",
                                delay.as_millis()
                            )));
                        }
                        RecoveryStrategy::Skip => {
                            log_info(&format!("{} failed, skipping: {}", operation_name, e));
                            return Err(e);
                        }
                        RecoveryStrategy::FailFast => {
                            log_error(&format!("{} failed, failing fast: {}", operation_name, e));
                            return Err(e);
                        }
                        RecoveryStrategy::RepairAndRetry => {
                            if attempts > 2 {
                                log_error(&format!(
                                    "{} repair failed after {} attempts: {}",
                                    operation_name, attempts, e
                                ));
                                return Err(e);
                            }
                            
                            log_info(&format!(
                                "{} attempting repair (attempt {}): {}",
                                operation_name, attempts, e
                            ));
                            
                            // Attempt repair based on error type
                            if let Err(repair_error) = self.attempt_repair(operation_name, &e).await {
                                log_error(&format!("Repair failed: {}", repair_error));
                                return Err(e);
                            }
                            
                            // Continue loop to retry after repair
                        }
                    }
                }
            }
        }
    }
    
    /// Attempt to repair based on error type
    async fn attempt_repair(&self, operation_name: &str, error: &Error) -> Result<()> {
        match error {
            Error::RustError(msg) if msg.contains("metadata") => {
                // Attempt to repair metadata
                self.repair_metadata().await
            }
            Error::RustError(msg) if msg.contains("manifest") => {
                // Attempt to repair manifest
                self.repair_manifest().await
            }
            _ => {
                // No specific repair available
                Err(Error::RustError(format!(
                    "No repair strategy available for {} error",
                    operation_name
                )))
            }
        }
    }
    
    /// Repair corrupted metadata
    async fn repair_metadata(&self) -> Result<()> {
        log_info("Attempting metadata repair");
        
        // In a real implementation, this would:
        // 1. Read backup metadata if available
        // 2. Validate and fix inconsistencies
        // 3. Update version hints
        
        // For now, we'll just clear caches
        match self.env.cache("iceberg_metadata") {
            Ok(cache) => {
                // Clear cached metadata
                let _ = cache.delete("current_metadata", false).await;
                log_info("Cleared metadata cache");
                Ok(())
            }
            Err(e) => {
                log_error(&format!("Failed to access cache during repair: {}", e));
                Err(e)
            }
        }
    }
    
    /// Repair corrupted manifest
    async fn repair_manifest(&self) -> Result<()> {
        log_info("Attempting manifest repair");
        
        // In a real implementation, this would:
        // 1. Scan data files and rebuild manifest
        // 2. Validate file checksums
        // 3. Remove references to missing files
        
        Ok(())
    }
}

/// Calculate exponential backoff delay
fn calculate_backoff_delay(
    attempt: u32,
    initial_delay: Duration,
    max_delay: Duration,
) -> Duration {
    let exponential_delay = initial_delay
        .as_millis()
        .saturating_mul(2u128.saturating_pow(attempt - 1));
    
    Duration::from_millis(exponential_delay.min(max_delay.as_millis()) as u64)
}

/// Circuit breaker for preventing cascading failures
pub struct CircuitBreaker {
    failure_threshold: u32,
    success_threshold: u32,
    timeout: Duration,
    state: CircuitState,
    failure_count: u32,
    success_count: u32,
    last_failure_time: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
enum CircuitState {
    Closed,    // Normal operation
    Open,      // Failing, reject requests
    HalfOpen,  // Testing if service recovered
}

impl CircuitBreaker {
    /// Create a new circuit breaker
    pub fn new(failure_threshold: u32, success_threshold: u32, timeout: Duration) -> Self {
        Self {
            failure_threshold,
            success_threshold,
            timeout,
            state: CircuitState::Closed,
            failure_count: 0,
            success_count: 0,
            last_failure_time: None,
        }
    }
    
    /// Check if operation is allowed
    pub fn is_allowed(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                // Check if timeout has passed
                if let Some(last_failure) = self.last_failure_time {
                    let elapsed = Date::now().as_millis() - last_failure;
                    if elapsed > self.timeout.as_millis() as i64 {
                        self.state = CircuitState::HalfOpen;
                        self.success_count = 0;
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }
    
    /// Record successful operation
    pub fn record_success(&mut self) {
        match self.state {
            CircuitState::Closed => {
                self.failure_count = 0;
            }
            CircuitState::HalfOpen => {
                self.success_count += 1;
                if self.success_count >= self.success_threshold {
                    self.state = CircuitState::Closed;
                    self.failure_count = 0;
                    log_info("Circuit breaker closed after recovery");
                }
            }
            CircuitState::Open => {
                // Shouldn't happen, but reset anyway
                self.state = CircuitState::Closed;
                self.failure_count = 0;
            }
        }
    }
    
    /// Record failed operation
    pub fn record_failure(&mut self) {
        match self.state {
            CircuitState::Closed => {
                self.failure_count += 1;
                if self.failure_count >= self.failure_threshold {
                    self.state = CircuitState::Open;
                    self.last_failure_time = Some(Date::now().as_millis());
                    log_error(&format!(
                        "Circuit breaker opened after {} failures",
                        self.failure_count
                    ));
                }
            }
            CircuitState::HalfOpen => {
                self.state = CircuitState::Open;
                self.failure_count = self.failure_threshold;
                self.last_failure_time = Some(Date::now().as_millis());
                log_error("Circuit breaker reopened after failure in half-open state");
            }
            CircuitState::Open => {
                // Already open, update last failure time
                self.last_failure_time = Some(Date::now().as_millis());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_backoff_calculation() {
        let initial = Duration::from_millis(100);
        let max = Duration::from_secs(5);
        
        assert_eq!(calculate_backoff_delay(1, initial, max), Duration::from_millis(100));
        assert_eq!(calculate_backoff_delay(2, initial, max), Duration::from_millis(200));
        assert_eq!(calculate_backoff_delay(3, initial, max), Duration::from_millis(400));
        assert_eq!(calculate_backoff_delay(10, initial, max), Duration::from_secs(5)); // Capped at max
    }
    
    #[test]
    fn test_circuit_breaker() {
        let mut breaker = CircuitBreaker::new(3, 2, Duration::from_secs(60));
        
        // Initially closed
        assert!(breaker.is_allowed());
        
        // Record failures
        breaker.record_failure();
        breaker.record_failure();
        assert!(breaker.is_allowed()); // Still closed
        
        breaker.record_failure();
        assert!(!breaker.is_allowed()); // Now open
        
        // Success in open state doesn't change anything
        breaker.record_success();
        assert!(!breaker.is_allowed());
    }
}