use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    routing::post,
    Router,
};
use cloudevents::{
    binding::rdkafka::{FutureRecordExt, MessageRecord},
    EventBuilder, EventBuilderV10,
};
use generated::event_trigger::{EventTrigger, Operation};
use rdkafka::{
    admin::{AdminClient, AdminOptions, NewTopic, TopicReplication},
    client::DefaultClientContext,
    producer::{FutureProducer, FutureRecord},
    ClientConfig,
};
use std::{net::SocketAddr, time::Duration};
use tracing::info;

mod generated;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // Ensure Kafka topic exists before starting
    let mut config = ClientConfig::new();
    config.set("bootstrap.servers", "localhost:9092");

    let admin_client: AdminClient<DefaultClientContext> = config
        .create()
        .expect("Failed to connect to Kafka. Exiting");

    let _ = admin_client
        .create_topics(
            &[NewTopic {
                name: "content-management",
                num_partitions: 1,
                replication: TopicReplication::Fixed(1),
                config: vec![],
            }],
            &AdminOptions::default(),
        )
        .await
        .expect("Failed to create topic. Exiting");

    let producer: FutureProducer = ClientConfig::new()
        .set("bootstrap.servers", "localhost:9092")
        .set("message.timeout.ms", "5000")
        .create()
        .expect("Producer creation error");

    let app = Router::new().route("/", post(receive)).with_state(producer);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    tracing::debug!("listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn receive(
    State(producer): State<FutureProducer>,
    request: Request<Body>,
) -> (StatusCode, String) {
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

    let event_type: (Operation, &str) = (
        event.event.op.enum_value().expect("Unknown Operation"),
        event.table.name.as_str(),
    );

    match event_type {
        (Operation::INSERT, "people") => {
            let mut new_person = generated::people::Person::new();

            new_person.set_name(event.event.data.new.get("name").unwrap().to_string());
            new_person.set_githubHandle(
                event
                    .event
                    .data
                    .new
                    .get("github_handle")
                    .unwrap()
                    .to_string(),
            );

            let cloud_event = EventBuilderV10::new()
                .id(event.id.as_str())
                .ty("NewPerson")
                .source("hasura-event-trigger")
                .data(
                    "application/json",
                    protobuf_json_mapping::print_to_string(&new_person)
                        .expect("Failed to serialize event"),
                )
                .build()
                .unwrap();

            let message_record =
                MessageRecord::from_event(cloud_event).expect("error while serializing the event");

            let _ = producer
                .send(
                    FutureRecord::to("content-management")
                        .message_record(&message_record)
                        .key(event.id.as_str()),
                    Duration::from_secs(10),
                )
                .await;
        }

        _ => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Unhandled SQL Operation: {:?}", event_type),
            )
        }
    }

    (StatusCode::OK, "Handled".to_string())
}
