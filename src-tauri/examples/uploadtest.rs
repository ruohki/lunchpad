//! Sends a multipart form with a file part and a raw file body to a local echo server.
use lunchpad_lib::http::{perform, HttpSpec};
use lunchpad_lib::macros::{HttpAuth, HttpBodyMode, HttpFilePart, HttpMethod};
use std::collections::HashMap;

#[tokio::main]
async fn main() {
    let file = std::env::args().nth(1).expect("file to upload");
    let vars: HashMap<&str, String> = HashMap::from([("velocity", "77".to_string())]);
    let base = HttpSpec {
        method: HttpMethod::Post,
        url: "http://127.0.0.1:8766/upload".into(),
        headers: vec![],
        content_type: None,
        body: "title=Clip {{velocity}}\nkind=test".into(),
        body_mode: HttpBodyMode::Multipart,
        body_file: None,
        files: vec![HttpFilePart { field: "sound".into(), path: file.clone(), filename: None, content_type: None }],
        auth: HttpAuth::None,
        timeout_ms: 5000,
        ignore_tls_errors: false,
    };
    let out = perform(&base, &vars).await.expect("multipart");
    println!("multipart: {} {}", out.status, out.body_preview);
    let raw = HttpSpec { body_mode: HttpBodyMode::File, body_file: Some(file), files: vec![], body: String::new(), ..base };
    let out = perform(&raw, &vars).await.expect("file body");
    println!("file body: {} {}", out.status, out.body_preview);
}
