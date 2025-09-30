use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Technology {
    pub name: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Video {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub technologies: Vec<Technology>,
}

#[derive(Debug, Deserialize)]
pub struct GraphQLResponse {
    pub data: GraphQLData,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphQLData {
    pub get_all_videos: Vec<Video>,
}

#[derive(Debug, Serialize)]
pub struct GraphQLQuery {
    pub query: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub description: String,
    pub technologies: Vec<String>,
    pub score: f32,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total: usize,
}

#[derive(Debug, Serialize)]
pub struct SyncResponse {
    pub message: String,
    pub videos_indexed: usize,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub index_exists: bool,
}