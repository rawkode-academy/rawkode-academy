use crate::error::{CatalogError, Result};
use crate::models::R2ObjectMetadata;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use worker::{Bucket, Data};

pub struct R2Client {
    raw_bucket: Bucket,
    catalog_bucket: Bucket,
}

impl R2Client {
    pub fn new(raw_bucket: Bucket, catalog_bucket: Bucket) -> Self {
        Self {
            raw_bucket,
            catalog_bucket,
        }
    }

    pub async fn list_objects(&self, prefix: &str, limit: Option<u32>) -> Result<Vec<R2ObjectMetadata>> {
        let mut list_builder = self.raw_bucket.list();
        
        list_builder = list_builder.prefix(prefix);
        
        if let Some(limit_value) = limit {
            list_builder = list_builder.limit(limit_value);
        }

        let objects = list_builder
            .execute()
            .await
            .map_err(|e| CatalogError::R2Error(e.to_string()))?;

        let mut metadata_list = Vec::new();
        
        for object in objects.objects() {
            let key = object.key();
            let size = object.size() as i64;
            let uploaded = object.uploaded();
            
            // Get custom metadata
            let r2_object = self.raw_bucket
                .head(&key)
                .await
                .map_err(|e| CatalogError::R2Error(e.to_string()))?;
            
            let custom_metadata = match r2_object {
                Some(obj) => obj.custom_metadata().unwrap_or_default(),
                None => HashMap::new(),
            };
            
            metadata_list.push(R2ObjectMetadata {
                path: key,
                size,
                last_modified: DateTime::<Utc>::from_timestamp(uploaded.as_millis() as i64 / 1000, 0)
                    .unwrap_or_else(Utc::now),
                custom_metadata,
            });
        }

        Ok(metadata_list)
    }

    pub async fn list_prefixes(&self, prefix: &str) -> Result<Vec<String>> {
        let result = self.raw_bucket
            .list()
            .prefix(prefix)
            .delimiter("/")
            .execute()
            .await
            .map_err(|e| CatalogError::R2Error(e.to_string()))?;

        Ok(result.delimited_prefixes()
            .into_iter()
            .map(|p| p.to_string())
            .collect())
    }

    pub async fn get_catalog(&self) -> Result<Option<String>> {
        match self.catalog_bucket.get("catalog.json").execute().await {
            Ok(Some(object)) => {
                match object.body() {
                    Some(body) => {
                        let text = body.text().await
                            .map_err(|e| CatalogError::R2Error(e.to_string()))?;
                        Ok(Some(text))
                    }
                    None => Ok(None),
                }
            }
            Ok(None) => Ok(None),
            Err(e) => Err(CatalogError::R2Error(e.to_string())),
        }
    }

    pub async fn put_catalog(&self, catalog_json: &str) -> Result<()> {
        self.catalog_bucket
            .put("catalog.json", Data::Text(catalog_json.to_string()))
            .execute()
            .await
            .map_err(|e| CatalogError::R2Error(e.to_string()))?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get_object_metadata(&self, key: &str) -> Result<Option<HashMap<String, String>>> {
        match self.raw_bucket.head(key).await {
            Ok(Some(object)) => {
                let metadata = object.custom_metadata()
                    .unwrap_or_default();
                Ok(Some(metadata))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(CatalogError::R2Error(e.to_string())),
        }
    }

    #[allow(dead_code)]
    pub async fn calculate_bucket_size(&self, prefix: &str) -> Result<i64> {
        let mut total_size = 0i64;
        let mut cursor = None;

        loop {
            let mut list_builder = self.raw_bucket
                .list()
                .prefix(prefix)
                .limit(1000);
            
            if let Some(cursor_value) = cursor.as_ref() {
                list_builder = list_builder.cursor(cursor_value);
            }

            let result = list_builder
                .execute()
                .await
                .map_err(|e| CatalogError::R2Error(e.to_string()))?;

            for object in result.objects() {
                total_size += object.size() as i64;
            }

            if result.truncated() {
                cursor = result.cursor().map(|c| c.to_string());
            } else {
                break;
            }
        }

        Ok(total_size)
    }
}