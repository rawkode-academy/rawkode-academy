use protobuf_codegen::{Codegen, Customize};

fn main() {
    std::fs::create_dir_all("src/generated").unwrap();

    Codegen::new()
        .pure()
        .customize(
            protobuf_codegen::Customize::default()
                .lite_runtime(false)
                .generate_accessors(true)
                .generate_getter(false),
        )
        .out_dir("src/generated")
        .include("protos")
        .inputs(&["protos/event-trigger.proto", "protos/people.proto"])
        .run_from_script();
}
