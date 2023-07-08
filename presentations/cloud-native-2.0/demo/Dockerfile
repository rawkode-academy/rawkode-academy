FROM scratch

COPY ./target/wasm32-wasi/release/demo.wasm /demo.wasm

ENTRYPOINT [ "/demo.wasm" ]
