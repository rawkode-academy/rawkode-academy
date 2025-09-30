use crate::models::Video;
use anyhow::{Context, Result};
use std::path::Path;
use tantivy::schema::*;
use tantivy::{doc, Index, IndexWriter};

pub fn create_schema() -> Schema {
    let mut schema_builder = Schema::builder();

    schema_builder.add_text_field("id", STRING | STORED);
    schema_builder.add_text_field("title", TEXT | STORED);
    schema_builder.add_text_field("description", TEXT | STORED);
    schema_builder.add_text_field("technologies", TEXT | STORED);

    schema_builder.build()
}

pub fn build_index(videos: &[Video], index_path: &Path) -> Result<Index> {
    std::fs::create_dir_all(index_path).context("Failed to create index directory")?;

    let schema = create_schema();
    let index = Index::create_in_dir(index_path, schema.clone())
        .context("Failed to create index")?;

    let mut index_writer: IndexWriter = index
        .writer(50_000_000)
        .context("Failed to create index writer")?;

    index_writer.delete_all_documents()?;

    let id_field = schema.get_field("id").unwrap();
    let title_field = schema.get_field("title").unwrap();
    let description_field = schema.get_field("description").unwrap();
    let technologies_field = schema.get_field("technologies").unwrap();

    for video in videos {
        let technologies_str = video
            .technologies
            .iter()
            .map(|t| t.name.clone())
            .collect::<Vec<String>>()
            .join(" ");

        let mut doc = doc!(
            id_field => video.id.clone(),
        );

        if let Some(title) = &video.title {
            doc.add_text(title_field, title);
        }

        if let Some(description) = &video.description {
            doc.add_text(description_field, description);
        }

        if !technologies_str.is_empty() {
            doc.add_text(technologies_field, &technologies_str);
        }

        index_writer
            .add_document(doc)
            .context("Failed to add document to index")?;
    }

    index_writer.commit().context("Failed to commit index")?;

    Ok(index)
}

pub fn open_or_create_index(index_path: &Path) -> Result<Index> {
    if index_path.exists() {
        Index::open_in_dir(index_path).context("Failed to open existing index")
    } else {
        std::fs::create_dir_all(index_path).context("Failed to create index directory")?;
        let schema = create_schema();
        Index::create_in_dir(index_path, schema).context("Failed to create new index")
    }
}