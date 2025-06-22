use crate::iceberg::metadata::{Snapshot, TableMetadata};
use crate::iceberg::manifest::DataFile;
use crate::utils::{log_error, log_info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use worker::*;

/// REST API catalog client for R2 Data Catalog
/// This provides an alternative to direct R2 access when using a catalog service
pub struct RestCatalog {
    env: Env,
    catalog_endpoint: String,
    namespace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogNamespace {
    pub namespace: Vec<String>,
    pub properties: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableIdentifier {
    pub namespace: Vec<String>,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTableRequest {
    pub name: String,
    pub location: String,
    pub schema: serde_json::Value,
    pub partition_spec: Vec<PartitionField>,
    pub properties: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartitionField {
    pub source_id: i32,
    pub field_id: i32,
    pub name: String,
    pub transform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadTableResponse {
    pub metadata_location: String,
    pub metadata: TableMetadata,
    pub config: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitTableRequest {
    pub identifier: TableIdentifier,
    pub requirements: Vec<TableRequirement>,
    pub updates: Vec<TableUpdate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TableRequirement {
    #[serde(rename = "assert-current-schema-id")]
    AssertCurrentSchemaId { schema_id: i32 },
    #[serde(rename = "assert-last-assigned-field-id")]
    AssertLastAssignedFieldId { field_id: i32 },
    #[serde(rename = "assert-table-does-not-exist")]
    AssertTableDoesNotExist,
    #[serde(rename = "assert-table-uuid")]
    AssertTableUuid { uuid: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action")]
pub enum TableUpdate {
    #[serde(rename = "add-snapshot")]
    AddSnapshot { snapshot: Snapshot },
    #[serde(rename = "set-current-snapshot")]
    SetCurrentSnapshot { snapshot_id: i64 },
    #[serde(rename = "set-properties")]
    SetProperties { properties: HashMap<String, String> },
}

impl RestCatalog {
    /// Create a new REST catalog client
    pub fn new(env: Env, endpoint: String, namespace: String) -> Self {
        Self {
            env,
            catalog_endpoint: endpoint,
            namespace,
        }
    }

    /// Create a new table via REST API
    pub async fn create_table(
        &self,
        table_name: &str,
        schema: serde_json::Value,
        partition_spec: Vec<PartitionField>,
        properties: HashMap<String, String>,
    ) -> Result<TableMetadata> {
        let url = format!(
            "{}/v1/namespaces/{}/tables",
            self.catalog_endpoint, self.namespace
        );

        log_info(&format!("Creating table {} via REST API at {}", table_name, url));

        let request_body = CreateTableRequest {
            name: table_name.to_string(),
            location: format!("s3://{}/{}/{}", self.get_bucket_name(), self.namespace, table_name),
            schema,
            partition_spec,
            properties,
        };

        let body_json = match serde_json::to_string(&request_body) {
            Ok(json) => json,
            Err(e) => {
                let error_msg = format!("Failed to serialize create table request: {}", e);
                log_error(&error_msg);
                return Err(Error::RustError(error_msg));
            }
        };

        let mut headers = Headers::new();
        match headers.set("Content-Type", "application/json") {
            Ok(_) => {},
            Err(e) => {
                log_error(&format!("Failed to set content-type header: {}", e));
            }
        }

        // Add authorization if configured
        if let Ok(auth_token) = self.env.var("R2_CATALOG_AUTH_TOKEN") {
            match headers.set("Authorization", &format!("Bearer {}", auth_token.to_string())) {
                Ok(_) => {},
                Err(e) => {
                    log_error(&format!("Failed to set authorization header: {}", e));
                }
            }
        }

        let request = match Request::new_with_init(
            &url,
            RequestInit::new()
                .with_method(Method::Post)
                .with_headers(headers)
                .with_body(Some(body_json.into())),
        ) {
            Ok(req) => req,
            Err(e) => {
                let error_msg = format!("Failed to create request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        let mut response = match Fetch::Request(request).send().await {
            Ok(resp) => resp,
            Err(e) => {
                let error_msg = format!("Failed to send create table request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        if response.status_code() >= 400 {
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let error_msg = format!(
                "REST API returned error {}: {}",
                response.status_code(),
                error_body
            );
            log_error(&error_msg);
            return Err(Error::RustError(error_msg));
        }

        let response_body = match response.text().await {
            Ok(body) => body,
            Err(e) => {
                let error_msg = format!("Failed to read response body: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        let load_response: LoadTableResponse = match serde_json::from_str(&response_body) {
            Ok(resp) => resp,
            Err(e) => {
                let error_msg = format!("Failed to parse create table response: {}", e);
                log_error(&error_msg);
                return Err(Error::RustError(error_msg));
            }
        };

        Ok(load_response.metadata)
    }

    /// Load table metadata via REST API
    pub async fn load_table(&self, table_name: &str) -> Result<Option<TableMetadata>> {
        let url = format!(
            "{}/v1/namespaces/{}/tables/{}",
            self.catalog_endpoint, self.namespace, table_name
        );

        log_info(&format!("Loading table {} via REST API", table_name));

        let mut headers = Headers::new();
        match headers.set("Accept", "application/json") {
            Ok(_) => {},
            Err(e) => {
                log_error(&format!("Failed to set accept header: {}", e));
            }
        }

        // Add authorization if configured
        if let Ok(auth_token) = self.env.var("R2_CATALOG_AUTH_TOKEN") {
            match headers.set("Authorization", &format!("Bearer {}", auth_token.to_string())) {
                Ok(_) => {},
                Err(e) => {
                    log_error(&format!("Failed to set authorization header: {}", e));
                }
            }
        }

        let request = match Request::new_with_init(
            &url,
            RequestInit::new()
                .with_method(Method::Get)
                .with_headers(headers),
        ) {
            Ok(req) => req,
            Err(e) => {
                let error_msg = format!("Failed to create request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        let mut response = match Fetch::Request(request).send().await {
            Ok(resp) => resp,
            Err(e) => {
                let error_msg = format!("Failed to send load table request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        if response.status_code() == 404 {
            return Ok(None);
        }

        if response.status_code() >= 400 {
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let error_msg = format!(
                "REST API returned error {}: {}",
                response.status_code(),
                error_body
            );
            log_error(&error_msg);
            return Err(Error::RustError(error_msg));
        }

        let response_body = match response.text().await {
            Ok(body) => body,
            Err(e) => {
                let error_msg = format!("Failed to read response body: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        let load_response: LoadTableResponse = match serde_json::from_str(&response_body) {
            Ok(resp) => resp,
            Err(e) => {
                let error_msg = format!("Failed to parse load table response: {}", e);
                log_error(&error_msg);
                return Err(Error::RustError(error_msg));
            }
        };

        Ok(Some(load_response.metadata))
    }

    /// Commit table changes via REST API
    pub async fn commit_changes(
        &self,
        table_name: &str,
        requirements: Vec<TableRequirement>,
        updates: Vec<TableUpdate>,
    ) -> Result<TableMetadata> {
        let url = format!(
            "{}/v1/namespaces/{}/tables/{}",
            self.catalog_endpoint, self.namespace, table_name
        );

        log_info(&format!(
            "Committing {} updates to table {} via REST API",
            updates.len(),
            table_name
        ));

        let request_body = CommitTableRequest {
            identifier: TableIdentifier {
                namespace: vec![self.namespace.clone()],
                name: table_name.to_string(),
            },
            requirements,
            updates,
        };

        let body_json = match serde_json::to_string(&request_body) {
            Ok(json) => json,
            Err(e) => {
                let error_msg = format!("Failed to serialize commit request: {}", e);
                log_error(&error_msg);
                return Err(Error::RustError(error_msg));
            }
        };

        let mut headers = Headers::new();
        match headers.set("Content-Type", "application/json") {
            Ok(_) => {},
            Err(e) => {
                log_error(&format!("Failed to set content-type header: {}", e));
            }
        }

        // Add authorization if configured
        if let Ok(auth_token) = self.env.var("R2_CATALOG_AUTH_TOKEN") {
            match headers.set("Authorization", &format!("Bearer {}", auth_token.to_string())) {
                Ok(_) => {},
                Err(e) => {
                    log_error(&format!("Failed to set authorization header: {}", e));
                }
            }
        }

        let request = match Request::new_with_init(
            &url,
            RequestInit::new()
                .with_method(Method::Post)
                .with_headers(headers)
                .with_body(Some(body_json.into())),
        ) {
            Ok(req) => req,
            Err(e) => {
                let error_msg = format!("Failed to create request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        let mut response = match Fetch::Request(request).send().await {
            Ok(resp) => resp,
            Err(e) => {
                let error_msg = format!("Failed to send commit request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        if response.status_code() >= 400 {
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let error_msg = format!(
                "REST API returned error {}: {}",
                response.status_code(),
                error_body
            );
            log_error(&error_msg);
            return Err(Error::RustError(error_msg));
        }

        let response_body = match response.text().await {
            Ok(body) => body,
            Err(e) => {
                let error_msg = format!("Failed to read response body: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        let load_response: LoadTableResponse = match serde_json::from_str(&response_body) {
            Ok(resp) => resp,
            Err(e) => {
                let error_msg = format!("Failed to parse commit response: {}", e);
                log_error(&error_msg);
                return Err(Error::RustError(error_msg));
            }
        };

        Ok(load_response.metadata)
    }

    /// List all tables in the namespace
    pub async fn list_tables(&self) -> Result<Vec<TableIdentifier>> {
        let url = format!(
            "{}/v1/namespaces/{}/tables",
            self.catalog_endpoint, self.namespace
        );

        log_info("Listing tables via REST API");

        let mut headers = Headers::new();
        match headers.set("Accept", "application/json") {
            Ok(_) => {},
            Err(e) => {
                log_error(&format!("Failed to set accept header: {}", e));
            }
        }

        // Add authorization if configured
        if let Ok(auth_token) = self.env.var("R2_CATALOG_AUTH_TOKEN") {
            match headers.set("Authorization", &format!("Bearer {}", auth_token.to_string())) {
                Ok(_) => {},
                Err(e) => {
                    log_error(&format!("Failed to set authorization header: {}", e));
                }
            }
        }

        let request = match Request::new_with_init(
            &url,
            RequestInit::new()
                .with_method(Method::Get)
                .with_headers(headers),
        ) {
            Ok(req) => req,
            Err(e) => {
                let error_msg = format!("Failed to create request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        let mut response = match Fetch::Request(request).send().await {
            Ok(resp) => resp,
            Err(e) => {
                let error_msg = format!("Failed to send list tables request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        if response.status_code() >= 400 {
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let error_msg = format!(
                "REST API returned error {}: {}",
                response.status_code(),
                error_body
            );
            log_error(&error_msg);
            return Err(Error::RustError(error_msg));
        }

        let response_body = match response.text().await {
            Ok(body) => body,
            Err(e) => {
                let error_msg = format!("Failed to read response body: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        #[derive(Deserialize)]
        struct ListTablesResponse {
            identifiers: Vec<TableIdentifier>,
        }

        let list_response: ListTablesResponse = match serde_json::from_str(&response_body) {
            Ok(resp) => resp,
            Err(e) => {
                let error_msg = format!("Failed to parse list tables response: {}", e);
                log_error(&error_msg);
                return Err(Error::RustError(error_msg));
            }
        };

        Ok(list_response.identifiers)
    }

    /// Drop a table via REST API
    pub async fn drop_table(&self, table_name: &str, purge: bool) -> Result<()> {
        let url = format!(
            "{}/v1/namespaces/{}/tables/{}?purgeRequested={}",
            self.catalog_endpoint, self.namespace, table_name, purge
        );

        log_info(&format!("Dropping table {} via REST API", table_name));

        let mut headers = Headers::new();
        
        // Add authorization if configured
        if let Ok(auth_token) = self.env.var("R2_CATALOG_AUTH_TOKEN") {
            match headers.set("Authorization", &format!("Bearer {}", auth_token.to_string())) {
                Ok(_) => {},
                Err(e) => {
                    log_error(&format!("Failed to set authorization header: {}", e));
                }
            }
        }

        let request = match Request::new_with_init(
            &url,
            RequestInit::new()
                .with_method(Method::Delete)
                .with_headers(headers),
        ) {
            Ok(req) => req,
            Err(e) => {
                let error_msg = format!("Failed to create request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        let mut response = match Fetch::Request(request).send().await {
            Ok(resp) => resp,
            Err(e) => {
                let error_msg = format!("Failed to send drop table request: {}", e);
                log_error(&error_msg);
                return Err(e);
            }
        };

        if response.status_code() >= 400 {
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let error_msg = format!(
                "REST API returned error {}: {}",
                response.status_code(),
                error_body
            );
            log_error(&error_msg);
            return Err(Error::RustError(error_msg));
        }

        Ok(())
    }

    /// Helper to get bucket name from environment
    fn get_bucket_name(&self) -> String {
        self.env
            .var("ANALYTICS_BUCKET_NAME")
            .ok()
            .map(|v| v.to_string())
            .unwrap_or_else(|| "analytics-source".to_string())
    }
}

/// Factory to create appropriate catalog based on configuration
pub struct CatalogFactory;

impl CatalogFactory {
    /// Create a catalog instance based on environment configuration
    pub fn create_catalog(env: &Env) -> Box<dyn CatalogOperations> {
        // Check if REST catalog endpoint is configured
        if let Ok(endpoint) = env.var("R2_CATALOG_ENDPOINT") {
            let endpoint_str = endpoint.to_string();
            // Only use REST catalog if it's a valid HTTP(S) endpoint
            if endpoint_str.starts_with("http://") || endpoint_str.starts_with("https://") {
                let namespace = env
                    .var("ICEBERG_NAMESPACE")
                    .ok()
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| "analytics".to_string());
                
                log_info(&format!(
                    "Using REST catalog at {} with namespace {}",
                    endpoint_str, namespace
                ));
                
                return Box::new(RestCatalogAdapter::new(
                    RestCatalog::new(env.clone(), endpoint_str, namespace)
                ));
            }
        }
        
        // Fall back to direct R2 catalog
        log_info("Using direct R2 catalog");
        let namespace = env
            .var("ICEBERG_NAMESPACE")
            .ok()
            .map(|v| v.to_string())
            .unwrap_or_else(|| "analytics".to_string());
        
        Box::new(super::catalog::IcebergCatalog::new(env.clone(), namespace))
    }
}

/// Trait for catalog operations to allow swapping implementations
pub trait CatalogOperations: Send + Sync {
    fn create_table<'a>(
        &'a self,
        table_name: &'a str,
        metadata: TableMetadata,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>>;
    
    fn load_table<'a>(
        &'a self,
        table_name: &'a str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Option<TableMetadata>>> + 'a>>;
    
    fn commit_snapshot<'a>(
        &'a self,
        table_name: &'a str,
        snapshot: Snapshot,
        data_files: Vec<DataFile>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>>;
    
    fn list_tables<'a>(
        &'a self,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<String>>> + 'a>>;
    
    fn drop_table<'a>(
        &'a self,
        table_name: &'a str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>>;
}

/// Adapter to make REST catalog implement CatalogOperations
struct RestCatalogAdapter {
    catalog: RestCatalog,
}

impl RestCatalogAdapter {
    fn new(catalog: RestCatalog) -> Self {
        Self { catalog }
    }
}

impl CatalogOperations for RestCatalogAdapter {
    fn create_table<'a>(
        &'a self,
        table_name: &'a str,
        _metadata: TableMetadata,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>> {
        Box::pin(async move {
            // Convert IcebergMetadata to REST API format
            let schema = serde_json::json!({
                "type": "struct",
                "fields": [] // Would need to extract from metadata
            });
            
            let partition_spec = vec![]; // Would need to extract from metadata
            let properties = HashMap::new(); // Would need to extract from metadata
            
            self.catalog
                .create_table(table_name, schema, partition_spec, properties)
                .await?;
            Ok(())
        })
    }
    
    fn load_table<'a>(
        &'a self,
        table_name: &'a str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Option<TableMetadata>>> + 'a>> {
        Box::pin(async move {
            match self.catalog.load_table(table_name).await? {
                Some(table_metadata) => {
                    Ok(Some(table_metadata))
                }
                None => Ok(None),
            }
        })
    }
    
    fn commit_snapshot<'a>(
        &'a self,
        table_name: &'a str,
        snapshot: Snapshot,
        _data_files: Vec<DataFile>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>> {
        Box::pin(async move {
            let requirements = vec![]; // Would need to determine requirements
            let updates = vec![
                TableUpdate::AddSnapshot { snapshot: snapshot.clone() },
                TableUpdate::SetCurrentSnapshot { snapshot_id: snapshot.snapshot_id },
            ];
            
            self.catalog.commit_changes(table_name, requirements, updates).await?;
            Ok(())
        })
    }
    
    fn list_tables<'a>(
        &'a self,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<String>>> + 'a>> {
        Box::pin(async move {
            let identifiers = self.catalog.list_tables().await?;
            Ok(identifiers.into_iter().map(|id| id.name).collect())
        })
    }
    
    fn drop_table<'a>(
        &'a self,
        table_name: &'a str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>> {
        Box::pin(async move {
            self.catalog.drop_table(table_name, true).await
        })
    }
}

// Implement for existing IcebergCatalog
impl CatalogOperations for super::catalog::IcebergCatalog {
    fn create_table<'a>(
        &'a self,
        table_name: &'a str,
        metadata: TableMetadata,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>> {
        Box::pin(self.create_table(table_name, metadata))
    }
    
    fn load_table<'a>(
        &'a self,
        table_name: &'a str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Option<TableMetadata>>> + 'a>> {
        Box::pin(self.load_table(table_name))
    }
    
    fn commit_snapshot<'a>(
        &'a self,
        table_name: &'a str,
        snapshot: Snapshot,
        data_files: Vec<DataFile>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>> {
        Box::pin(self.commit_snapshot(table_name, snapshot, data_files))
    }
    
    fn list_tables<'a>(
        &'a self,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<String>>> + 'a>> {
        Box::pin(self.list_tables())
    }
    
    fn drop_table<'a>(
        &'a self,
        table_name: &'a str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>> {
        Box::pin(self.drop_table(table_name))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_catalog_factory() {
        // This would require mocking the Env
        // For now, we'll just verify the code compiles
    }
}