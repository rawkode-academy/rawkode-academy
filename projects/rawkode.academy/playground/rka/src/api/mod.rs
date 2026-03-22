use anyhow::{anyhow, Result};
use reqwest::Client as ReqwestClient;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Deserialize)]
pub struct CloudInitResponse {
    pub cloud_init: String,
    pub requirements: Requirements,
}

#[derive(Debug, Deserialize)]
pub struct Requirements {
    pub min_cpus: u32,
    pub min_memory_gb: u32,
    pub min_disk_gb: u32,
}

#[derive(Debug, Serialize)]
struct GraphQLRequest {
    query: String,
    variables: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct GraphQLResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GraphQLError>>,
}

#[derive(Debug, Deserialize)]
pub struct GraphQLError {
    message: String,
    extensions: Option<ErrorExtensions>,
}

#[derive(Debug, Deserialize)]
struct ErrorExtensions {
    code: String,
}

#[derive(Debug, Deserialize)]
struct GetCloudInitData {
    #[serde(rename = "getCloudInit")]
    get_cloud_init: CloudInitResponse,
}

#[derive(Debug, Deserialize)]
struct ListCoursesData {
    #[serde(rename = "listCourses")]
    list_courses: Vec<Course>,
}

#[derive(Debug, Deserialize)]
pub struct Course {
    pub id: String,
    pub name: String,
    pub description: String,
    pub difficulty: String,
    pub duration_minutes: u32,
}

pub struct Client {
    http_client: ReqwestClient,
    endpoint: String,
}

impl Client {
    pub fn new(endpoint: &str) -> Result<Self> {
        Ok(Self {
            http_client: ReqwestClient::new(),
            endpoint: endpoint.to_string(),
        })
    }

    pub async fn get_cloud_init(&self, course_id: &str) -> Result<CloudInitResponse> {
        let query = r#"
            query GetCloudInit($courseId: String!, $input: CloudInitInput!) {
                getCloudInit(courseId: $courseId, input: $input) {
                    cloudInit
                    requirements {
                        minCPUs
                        minMemoryGB
                        minDiskGB
                    }
                }
            }
        "#;

        let variables = serde_json::json!({
            "courseId": course_id,
            "input": {
                "platform": env::consts::OS,
                "arch": env::consts::ARCH,
                "cliVersion": env!("CARGO_PKG_VERSION"),
            }
        });

        let request = GraphQLRequest {
            query: query.to_string(),
            variables,
        };

        let response = self
            .http_client
            .post(&self.endpoint)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("API request failed with status: {}", response.status()));
        }

        let graphql_response: GraphQLResponse<GetCloudInitData> = response.json().await?;

        if let Some(errors) = graphql_response.errors {
            let error = &errors[0];
            if let Some(extensions) = &error.extensions {
                match extensions.code.as_str() {
                    "RATE_LIMIT_EXCEEDED" => {
                        return Err(anyhow!("Rate limit exceeded. You can provision up to 5 playgrounds per hour."));
                    }
                    "COURSE_NOT_FOUND" => {
                        return Err(anyhow!("Course '{}' not found. Run 'rka list' to see available courses.", course_id));
                    }
                    _ => {}
                }
            }
            return Err(anyhow!("GraphQL error: {}", error.message));
        }

        graphql_response
            .data
            .map(|d| CloudInitResponse {
                cloud_init: d.get_cloud_init.cloud_init,
                requirements: Requirements {
                    min_cpus: d.get_cloud_init.requirements.min_cpus,
                    min_memory_gb: d.get_cloud_init.requirements.min_memory_gb,
                    min_disk_gb: d.get_cloud_init.requirements.min_disk_gb,
                },
            })
            .ok_or_else(|| anyhow!("No data returned from API"))
    }

    pub async fn list_courses(&self) -> Result<Vec<Course>> {
        let query = r#"
            query ListCourses {
                listCourses {
                    id
                    name
                    description
                    difficulty
                    durationMinutes
                }
            }
        "#;

        let request = GraphQLRequest {
            query: query.to_string(),
            variables: serde_json::json!({}),
        };

        let response = self
            .http_client
            .post(&self.endpoint)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("API request failed with status: {}", response.status()));
        }

        let graphql_response: GraphQLResponse<ListCoursesData> = response.json().await?;

        if let Some(errors) = graphql_response.errors {
            return Err(anyhow!("GraphQL error: {}", errors[0].message));
        }

        graphql_response
            .data
            .map(|d| d.list_courses)
            .ok_or_else(|| anyhow!("No data returned from API"))
    }

    pub async fn track_provision(&self, course_id: &str) -> Result<()> {
        let query = r#"
            mutation TrackProvision($courseId: String!, $input: TrackProvisionInput!) {
                trackProvision(courseId: $courseId, input: $input)
            }
        "#;

        let variables = serde_json::json!({
            "courseId": course_id,
            "input": {
                "platform": env::consts::OS,
                "arch": env::consts::ARCH,
                "cliVersion": env!("CARGO_PKG_VERSION"),
            }
        });

        let request = GraphQLRequest {
            query: query.to_string(),
            variables,
        };

        // Fire and forget - we don't care about the response
        let _ = self
            .http_client
            .post(&self.endpoint)
            .json(&request)
            .send()
            .await;

        Ok(())
    }
}