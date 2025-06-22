#[cfg(target_arch = "wasm32")]
use worker::{console_error, console_log};

pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

pub fn log_error(msg: &str) {
    #[cfg(target_arch = "wasm32")]
    console_error!("{}", msg);
    
    #[cfg(not(target_arch = "wasm32"))]
    eprintln!("{}", msg);
}

pub fn log_info(msg: &str) {
    #[cfg(target_arch = "wasm32")]
    console_log!("{}", msg);
    
    #[cfg(not(target_arch = "wasm32"))]
    println!("{}", msg);
}
