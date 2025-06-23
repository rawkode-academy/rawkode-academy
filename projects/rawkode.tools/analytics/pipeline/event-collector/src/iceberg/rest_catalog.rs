use crate::iceberg::metadata::{Snapshot, TableMetadata};
use crate::iceberg::manifest::DataFile;
use crate::utils::{log_error, log_info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use worker::*;

/// REST API catalog client for R2 Data Catalog
/// This provides an alternative to direct R2 access when using a catalog service
pub struct RestCatalog {
    catalog_endpoint: String,
    warehouse: String,
    namespace: String,
    credential: Option<String>,
    headers: HashMap<String, String>,
    prefix: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    pub schema: serde_json::Value,
    #[serde(rename = "partition-spec", skip_serializing_if = "Option::is_none")]
    pub partition_spec: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub properties: HashMap<String, String>,
    #[serde(rename = "stage-create", skip_serializing_if = "Option::is_none")]
    pub stage_create: Option<bool>,
    #[serde(rename = "sort-order", skip_serializing_if = "Option::is_none")]
    pub sort_order: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartitionField {
    #[serde(rename = "source-id")]
    pub source_id: i32,
    #[serde(rename = "field-id")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConfigResponse {
    overrides: HashMap<String, String>,
    defaults: HashMap<String, String>,
}

impl RestCatalog {
    /// Create a new REST catalog client
    pub fn new(env: &Env, endpoint: String, warehouse: String, namespace: String) -> Self {
        // Try to get the credential at initialization
        let credential = match env.secret("R2_DATA_CATALOG_API_TOKEN") {
            Ok(token) => {
                let token_str = token.to_string();
                log_info(&format!("REST catalog initialized with credential (length: {})", token_str.len()));
                Some(token_str)
            },
            Err(e) => {
                log_error(&format!("Failed to retrieve R2_DATA_CATALOG_API_TOKEN secret during initialization: {:?}", e));
                None
            }
        };
        
        // Initialize headers according to RESTCatalog spec
        let mut headers = HashMap::new();
        
        // Signal that we support vended-credentials for access delegation
        headers.insert(
            "X-Iceberg-Access-Delegation".to_string(),
            "vended-credentials".to_string()
        );
        
        Self {
            catalog_endpoint: endpoint,
            warehouse,
            namespace,
            credential,
            headers,
            prefix: None,
        }
    }

    /// Get catalog config and extract prefix
    pub async fn get_config(&mut self) -> Result<()> {
        let url = format!("{}/v1/config?warehouse={}", 
            self.catalog_endpoint.trim_end_matches('/'), 
            urlencoding::encode(&self.warehouse)
        );
        
        log_info(&format!("Getting catalog config from: {}", url));
        
        let mut headers = Headers::new();
        headers.set("Accept", "application/json")?;
        self.add_headers(&mut headers)?;
        
        let request = Request::new_with_init(
            &url,
            RequestInit::new()
                .with_method(Method::Get)
                .with_headers(headers),
        )?;
        
        let mut response = Fetch::Request(request).send().await?;
        
        if response.status_code() >= 400 {
            let error_body = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(Error::RustError(format!(
                "Failed to get catalog config: {} - {}",
                response.status_code(),
                error_body
            )));
        }
        
        let body = response.text().await?;
        let config: ConfigResponse = serde_json::from_str(&body)
            .map_err(|e| Error::RustError(format!("Failed to parse config response: {}", e)))?;
        
        // Extract prefix from overrides
        if let Some(prefix) = config.overrides.get("prefix") {
            log_info(&format!("Got catalog prefix: {}", prefix));
            self.prefix = Some(prefix.clone());
        }
        
        Ok(())
    }
    
    /// Get the prefix (must have called get_config first)
    fn get_prefix(&self) -> Result<String> {
        self.prefix.clone().ok_or_else(|| {
            Error::RustError("No prefix found in catalog config - call get_config() first".to_string())
        })
    }

    /// Helper method to add required headers for REST catalog requests
    fn add_headers(&self, headers: &mut Headers) -> Result<()> {
        // Add all configured headers
        for (key, value) in &self.headers {
            headers.set(key, value)?;
        }
        
        // Based on DuckDB's implementation, use Bearer token authentication
        if let Some(ref credential) = self.credential {
            log_info(&format!("Setting Authorization header with credential (length: {})", credential.len()));
            headers.set("Authorization", &format!("Bearer {}", credential))?;
        }
        
        Ok(())
    }

    /// Create a new table via REST API
    pub async fn create_table(
        &self,
        table_name: &str,
        schema: serde_json::Value,
        partition_spec: serde_json::Value,
        properties: HashMap<String, String>,
    ) -> Result<TableMetadata> {
        // Skip namespace check for R2 Data Catalog - namespace should already exist
        // R2 Data Catalog might not allow namespace operations via REST API
        log_info("Skipping namespace check - assuming 'default' namespace exists");
        
        // Get prefix from config (must have been fetched already)
        let prefix = self.get_prefix()?;
        
        // Remove trailing slash from endpoint if present
        let endpoint = self.catalog_endpoint.trim_end_matches('/');
        // Build URL with prefix as DuckDB does
        let url = format!("{}/v1/{}/namespaces/{}/tables", endpoint, prefix, self.namespace);

        log_info(&format!("Creating table {} via REST API at {}", table_name, url));

        let request_body = CreateTableRequest {
            name: table_name.to_string(),
            location: None,  // Let R2 Data Catalog determine the location
            schema,
            partition_spec: if partition_spec.is_null() { None } else { Some(partition_spec) },
            properties,
            stage_create: None,
            sort_order: None,
        };

        let body_json = match serde_json::to_string(&request_body) {
            Ok(json) => {
                log_info(&format!("Create table request body: {}", json));
                json
            },
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

        // Add required headers
        if let Err(e) = self.add_headers(&mut headers) {
            log_error(&format!("Failed to add headers: {}", e));
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
                "REST API returned error {} for URL {}: {}",
                response.status_code(),
                url,
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

    /// List namespaces to verify catalog access
    #[allow(dead_code)]
    pub async fn list_namespaces(&self) -> Result<Vec<String>> {
        let url = format!("{}/v1/namespaces", self.catalog_endpoint);
        
        log_info("Listing namespaces via REST API");
        
        let mut headers = Headers::new();
        headers.set("Accept", "application/json")?;
        
        self.add_headers(&mut headers)?;
        
        let request = Request::new_with_init(
            &url,
            RequestInit::new()
                .with_method(Method::Get)
                .with_headers(headers),
        )?;
        
        let mut response = Fetch::Request(request).send().await?;
        
        if response.status_code() >= 400 {
            let error_body = response.text().await.unwrap_or_default();
            return Err(Error::RustError(format!(
                "Failed to list namespaces: {} - {}",
                response.status_code(),
                error_body
            )));
        }
        
        let body = response.text().await?;
        log_info(&format!("Namespaces response: {}", body));
        
        // Parse response - expecting {"namespaces": [{"namespace": ["name1"]}, ...]}
        let parsed: serde_json::Value = serde_json::from_str(&body)?;
        let namespaces = parsed["namespaces"]
            .as_array()
            .ok_or_else(|| Error::RustError("Invalid namespaces response".to_string()))?
            .iter()
            .filter_map(|ns| {
                ns["namespace"]
                    .as_array()
                    .and_then(|arr| arr.first())
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            })
            .collect();
        
        Ok(namespaces)
    }

    /// Load table metadata via REST API
    pub async fn load_table(&self, table_name: &str) -> Result<Option<TableMetadata>> {
        // Skip namespace listing for now - R2 Data Catalog might not support it
        
        let prefix = self.get_prefix()?;
        let endpoint = self.catalog_endpoint.trim_end_matches('/');
        let url = format!("{}/v1/{}/namespaces/{}/tables/{}", endpoint, prefix, self.namespace, table_name);

        log_info(&format!("Loading table {} via REST API at URL: {}", table_name, url));

        let mut headers = Headers::new();
        match headers.set("Accept", "application/json") {
            Ok(_) => {},
            Err(e) => {
                log_error(&format!("Failed to set accept header: {}", e));
            }
        }

        // Add required headers
        if let Err(e) = self.add_headers(&mut headers) {
            log_error(&format!("Failed to add headers: {}", e));
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
                "REST API returned error {} for URL {}: {}",
                response.status_code(),
                url,
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
        let url = format!("{}/v1/namespaces/{}/tables/{}", self.catalog_endpoint, self.namespace, table_name);

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

        // Add required headers
        if let Err(e) = self.add_headers(&mut headers) {
            log_error(&format!("Failed to add headers: {}", e));
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
                "REST API returned error {} for URL {}: {}",
                response.status_code(),
                url,
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
        // Remove trailing slash from endpoint if present
        let endpoint = self.catalog_endpoint.trim_end_matches('/');
        // When endpoint includes the warehouse path, don't add it again
        let url = format!("{}/v1/namespaces/{}/tables", endpoint, self.namespace);

        log_info("Listing tables via REST API");

        let mut headers = Headers::new();
        match headers.set("Accept", "application/json") {
            Ok(_) => {},
            Err(e) => {
                log_error(&format!("Failed to set accept header: {}", e));
            }
        }

        // Add required headers
        if let Err(e) = self.add_headers(&mut headers) {
            log_error(&format!("Failed to add headers: {}", e));
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
                "REST API returned error {} for URL {}: {}",
                response.status_code(),
                url,
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
        let base_url = format!("{}/v1/namespaces/{}/tables/{}", self.catalog_endpoint, self.namespace, table_name);
        let url = format!("{}?purgeRequested={}", base_url, purge);

        log_info(&format!("Dropping table {} via REST API", table_name));

        let mut headers = Headers::new();
        
        // Add required headers
        if let Err(e) = self.add_headers(&mut headers) {
            log_error(&format!("Failed to add headers: {}", e));
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
                "REST API returned error {} for URL {}: {}",
                response.status_code(),
                url,
                error_body
            );
            log_error(&error_msg);
            return Err(Error::RustError(error_msg));
        }

        Ok(())
    }
}

/// Factory to create appropriate catalog based on configuration
pub struct CatalogFactory;

#[allow(dead_code)]
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
                
                let warehouse = env
                    .var("ICEBERG_WAREHOUSE")
                    .ok()
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| "analytics-source".to_string());
                
                return Box::new(RestCatalogAdapter::new(
                    RestCatalog::new(env, endpoint_str, warehouse, namespace)
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
#[allow(dead_code)]
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
#[allow(dead_code)]
struct RestCatalogAdapter {
    catalog: RestCatalog,
}

#[allow(dead_code)]
impl RestCatalogAdapter {
    fn new(catalog: RestCatalog) -> Self {
        Self { catalog }
    }
}

impl CatalogOperations for RestCatalogAdapter {
    fn create_table<'a>(
        &'a self,
        _table_name: &'a str,
        _metadata: TableMetadata,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>> {
        Box::pin(async move {
            // REST catalog operations require config fetching, but we can't mutate self here
            // This is a limitation of the current trait design
            Err(Error::RustError("REST catalog table creation requires mutable access".to_string()))
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