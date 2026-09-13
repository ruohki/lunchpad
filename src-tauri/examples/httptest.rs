//! Round trip: HTTP GET → variable → script reads it. `cargo run --example httptest <url>`
use lunchpad_lib::http::{perform, HttpSpec};
use lunchpad_lib::macros::{HttpAuth, HttpMethod};
use lunchpad_lib::script::{run, ScriptInput};
use std::collections::HashMap;

#[tokio::main]
async fn main() {
    let url = std::env::args().nth(1).unwrap_or_else(|| "http://127.0.0.1:8765/weather.json".into());
    let spec = HttpSpec {
        method: HttpMethod::Get,
        url: format!("{url}?v={{{{velocity}}}}"),
        headers: vec![("X-Pad".into(), "{{x}},{{y}}".into())],
        content_type: None,
        body: String::new(),
        body_mode: lunchpad_lib::macros::HttpBodyMode::Text,
        body_file: None,
        files: vec![],
        auth: HttpAuth::Bearer { token: "secret".into() },
        timeout_ms: 5000,
        ignore_tls_errors: false,
        response: lunchpad_lib::macros::HttpResponse::Text,
        response_field: String::new(),
        file_name: String::new(),
        reuse: false,
    };
    let mut vars: HashMap<&str, String> = HashMap::new();
    vars.insert("velocity", "99".into());
    vars.insert("x", "2".into());
    vars.insert("y", "3".into());
    let out = perform(&spec, &vars, &lunchpad_lib::http::fallback_download_dir()).await.expect("request");
    println!("status {} in {} ms: {}", out.status, out.elapsed_ms, out.body_preview.trim());

    let mut locals = HashMap::new();
    locals.insert("weather".to_string(), out.body_preview.clone());
    locals.insert("weather.status".to_string(), out.status.to_string());
    let globals = HashMap::new();
    let mut builtins = HashMap::new();
    builtins.insert("velocity", "99".to_string());
    let script = "const w = JSON.parse(vars.weather); globals.lastTemp = w.temp; return w.temp > 20 ? 'warm (' + velocity + ')' : 'cold'";
    let result = run(ScriptInput { code: script, locals: &locals, globals: &globals, builtins: &builtins }).expect("script");
    println!("script result: {:?}, globals: {:?}", result.result, result.globals);
}
