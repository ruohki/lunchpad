//! HTTP requests from macros: any method, custom headers and body, basic or
//! bearer authentication, with `{{velocity}}` / `{{x}}` / `{{y}}` / `{{pageId}}`
//! placeholders in the URL, headers and body.

use crate::macros::{HttpAuth, HttpBodyMode, HttpFilePart, HttpMethod};
use std::path::Path;
use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct HttpSpec {
    pub method: HttpMethod,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub content_type: Option<String>,
    pub body: String,
    pub body_mode: HttpBodyMode,
    pub body_file: Option<String>,
    pub files: Vec<HttpFilePart>,
    pub auth: HttpAuth,
    pub timeout_ms: u64,
    pub ignore_tls_errors: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpOutcome {
    pub status: u16,
    pub ok: bool,
    pub elapsed_ms: u64,
    /// First 2 KB of the response body
    pub body_preview: String,
}

/// Replace `{{name}}` placeholders. Unknown names are left as they are.
pub fn substitute(template: &str, vars: &HashMap<&str, String>) -> String {
    let mut out = template.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("{{{{{k}}}}}"), v);
    }
    out
}

pub async fn perform(spec: &HttpSpec, vars: &HashMap<&str, String>) -> Result<HttpOutcome, String> {
    let url = substitute(spec.url.trim(), vars);
    if url.is_empty() {
        return Err("no URL set".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(spec.timeout_ms.clamp(500, 120_000)))
        .danger_accept_invalid_certs(spec.ignore_tls_errors)
        .user_agent(concat!("Lunchpad/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;

    let method = match spec.method {
        HttpMethod::Get => reqwest::Method::GET,
        HttpMethod::Post => reqwest::Method::POST,
        HttpMethod::Put => reqwest::Method::PUT,
        HttpMethod::Patch => reqwest::Method::PATCH,
        HttpMethod::Delete => reqwest::Method::DELETE,
        HttpMethod::Head => reqwest::Method::HEAD,
    };
    let mut req = client.request(method.clone(), &url);
    for (name, value) in &spec.headers {
        if !name.trim().is_empty() {
            req = req.header(name.trim(), substitute(value, vars));
        }
    }
    match &spec.auth {
        HttpAuth::None => {}
        HttpAuth::Basic { username, password } => req = req.basic_auth(username, Some(substitute(password, vars))),
        HttpAuth::Bearer { token } => req = req.bearer_auth(substitute(token, vars)),
    }
    let can_have_body = !matches!(method, reqwest::Method::GET | reqwest::Method::HEAD);
    if can_have_body {
        match spec.body_mode {
            HttpBodyMode::Text => {
                if !spec.body.is_empty() {
                    if let Some(ct) = spec.content_type.as_deref().filter(|c| !c.is_empty()) {
                        req = req.header(reqwest::header::CONTENT_TYPE, ct);
                    }
                    req = req.body(substitute(&spec.body, vars));
                }
            }
            HttpBodyMode::File => {
                let path = substitute(spec.body_file.as_deref().unwrap_or(""), vars);
                if path.trim().is_empty() {
                    return Err("no file chosen for the body".into());
                }
                let bytes = tokio::fs::read(&path).await.map_err(|e| format!("could not read {path}: {e}"))?;
                let ct = spec
                    .content_type
                    .clone()
                    .filter(|c| !c.is_empty())
                    .unwrap_or_else(|| mime_guess::from_path(&path).first_or_octet_stream().to_string());
                req = req.header(reqwest::header::CONTENT_TYPE, ct).body(bytes);
            }
            HttpBodyMode::Multipart => {
                let mut form = reqwest::multipart::Form::new();
                for line in spec.body.lines() {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    let (name, value) = line.split_once('=').unwrap_or((line, ""));
                    form = form.text(name.trim().to_string(), substitute(value.trim(), vars));
                }
                for part in &spec.files {
                    let path = substitute(&part.path, vars);
                    if path.trim().is_empty() {
                        continue;
                    }
                    let bytes = tokio::fs::read(&path).await.map_err(|e| format!("could not read {path}: {e}"))?;
                    let filename = part
                        .filename
                        .clone()
                        .filter(|f| !f.is_empty())
                        .map(|f| substitute(&f, vars))
                        .or_else(|| Path::new(&path).file_name().map(|n| n.to_string_lossy().to_string()))
                        .unwrap_or_else(|| "file".into());
                    let mime = part
                        .content_type
                        .clone()
                        .filter(|c| !c.is_empty())
                        .unwrap_or_else(|| mime_guess::from_path(&path).first_or_octet_stream().to_string());
                    let mut p = reqwest::multipart::Part::bytes(bytes).file_name(filename);
                    p = p.mime_str(&mime).map_err(|e| e.to_string())?;
                    let field = if part.field.trim().is_empty() { "file".to_string() } else { substitute(part.field.trim(), vars) };
                    form = form.part(field, p);
                }
                req = req.multipart(form);
            }
        }
    }

    let started = std::time::Instant::now();
    let response = req.send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    let body_preview: String = text.chars().take(2048).collect();
    Ok(HttpOutcome { status: status.as_u16(), ok: status.is_success(), elapsed_ms: started.elapsed().as_millis() as u64, body_preview })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn substitutes_placeholders() {
        let mut vars = HashMap::new();
        vars.insert("velocity", "100".to_string());
        vars.insert("x", "3".to_string());
        assert_eq!(substitute("v={{velocity}}&x={{x}}&keep={{unknown}}", &vars), "v=100&x=3&keep={{unknown}}");
    }
}
