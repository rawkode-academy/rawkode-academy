use crate::models::SearchResult;
use anyhow::{Context, Result};
use std::path::Path;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::{Schema, Value};
use tantivy::{Index, ReloadPolicy};

pub struct SearchService {
    index: Index,
    schema: Schema,
}

impl SearchService {
    pub fn new(index_path: &Path) -> Result<Self> {
        let index = Index::open_in_dir(index_path).context("Failed to open index")?;
        let schema = index.schema();

        Ok(Self { index, schema })
    }

    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>> {
        let reader = self
            .index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .context("Failed to create index reader")?;

        let searcher = reader.searcher();

        let default_fields: Vec<tantivy::schema::Field> = vec![
            self.schema.get_field("title").unwrap(),
            self.schema.get_field("description").unwrap(),
            self.schema.get_field("technologies").unwrap(),
        ];

        let query_parser = QueryParser::for_index(&self.index, default_fields);
        let query = query_parser
            .parse_query(query_str)
            .context("Failed to parse search query")?;

        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit))
            .context("Failed to execute search")?;

        let mut results = Vec::new();

        for (score, doc_address) in top_docs {
            let retrieved_doc: tantivy::TantivyDocument = searcher
                .doc(doc_address)
                .context("Failed to retrieve document")?;

            let id = retrieved_doc
                .get_first(self.schema.get_field("id").unwrap())
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = retrieved_doc
                .get_first(self.schema.get_field("title").unwrap())
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let description = retrieved_doc
                .get_first(self.schema.get_field("description").unwrap())
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let technologies = retrieved_doc
                .get_first(self.schema.get_field("technologies").unwrap())
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .split_whitespace()
                .map(String::from)
                .collect();

            results.push(SearchResult {
                id,
                title,
                description,
                technologies,
                score,
            });
        }

        Ok(results)
    }
}