use crate::models::{GraphQLQuery, GraphQLResponse, Video};
use anyhow::{Context, Result};
use reqwest::Client;

const GRAPHQL_ENDPOINT: &str = "https://api.rawkode.academy/graphql";

pub async fn fetch_all_videos() -> Result<Vec<Video>> {
    let client = Client::new();

    let query = GraphQLQuery {
        query: r#"
            query {
                getAllVideos {
                    id
                    title
                    description
                    technologies {
                        name
                    }
                }
            }
        "#.to_string(),
    };

    let response = client
        .post(GRAPHQL_ENDPOINT)
        .json(&query)
        .send()
        .await
        .context("Failed to send GraphQL request")?;

    if !response.status().is_success() {
        anyhow::bail!(
            "GraphQL request failed with status: {}",
            response.status()
        );
    }

    let graphql_response: GraphQLResponse = response
        .json()
        .await
        .context("Failed to parse GraphQL response")?;

    Ok(graphql_response.data.get_all_videos)
}