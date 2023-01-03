use protobuf_codegen::Codegen;

fn main() {
    Codegen::new()
        .pure()
        .out_dir("src/generated")
        .include("protos")
        .inputs(&["protos/event-trigger.proto"])
        .run_from_script();
}
