use crate::models::Video;
use anyhow::{Context, Result};
use std::path::Path;
use tantivy::directory::MmapDirectory;
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
    // Reopen an existing index when this directory already has one, then
    // replace its documents in a single commit. That commit publishes
    // `meta.json` atomically, and readers keep the directory they opened.
    let index = Index::open_or_create(
        MmapDirectory::open(index_path).context("Failed to open index directory")?,
        schema,
    )
    .context("Failed to open or create index")?;
    let schema = index.schema();

    let mut index_writer: IndexWriter = index
        .writer(50_000_000)
        .context("Failed to create index writer")?;

    index_writer
        .delete_all_documents()
        .context("Failed to clear existing documents")?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::search::SearchService;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn video(id: &str, title: &str) -> Video {
        Video {
            id: id.to_string(),
            title: Some(title.to_string()),
            description: None,
            technologies: Vec::new(),
        }
    }

    struct TempIndex {
        path: PathBuf,
    }

    impl TempIndex {
        fn new() -> Self {
            static COUNTER: AtomicU64 = AtomicU64::new(0);
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock is before the unix epoch")
                .as_nanos();
            let n = COUNTER.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "rawkode-search-{}-{}-{}",
                std::process::id(),
                nanos,
                n
            ));
            fs::create_dir_all(&path).expect("failed to create temp index directory");
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempIndex {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn build_index_twice_replaces_previous_documents() {
        let dir = TempIndex::new();

        build_index(&[video("old", "alphaunique")], dir.path())
            .expect("first build should create the index");

        let reader_from_before_rebuild =
            SearchService::new(dir.path()).expect("search service should open the first index");
        let first_hits = reader_from_before_rebuild
            .search("alphaunique", 10)
            .expect("search against the first index should succeed");
        assert_eq!(
            first_hits
                .iter()
                .map(|hit| hit.id.as_str())
                .collect::<Vec<_>>(),
            ["old"]
        );

        build_index(&[video("new", "betaunique")], dir.path())
            .expect("second build on the same directory should succeed");

        let during = reader_from_before_rebuild
            .search("betaunique", 10)
            .expect("a reader opened before the rebuild should keep searching");
        assert_eq!(
            during.iter().map(|hit| hit.id.as_str()).collect::<Vec<_>>(),
            ["new"]
        );

        let rebuilt =
            SearchService::new(dir.path()).expect("search service should reopen the index");
        let fresh = rebuilt
            .search("betaunique", 10)
            .expect("search against the rebuilt index should succeed");
        assert_eq!(
            fresh.iter().map(|hit| hit.id.as_str()).collect::<Vec<_>>(),
            ["new"]
        );

        let stale = rebuilt
            .search("alphaunique", 10)
            .expect("search for the replaced document should succeed");
        assert!(
            stale.is_empty(),
            "documents from the previous build should not remain searchable"
        );
    }
}
