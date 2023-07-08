use anyhow::Result;
use spin_sdk::{
    http::{Request, Response},
    http_component,
    key_value::{Store},

};

#[http_component]
fn handle_demo(_req: Request) -> Result<Response> {
    let _ = Store::open_default()?;

    Ok(http::Response::builder()
        .status(200)
        .header("foo", "bar")
        .body(Some("Hello, Fermyon".into()))?)
}
