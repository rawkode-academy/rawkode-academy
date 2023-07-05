FROM scratch
COPY --from=build /build/hello_world.wasm /hello_world.wasm
ENTRYPOINT [ "/hello_world.wasm" ]
