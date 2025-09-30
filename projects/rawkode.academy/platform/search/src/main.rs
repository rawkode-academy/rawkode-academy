mod graphql;
mod indexer;
mod models;
mod search;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use models::{HealthResponse, SearchResponse, SyncResponse};
use search::SearchService;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{error, info};

#[derive(Clone)]
struct AppState {
    index_path: PathBuf,
    search_service: Arc<RwLock<Option<SearchService>>>,
}

#[derive(serde::Deserialize)]
struct SearchQuery {
    q: String,
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize {
    10
}

async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    let index_exists = state.index_path.exists();
    Json(HealthResponse {
        status: "ok".to_string(),
        index_exists,
    })
}

async fn sync_handler(
    State(state): State<AppState>,
) -> Result<Json<SyncResponse>, StatusCode> {
    info!("Starting sync operation");

    let videos = match graphql::fetch_all_videos().await {
        Ok(videos) => {
            info!("Fetched {} videos from GraphQL API", videos.len());
            videos
        }
        Err(e) => {
            error!("Failed to fetch videos: {}", e);
            return Err(StatusCode::BAD_GATEWAY);
        }
    };

    if videos.is_empty() {
        return Ok(Json(SyncResponse {
            message: "No videos to index".to_string(),
            videos_indexed: 0,
        }));
    }

    match indexer::build_index(&videos, &state.index_path) {
        Ok(_) => {
            info!("Successfully built index with {} videos", videos.len());

            match SearchService::new(&state.index_path) {
                Ok(service) => {
                    let mut search_service = state.search_service.write().await;
                    *search_service = Some(service);
                    info!("Search service updated with new index");
                }
                Err(e) => {
                    error!("Failed to reload search service: {}", e);
                }
            }

            Ok(Json(SyncResponse {
                message: "Index rebuilt successfully".to_string(),
                videos_indexed: videos.len(),
            }))
        }
        Err(e) => {
            error!("Failed to build index: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn search_handler(
    Query(params): Query<SearchQuery>,
    State(state): State<AppState>,
) -> Result<Json<SearchResponse>, StatusCode> {
    let search_service = state.search_service.read().await;

    let service = search_service
        .as_ref()
        .ok_or_else(|| {
            error!("Search service not initialized. Please run /sync first");
            StatusCode::SERVICE_UNAVAILABLE
        })?;

    match service.search(&params.q, params.limit) {
        Ok(results) => {
            let total = results.len();
            Ok(Json(SearchResponse { results, total }))
        }
        Err(e) => {
            error!("Search failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[shuttle_runtime::main]
async fn main() -> shuttle_axum::ShuttleAxum {
    let index_path = PathBuf::from("./index");

    // Try to load existing index or perform initial sync
    let search_service = if index_path.exists() {
        match SearchService::new(&index_path) {
            Ok(service) => {
                info!("Loaded existing index from {:?}", index_path);
                Some(service)
            }
            Err(e) => {
                error!("Failed to load existing index: {}", e);
                info!("Performing initial sync...");
                None
            }
        }
    } else {
        info!("No existing index found. Performing initial sync...");
        None
    };

    let state = AppState {
        index_path: index_path.clone(),
        search_service: Arc::new(RwLock::new(search_service)),
    };

    // Perform initial sync if no valid index exists
    if state.search_service.read().await.is_none() {
        match graphql::fetch_all_videos().await {
            Ok(videos) => {
                info!("Fetched {} videos from GraphQL API", videos.len());
                if !videos.is_empty() {
                    match indexer::build_index(&videos, &index_path) {
                        Ok(_) => {
                            info!("Successfully built initial index with {} videos", videos.len());
                            match SearchService::new(&index_path) {
                                Ok(service) => {
                                    let mut search_service = state.search_service.write().await;
                                    *search_service = Some(service);
                                    info!("Search service initialized with new index");
                                }
                                Err(e) => {
                                    error!("Failed to initialize search service: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to build initial index: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to fetch videos for initial sync: {}", e);
                error!("Server will start without index. Use /sync endpoint to retry.");
            }
        }
    }

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/sync", post(sync_handler))
        .route("/search", get(search_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    info!("Available endpoints:");
    info!("  GET  /health - Check server health");
    info!("  POST /sync - Fetch videos and rebuild index");
    info!("  GET  /search?q={{query}}&limit={{limit}} - Search videos");

    Ok(app.into())
}
