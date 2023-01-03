use axum::{
    body::Body,
    http::{Request, StatusCode},
    routing::post,
    Router,
};
use generated::event_trigger::{EventTrigger, Operation};
use std::net::SocketAddr;

mod generated;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app = Router::new().route("/", post(receive));

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    tracing::debug!("listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn receive(request: Request<Body>) -> (StatusCode, String) {
    let (_parts, body) = request.into_parts();

    let bytes = match hyper::body::to_bytes(body).await {
        Ok(bytes) => bytes,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Bad Request. Couldn't read bytes: {:?}", error),
            )
        }
    };

    let json = String::from_utf8(bytes.to_vec()).unwrap();

    let event = match protobuf_json_mapping::parse_from_str::<EventTrigger>(json.as_str()) {
        Ok(event) => event,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                format!(
                    "Bad Request. Couldn't transform JSON into EventTrigger: {:?}",
                    error
                ),
            )
        }
    };

    match event.event.op.enum_value() {
        Ok(Operation::INSERT) => println!("INSERT"),
        Ok(Operation::UPDATE) => println!("UPDATE"),
        Ok(Operation::DELETE) => println!("DELETE"),
        Ok(Operation::MANUAL) => println!("MANUAL"),
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                format!(
                    "Bad Request. Unknown Operation for EventTrigger: {:?}",
                    error
                ),
            )
        }
    }

    (StatusCode::OK, "Handled".to_string())
}
