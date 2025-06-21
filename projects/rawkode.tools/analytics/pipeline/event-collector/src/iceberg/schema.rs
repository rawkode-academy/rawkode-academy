use serde::{Deserialize, Serialize};

// Re-export the types from metadata module to avoid duplication
pub use crate::iceberg::metadata::{Schema, Field};

/// Data types supported by Iceberg
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DataType {
    Boolean,
    Int,
    Long,
    Float,
    Double,
    Date,
    Time,
    Timestamp,
    Timestamptz,
    String,
    Uuid,
    Binary,
    Fixed(usize),
    Decimal { precision: u32, scale: u32 },
    Struct(Vec<StructField>),
    List(Box<DataType>),
    Map { key: Box<DataType>, value: Box<DataType> },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StructField {
    pub id: i32,
    pub name: String,
    pub required: bool,
    pub field_type: DataType,
}

/// Schema evolution operations
#[derive(Debug, Clone)]
pub enum SchemaChange {
    AddField {
        parent_id: Option<i32>,
        field_id: i32,
        name: String,
        field_type: DataType,
        required: bool,
    },
    DropField {
        field_id: i32,
    },
    RenameField {
        field_id: i32,
        new_name: String,
    },
    UpdateField {
        field_id: i32,
        new_type: DataType,
    },
    MakeFieldOptional {
        field_id: i32,
    },
    MakeFieldRequired {
        field_id: i32,
    },
}

/// Schema evolution analyzer
pub struct SchemaEvolution {
    changes: Vec<SchemaChange>,
    is_compatible: bool,
    breaking_changes: Vec<String>,
}

impl SchemaEvolution {
    /// Analyze schema changes between two versions
    pub fn analyze(from: &Schema, to: &Schema) -> Self {
        let mut changes = Vec::new();
        let mut breaking_changes = Vec::new();
        let mut is_compatible = true;

        // Build field maps for comparison
        let from_fields: std::collections::HashMap<i32, &Field> = 
            from.fields.iter().map(|f| (f.id, f)).collect();
        let to_fields: std::collections::HashMap<i32, &Field> = 
            to.fields.iter().map(|f| (f.id, f)).collect();

        // Check for removed fields
        for (id, field) in &from_fields {
            if !to_fields.contains_key(id) {
                changes.push(SchemaChange::DropField { field_id: *id });
                if field.required {
                    breaking_changes.push(format!("Required field '{}' was removed", field.name));
                    is_compatible = false;
                }
            }
        }

        // Check for added or modified fields
        for (id, to_field) in &to_fields {
            match from_fields.get(id) {
                Some(from_field) => {
                    // Check for renames
                    if from_field.name != to_field.name {
                        changes.push(SchemaChange::RenameField {
                            field_id: *id,
                            new_name: to_field.name.clone(),
                        });
                    }

                    // Check for type changes
                    if from_field.field_type != to_field.field_type {
                        changes.push(SchemaChange::UpdateField {
                            field_id: *id,
                            new_type: DataType::String, // Simplified for this example
                        });
                        breaking_changes.push(format!(
                            "Field '{}' type changed from {} to {}",
                            from_field.name, from_field.field_type, to_field.field_type
                        ));
                        is_compatible = false;
                    }

                    // Check for required/optional changes
                    if from_field.required != to_field.required {
                        if to_field.required {
                            changes.push(SchemaChange::MakeFieldRequired { field_id: *id });
                            breaking_changes.push(format!(
                                "Field '{}' changed from optional to required",
                                from_field.name
                            ));
                            is_compatible = false;
                        } else {
                            changes.push(SchemaChange::MakeFieldOptional { field_id: *id });
                        }
                    }
                }
                None => {
                    // New field
                    changes.push(SchemaChange::AddField {
                        parent_id: None,
                        field_id: *id,
                        name: to_field.name.clone(),
                        field_type: DataType::String, // Simplified
                        required: to_field.required,
                    });
                    
                    if to_field.required {
                        breaking_changes.push(format!(
                            "New required field '{}' added",
                            to_field.name
                        ));
                        is_compatible = false;
                    }
                }
            }
        }

        Self {
            changes,
            is_compatible,
            breaking_changes,
        }
    }

    pub fn is_compatible(&self) -> bool {
        self.is_compatible
    }

    pub fn changes(&self) -> &[SchemaChange] {
        &self.changes
    }

    pub fn breaking_changes(&self) -> &[String] {
        &self.breaking_changes
    }
}

/// Schema builder for creating and modifying schemas
pub struct SchemaBuilder {
    fields: Vec<Field>,
    next_field_id: i32,
}

impl SchemaBuilder {
    pub fn new() -> Self {
        Self {
            fields: Vec::new(),
            next_field_id: 1,
        }
    }

    pub fn add_field(mut self, name: &str, field_type: &str, required: bool) -> Self {
        self.fields.push(Field {
            id: self.next_field_id,
            name: name.to_string(),
            field_type: field_type.to_string(),
            required,
        });
        self.next_field_id += 1;
        self
    }

    pub fn rename_column(mut self, old_name: &str, new_name: &str) -> Self {
        if let Some(field) = self.fields.iter_mut().find(|f| f.name == old_name) {
            field.name = new_name.to_string();
        }
        self
    }

    pub fn build(self) -> Schema {
        Schema {
            schema_id: 0,
            fields: self.fields,
        }
    }
}

/// CloudEvents schema for Iceberg tables
pub struct IcebergEventSchema;

impl IcebergEventSchema {
    /// Create the CloudEvents schema for analytics events
    pub fn create_event_schema() -> arrow_schema::Schema {
        use arrow_schema::{DataType as ArrowDataType, Field as ArrowField, Schema as ArrowSchema};
        
        ArrowSchema::new(vec![
            // CloudEvents core attributes
            ArrowField::new("id", ArrowDataType::Utf8, false),
            ArrowField::new("source", ArrowDataType::Utf8, false),
            ArrowField::new("type", ArrowDataType::Utf8, false),
            ArrowField::new("specversion", ArrowDataType::Utf8, false),
            ArrowField::new("time", ArrowDataType::Timestamp(arrow_schema::TimeUnit::Microsecond, Some("UTC".into())), true),
            ArrowField::new("datacontenttype", ArrowDataType::Utf8, true),
            ArrowField::new("dataschema", ArrowDataType::Utf8, true),
            ArrowField::new("subject", ArrowDataType::Utf8, true),
            
            // CloudEvents data (stored as JSON string)
            ArrowField::new("data", ArrowDataType::Utf8, true),
            
            // Extensions as JSON string
            ArrowField::new("extensions", ArrowDataType::Utf8, true),
            
            // Cloudflare enrichment fields
            ArrowField::new("cf_colo", ArrowDataType::Utf8, true),
            ArrowField::new("cf_country", ArrowDataType::Utf8, true),
            ArrowField::new("cf_city", ArrowDataType::Utf8, true),
            ArrowField::new("cf_continent", ArrowDataType::Utf8, true),
            ArrowField::new("cf_postal_code", ArrowDataType::Utf8, true),
            ArrowField::new("cf_region", ArrowDataType::Utf8, true),
            ArrowField::new("cf_timezone", ArrowDataType::Utf8, true),
            ArrowField::new("cf_http_protocol", ArrowDataType::Utf8, true),
            ArrowField::new("cf_tls_version", ArrowDataType::Utf8, true),
            ArrowField::new("cf_tls_cipher", ArrowDataType::Utf8, true),
            
            // Partition columns (derived from time)
            ArrowField::new("year", ArrowDataType::Int32, false),
            ArrowField::new("month", ArrowDataType::Int32, false),
            ArrowField::new("day", ArrowDataType::Int32, false),
            ArrowField::new("hour", ArrowDataType::Int32, false),
            
            // Raw event for compatibility
            ArrowField::new("raw_event", ArrowDataType::Utf8, false),
        ])
    }
    
    /// Create Iceberg schema JSON representation
    pub fn create_iceberg_schema_json() -> serde_json::Value {
        serde_json::json!({
            "type": "struct",
            "fields": [
                {"id": 1, "name": "id", "required": true, "type": "string"},
                {"id": 2, "name": "source", "required": true, "type": "string"},
                {"id": 3, "name": "type", "required": true, "type": "string"},
                {"id": 4, "name": "specversion", "required": true, "type": "string"},
                {"id": 5, "name": "time", "required": false, "type": "timestamptz"},
                {"id": 6, "name": "datacontenttype", "required": false, "type": "string"},
                {"id": 7, "name": "dataschema", "required": false, "type": "string"},
                {"id": 8, "name": "subject", "required": false, "type": "string"},
                {"id": 9, "name": "data", "required": false, "type": "string"},
                {"id": 10, "name": "extensions", "required": false, "type": "string"},
                {"id": 11, "name": "cf_colo", "required": false, "type": "string"},
                {"id": 12, "name": "cf_country", "required": false, "type": "string"},
                {"id": 13, "name": "cf_city", "required": false, "type": "string"},
                {"id": 14, "name": "cf_continent", "required": false, "type": "string"},
                {"id": 15, "name": "cf_postal_code", "required": false, "type": "string"},
                {"id": 16, "name": "cf_region", "required": false, "type": "string"},
                {"id": 17, "name": "cf_timezone", "required": false, "type": "string"},
                {"id": 18, "name": "cf_http_protocol", "required": false, "type": "string"},
                {"id": 19, "name": "cf_tls_version", "required": false, "type": "string"},
                {"id": 20, "name": "cf_tls_cipher", "required": false, "type": "string"},
                {"id": 21, "name": "year", "required": true, "type": "int"},
                {"id": 22, "name": "month", "required": true, "type": "int"},
                {"id": 23, "name": "day", "required": true, "type": "int"},
                {"id": 24, "name": "hour", "required": true, "type": "int"},
                {"id": 25, "name": "raw_event", "required": true, "type": "string"}
            ]
        })
    }
}

/// Table properties for Iceberg tables
pub struct IcebergTableProperties;

impl IcebergTableProperties {
    /// Get default table properties for analytics events
    pub fn default_properties() -> std::collections::HashMap<String, String> {
        let mut props = std::collections::HashMap::new();
        
        // File format
        props.insert("write.format.default".to_string(), "parquet".to_string());
        
        // Parquet properties
        props.insert("write.parquet.compression-codec".to_string(), "zstd".to_string());
        props.insert("write.parquet.compression-level".to_string(), "3".to_string());
        props.insert("write.parquet.row-group-size-bytes".to_string(), "16777216".to_string()); // 16MB
        props.insert("write.parquet.page-size-bytes".to_string(), "1048576".to_string()); // 1MB
        props.insert("write.parquet.dict-size-bytes".to_string(), "2097152".to_string()); // 2MB
        
        // Target file size
        props.insert("write.target-file-size-bytes".to_string(), "134217728".to_string()); // 128MB
        
        // Metadata
        props.insert("write.metadata.compression-codec".to_string(), "gzip".to_string());
        props.insert("write.metadata.metrics.default".to_string(), "truncate(16)".to_string());
        
        // Maintenance
        props.insert("write.metadata.delete-after-commit.enabled".to_string(), "true".to_string());
        props.insert("write.metadata.previous-versions-max".to_string(), "10".to_string());
        
        // Compaction
        props.insert("write.compaction.enabled".to_string(), "true".to_string());
        props.insert("write.compaction.target-file-size-bytes".to_string(), "536870912".to_string()); // 512MB
        
        props
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schema_evolution_add_optional_field() {
        let schema_v1 = SchemaBuilder::new()
            .add_field("id", "string", true)
            .add_field("name", "string", true)
            .build();

        let schema_v2 = SchemaBuilder::new()
            .add_field("id", "string", true)
            .add_field("name", "string", true)
            .add_field("email", "string", false)
            .build();

        let evolution = SchemaEvolution::analyze(&schema_v1, &schema_v2);

        assert!(evolution.is_compatible());
        assert_eq!(evolution.changes().len(), 1);
        assert!(evolution.breaking_changes().is_empty());
    }

    #[test]
    fn test_schema_evolution_add_required_field() {
        let schema_v1 = SchemaBuilder::new()
            .add_field("id", "string", true)
            .build();

        let schema_v2 = SchemaBuilder::new()
            .add_field("id", "string", true)
            .add_field("name", "string", true) // New required field
            .build();

        let evolution = SchemaEvolution::analyze(&schema_v1, &schema_v2);

        assert!(!evolution.is_compatible());
        assert_eq!(evolution.breaking_changes().len(), 1);
    }

    #[test]
    fn test_schema_builder() {
        let schema = SchemaBuilder::new()
            .add_field("id", "string", true)
            .add_field("timestamp", "long", true)
            .add_field("data", "string", false)
            .rename_column("data", "payload")
            .build();

        assert_eq!(schema.fields.len(), 3);
        assert_eq!(schema.fields[2].name, "payload");
    }
}