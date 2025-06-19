mod catalog;
mod costs;
mod error;
mod models;
mod r2;
mod scanner;

#[cfg(test)]
mod tests;

use catalog::CatalogManager;
use costs::CostCalculator;
use error::{CatalogError, Result};
use r2::R2Client;
use worker::*;

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> worker::Result<Response> {
    // Initialize tracing
    console_error_panic_hook::set_once();

    // Set up CORS headers
    let cors = Cors::default()
        .with_origins(vec!["*"])
        .with_methods(vec![Method::Get, Method::Post])
        .with_allowed_headers(vec!["Content-Type"]);

    // Create router
    let router = Router::new();

    router
        .get_async("/catalog", |_req, ctx| async move {
            handle_get_catalog(ctx).await
        })
        .post_async("/catalog/refresh", |_req, ctx| async move {
            handle_refresh_catalog(ctx).await
        })
        .get_async("/catalog/costs", |_req, ctx| async move {
            handle_get_costs(ctx).await
        })
        .run(req, env)
        .await?
        .with_cors(&cors)
}

#[event(scheduled)]
async fn scheduled(event: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    console_log!("Running scheduled catalog update at {:?}", event.schedule());

    match refresh_catalog_internal(&env).await {
        Ok(catalog) => {
            console_log!(
                "Catalog update successful: {} tables, {} rows",
                catalog.total_tables,
                catalog.total_rows
            );
        }
        Err(e) => {
            console_error!("Catalog update failed: {}", e);
        }
    }
}

async fn handle_get_catalog(ctx: RouteContext<()>) -> worker::Result<Response> {
    let env = ctx.env;

    let r2_client = create_r2_client(&env)?;
    let catalog_manager = CatalogManager::new(&r2_client);

    match catalog_manager.get_catalog().await {
        Ok(Some(catalog)) => Response::from_json(&catalog),
        Ok(None) => Response::error("Catalog not found", 404),
        Err(e) => {
            console_error!("Failed to get catalog: {}", e);
            Response::error("Internal server error", 500)
        }
    }
}

async fn handle_refresh_catalog(ctx: RouteContext<()>) -> worker::Result<Response> {
    let env = ctx.env;

    match refresh_catalog_internal(&env).await {
        Ok(catalog) => Response::from_json(&catalog),
        Err(e) => {
            console_error!("Failed to refresh catalog: {}", e);
            Response::error("Internal server error", 500)
        }
    }
}

async fn handle_get_costs(ctx: RouteContext<()>) -> worker::Result<Response> {
    let env = ctx.env;

    let r2_client = create_r2_client(&env)?;
    let catalog_manager = CatalogManager::new(&r2_client);
    let cost_calculator = CostCalculator::new(&r2_client);

    // Get catalog for cost calculation
    match catalog_manager.get_catalog().await {
        Ok(Some(catalog)) => {
            match cost_calculator.calculate_costs(&catalog).await {
                Ok(cost_report) => Response::from_json(&cost_report),
                Err(e) => {
                    console_error!("Failed to calculate costs: {}", e);
                    Response::error("Internal server error", 500)
                }
            }
        }
        Ok(None) => Response::error("Catalog not found", 404),
        Err(e) => {
            console_error!("Failed to get catalog: {}", e);
            Response::error("Internal server error", 500)
        }
    }
}

async fn refresh_catalog_internal(env: &Env) -> Result<models::CatalogSummary> {
    let r2_client = create_r2_client(env)
        .map_err(|e| CatalogError::WorkerError(e))?;

    let catalog_manager = CatalogManager::new(&r2_client);
    catalog_manager.update_catalog().await
}

fn create_r2_client(env: &Env) -> worker::Result<R2Client> {
    let raw_bucket = env.bucket("ANALYTICS_SOURCE")?;
    let catalog_bucket = env.bucket("ANALYTICS_CATALOG")?;

    Ok(R2Client::new(raw_bucket, catalog_bucket))
}
