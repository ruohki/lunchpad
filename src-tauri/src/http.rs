//! HTTP requests from macros: any method, custom headers and body, basic or
//! bearer authentication, `{{placeholders}}` in the URL, headers, body, auth
//! and file names, and a choice of what becomes of the response: the text in
//! a variable, or a file made from the body, from a base64 field or from a
//! URL found in a field.
//!
//! Files land in the download folder under a name derived from the expanded
//! request (or a name the user chose), so an action with `reuse` on finds
//! the file of an unchanged request and skips the network altogether. That
//! is what makes generated audio (text to speech services and the like)
//! cheap to trigger again and again.

use crate::macros::{HttpAuth, HttpBodyMode, HttpFilePart, HttpMethod, HttpResponse};
use base64::engine::{DecodePaddingMode, GeneralPurpose, GeneralPurposeConfig};
use base64::{alphabet, Engine};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::Manager;

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
    pub response: HttpResponse,
    pub response_field: String,
    pub file_name: String,
    pub reuse: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpOutcome {
    pub status: u16,
    pub ok: bool,
    pub elapsed_ms: u64,
    /// First 2 KB of a text response (empty for binary bodies)
    pub body_preview: String,
    /// Size of the response body
    pub bytes: u64,
    /// The file the response was saved to
    pub file: Option<String>,
    /// The file existed already and the request was skipped
    pub cached: bool,
    /// The server answered but the response could not be turned into a file
    pub error: Option<String>,
}

/// How much of a text body goes into the variable and the editor's preview.
const PREVIEW_CHARS: usize = 2048;

/// Replace `{{name}}` placeholders. Unknown names are left as they are.
pub fn substitute(template: &str, vars: &HashMap<&str, String>) -> String {
    let mut out = template.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("{{{{{k}}}}}"), v);
    }
    out
}

/// Where HTTP actions keep their files.
pub fn download_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_cache_dir().map(|p| p.join("downloads")).unwrap_or_else(|_| fallback_download_dir())
}

/// The download folder when there is no app (tests, headless engine).
pub fn fallback_download_dir() -> PathBuf {
    std::env::temp_dir().join("lunchpad-downloads")
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadCacheInfo {
    pub path: String,
    pub files: u64,
    pub bytes: u64,
}

/// Files and size of the download folder (top level only).
pub fn cache_info(dir: &Path) -> DownloadCacheInfo {
    let mut files = 0;
    let mut bytes = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    files += 1;
                    bytes += meta.len();
                }
            }
        }
    }
    DownloadCacheInfo { path: dir.display().to_string(), files, bytes }
}

/// Remove every file in the download folder; returns how many went. Files an
/// action wrote to a path of its own elsewhere are left alone.
pub fn clear_cache(dir: &Path) -> Result<u64, String> {
    let mut removed = 0;
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(e) => return Err(e.to_string()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            std::fs::remove_file(&path).map_err(|e| format!("could not remove {}: {e}", path.display()))?;
            removed += 1;
        }
    }
    Ok(removed)
}

// ----- the request after placeholder expansion ------------------------------

/// Size and modification time of a file that is part of the request, so the
/// cache key changes when the file does.
#[derive(Debug, Clone, Serialize)]
struct FileStamp {
    path: String,
    len: u64,
    modified: u64,
}

impl FileStamp {
    fn of(path: String) -> FileStamp {
        let meta = std::fs::metadata(&path).ok();
        let len = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        FileStamp { path, len, modified }
    }
}

#[derive(Debug, Clone, Serialize)]
struct ExpandedPart {
    field: String,
    file: FileStamp,
    filename: Option<String>,
    content_type: Option<String>,
}

/// Everything that decides what the server answers; its hash is the cache key.
#[derive(Debug, Clone, Serialize)]
struct Expanded {
    method: HttpMethod,
    url: String,
    headers: Vec<(String, String)>,
    content_type: Option<String>,
    body: String,
    body_mode: HttpBodyMode,
    body_file: Option<FileStamp>,
    files: Vec<ExpandedPart>,
    auth: HttpAuth,
    response: HttpResponse,
    field: String,
}

fn expand(spec: &HttpSpec, vars: &HashMap<&str, String>) -> Expanded {
    let can_have_body = !matches!(spec.method, HttpMethod::Get | HttpMethod::Head);
    let auth = match &spec.auth {
        HttpAuth::None => HttpAuth::None,
        HttpAuth::Basic { username, password } => HttpAuth::Basic { username: substitute(username, vars), password: substitute(password, vars) },
        HttpAuth::Bearer { token } => HttpAuth::Bearer { token: substitute(token, vars) },
    };
    let body_file = match spec.body_mode {
        HttpBodyMode::File if can_have_body => Some(FileStamp::of(substitute(spec.body_file.as_deref().unwrap_or(""), vars))),
        _ => None,
    };
    let files = if can_have_body && spec.body_mode == HttpBodyMode::Multipart {
        spec.files
            .iter()
            .map(|part| ExpandedPart {
                field: substitute(part.field.trim(), vars),
                file: FileStamp::of(substitute(&part.path, vars)),
                filename: part.filename.clone().filter(|f| !f.is_empty()).map(|f| substitute(&f, vars)),
                content_type: part.content_type.clone().filter(|c| !c.is_empty()),
            })
            .collect()
    } else {
        Vec::new()
    };
    Expanded {
        method: spec.method,
        url: substitute(spec.url.trim(), vars),
        headers: spec
            .headers
            .iter()
            .filter(|(name, _)| !name.trim().is_empty())
            .map(|(name, value)| (name.trim().to_string(), substitute(value, vars)))
            .collect(),
        content_type: spec.content_type.clone().filter(|c| !c.is_empty()),
        body: if can_have_body && spec.body_mode != HttpBodyMode::File { substitute(&spec.body, vars) } else { String::new() },
        body_mode: spec.body_mode,
        body_file,
        files,
        auth,
        response: spec.response,
        field: spec.response_field.trim().to_string(),
    }
}

/// 24 hex characters that identify an expanded request.
fn cache_key(req: &Expanded) -> String {
    let json = serde_json::to_vec(req).unwrap_or_default();
    let digest = Sha256::digest(&json);
    hex::encode(&digest[..12])
}

// ----- where the file goes ---------------------------------------------------

/// The file a request writes: a folder, a stem, and an extension that is either
/// chosen by the user or guessed from the response.
#[derive(Debug, Clone, PartialEq)]
struct Target {
    dir: PathBuf,
    stem: String,
    ext: Option<String>,
}

impl Target {
    fn new(download_dir: &Path, file_name: &str, key: &str) -> Target {
        let name = file_name.trim();
        if name.is_empty() {
            return Target { dir: download_dir.to_path_buf(), stem: key.to_string(), ext: None };
        }
        let path = Path::new(name);
        if path.is_absolute() {
            let dir = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(download_dir).to_path_buf();
            let stem = path.file_stem().map(|s| s.to_string_lossy().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| key.to_string());
            let ext = path.extension().map(|e| e.to_string_lossy().to_string());
            return Target { dir, stem, ext };
        }
        let safe = sanitize_file_name(name);
        if safe.is_empty() {
            return Target { dir: download_dir.to_path_buf(), stem: key.to_string(), ext: None };
        }
        let (stem, ext) = split_extension(&safe);
        Target { dir: download_dir.to_path_buf(), stem, ext }
    }

    fn path(&self, ext: &str) -> PathBuf {
        self.dir.join(format!("{}.{ext}", self.stem))
    }

    /// The file of this target if it exists (any extension when none is fixed).
    fn existing(&self) -> Option<PathBuf> {
        match &self.ext {
            Some(ext) => {
                let path = self.path(ext);
                path.is_file().then_some(path)
            }
            None => std::fs::read_dir(&self.dir)
                .ok()?
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.is_file())
                .filter(|path| path.extension().map(|e| e != "part").unwrap_or(true))
                .find(|path| path.file_stem().map(|s| s == self.stem.as_str()).unwrap_or(false)),
        }
    }

    /// Write the bytes, through a `.part` file so a reader never sees half a file.
    async fn write(&self, guessed_ext: &str, bytes: &[u8]) -> Result<PathBuf, String> {
        let ext = self.ext.clone().unwrap_or_else(|| guessed_ext.to_string());
        let path = self.path(&ext);
        tokio::fs::create_dir_all(&self.dir).await.map_err(|e| format!("could not create {}: {e}", self.dir.display()))?;
        let part = self.dir.join(format!("{}.{ext}.part", self.stem));
        tokio::fs::write(&part, bytes).await.map_err(|e| format!("could not write {}: {e}", part.display()))?;
        tokio::fs::rename(&part, &path).await.map_err(|e| format!("could not write {}: {e}", path.display()))?;
        Ok(path)
    }
}

/// A file name that every platform accepts: no path separators or reserved
/// characters, no leading or trailing dots and spaces, at most 120 characters.
fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') { '_' } else { c })
        .take(120)
        .collect();
    cleaned.trim_matches(|c: char| c == '.' || c == ' ').to_string()
}

/// `voice.mp3` → (`voice`, `mp3`); names without a short alphanumeric suffix
/// keep their dots and get the extension from the response.
fn split_extension(name: &str) -> (String, Option<String>) {
    if let Some((stem, ext)) = name.rsplit_once('.') {
        let short = (1..=5).contains(&ext.len()) && ext.chars().all(|c| c.is_ascii_alphanumeric());
        if !stem.is_empty() && short {
            return (stem.to_string(), Some(ext.to_ascii_lowercase()));
        }
    }
    (name.to_string(), None)
}

// ----- what the bytes are ---------------------------------------------------

/// Extension from the bytes themselves, then the content type, then the URL.
fn extension_for(content_type: Option<&str>, url: Option<&str>, bytes: &[u8]) -> String {
    if let Some(ext) = sniff(bytes) {
        return ext.to_string();
    }
    if let Some(ct) = content_type {
        let ct = ct.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
        if let Some(ext) = extension_of_mime(&ct) {
            return ext.to_string();
        }
        if ct != "application/octet-stream" {
            if let Some(ext) = mime_guess::get_mime_extensions_str(&ct).and_then(|list| list.first()) {
                return ext.to_string();
            }
        }
    }
    if let Some(url) = url {
        let path = url.split(['?', '#']).next().unwrap_or("");
        let name = path.rsplit('/').next().unwrap_or("");
        if let (_, Some(ext)) = split_extension(name) {
            return ext;
        }
    }
    "bin".to_string()
}

fn extension_of_mime(ct: &str) -> Option<&'static str> {
    Some(match ct {
        "audio/mpeg" | "audio/mp3" | "audio/mpeg3" => "mp3",
        "audio/wav" | "audio/x-wav" | "audio/wave" | "audio/vnd.wave" => "wav",
        "audio/ogg" | "application/ogg" => "ogg",
        "audio/opus" => "opus",
        "audio/flac" | "audio/x-flac" => "flac",
        "audio/aac" | "audio/aacp" => "aac",
        "audio/mp4" | "audio/x-m4a" | "audio/m4a" => "m4a",
        "audio/webm" | "video/webm" => "webm",
        "video/mp4" => "mp4",
        "application/json" => "json",
        "text/plain" => "txt",
        "text/html" => "html",
        "text/xml" | "application/xml" => "xml",
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        _ => return None,
    })
}

/// Magic bytes of the formats a sound action can play, plus a few images.
fn sniff(b: &[u8]) -> Option<&'static str> {
    if b.len() < 4 {
        return None;
    }
    if b.starts_with(b"ID3") {
        return Some("mp3");
    }
    if b.starts_with(b"RIFF") && b.len() >= 12 {
        return match &b[8..12] {
            b"WAVE" => Some("wav"),
            b"WEBP" => Some("webp"),
            _ => None,
        };
    }
    if b.starts_with(b"OggS") {
        return Some("ogg");
    }
    if b.starts_with(b"fLaC") {
        return Some("flac");
    }
    if b.len() >= 12 && &b[4..8] == b"ftyp" {
        return Some(if b[8..12].starts_with(b"M4A") { "m4a" } else { "mp4" });
    }
    if b.starts_with(&[0x1A, 0x45, 0xDF, 0xA3]) {
        return Some("webm");
    }
    if b.starts_with(&[0x89, b'P', b'N', b'G']) {
        return Some("png");
    }
    if b.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some("jpg");
    }
    if b.starts_with(b"GIF8") {
        return Some("gif");
    }
    // ADTS (AAC) and MPEG audio frames both start with 11 sync bits; the layer
    // bits tell them apart (00 = ADTS).
    if b[0] == 0xFF && b[1] & 0xE0 == 0xE0 {
        return Some(if b[1] & 0x06 == 0 { "aac" } else { "mp3" });
    }
    None
}

fn text_like(content_type: Option<&str>) -> bool {
    match content_type {
        None => true,
        Some(ct) => {
            let ct = ct.to_ascii_lowercase();
            ct.starts_with("text/") || ct.contains("json") || ct.contains("xml") || ct.contains("javascript") || ct.contains("x-www-form-urlencoded")
        }
    }
}

fn preview(content_type: Option<&str>, bytes: &[u8]) -> String {
    if !text_like(content_type) {
        return String::new();
    }
    let head = &bytes[..bytes.len().min(PREVIEW_CHARS * 4)];
    String::from_utf8_lossy(head).chars().take(PREVIEW_CHARS).collect()
}

/// Walk a dot path (`data.0.url`, `choices[0].text`) through a JSON value.
pub fn json_field<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let normalized = path.replace('[', ".").replace(']', "");
    let mut current = value;
    for segment in normalized.split('.').map(str::trim).filter(|s| !s.is_empty()) {
        current = match current {
            Value::Array(items) => items.get(segment.parse::<usize>().ok()?)?,
            Value::Object(map) => map.get(segment)?,
            _ => return None,
        };
    }
    Some(current)
}

/// The text of a field in the response, or the whole body when no field is set.
fn field_text(bytes: &[u8], field: &str) -> Result<String, String> {
    let text = std::str::from_utf8(bytes).map_err(|_| "the response is not text".to_string())?;
    if field.trim().is_empty() {
        return Ok(text.trim().to_string());
    }
    let json: Value = serde_json::from_str(text).map_err(|e| format!("the response is not JSON: {e}"))?;
    match json_field(&json, field) {
        Some(Value::String(s)) => Ok(s.clone()),
        Some(Value::Null) | None => Err(format!("field \"{field}\" is not in the response")),
        Some(other) => Ok(other.to_string()),
    }
}

/// Decode base64 with or without padding, standard or URL-safe alphabet,
/// with whitespace and a `data:...;base64,` prefix tolerated.
fn decode_base64(text: &str) -> Result<Vec<u8>, String> {
    let trimmed = text.trim();
    let payload = match trimmed.find(";base64,") {
        Some(i) if trimmed.starts_with("data:") => &trimmed[i + ";base64,".len()..],
        _ => trimmed,
    };
    let cleaned: String = payload.chars().filter(|c| !c.is_whitespace()).collect();
    let config = GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent);
    let standard = GeneralPurpose::new(&alphabet::STANDARD, config);
    let url_safe = GeneralPurpose::new(&alphabet::URL_SAFE, config);
    standard.decode(&cleaned).or_else(|_| url_safe.decode(&cleaned)).map_err(|e| format!("the field is not base64: {e}"))
}

// ----- sending ---------------------------------------------------------------

fn client(spec: &HttpSpec) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_millis(spec.timeout_ms.clamp(500, 120_000)))
        .danger_accept_invalid_certs(spec.ignore_tls_errors)
        .user_agent(concat!("Lunchpad/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

fn content_type_of(response: &reqwest::Response) -> Option<String> {
    response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).map(|s| s.to_string())
}

struct Answer {
    status: u16,
    content_type: Option<String>,
    bytes: Vec<u8>,
}

async fn send(client: &reqwest::Client, req: &Expanded) -> Result<Answer, String> {
    let method = match req.method {
        HttpMethod::Get => reqwest::Method::GET,
        HttpMethod::Post => reqwest::Method::POST,
        HttpMethod::Put => reqwest::Method::PUT,
        HttpMethod::Patch => reqwest::Method::PATCH,
        HttpMethod::Delete => reqwest::Method::DELETE,
        HttpMethod::Head => reqwest::Method::HEAD,
    };
    let mut builder = client.request(method.clone(), &req.url);
    for (name, value) in &req.headers {
        builder = builder.header(name.as_str(), value.as_str());
    }
    match &req.auth {
        HttpAuth::None => {}
        HttpAuth::Basic { username, password } => builder = builder.basic_auth(username, Some(password)),
        HttpAuth::Bearer { token } => builder = builder.bearer_auth(token),
    }
    let can_have_body = !matches!(method, reqwest::Method::GET | reqwest::Method::HEAD);
    if can_have_body {
        match req.body_mode {
            HttpBodyMode::Text => {
                if !req.body.is_empty() {
                    if let Some(ct) = &req.content_type {
                        builder = builder.header(reqwest::header::CONTENT_TYPE, ct);
                    }
                    builder = builder.body(req.body.clone());
                }
            }
            HttpBodyMode::File => {
                let path = req.body_file.as_ref().map(|f| f.path.as_str()).unwrap_or("");
                if path.trim().is_empty() {
                    return Err("no file chosen for the body".into());
                }
                let bytes = tokio::fs::read(path).await.map_err(|e| format!("could not read {path}: {e}"))?;
                let ct = req.content_type.clone().unwrap_or_else(|| mime_guess::from_path(path).first_or_octet_stream().to_string());
                builder = builder.header(reqwest::header::CONTENT_TYPE, ct).body(bytes);
            }
            HttpBodyMode::Multipart => {
                let mut form = reqwest::multipart::Form::new();
                for line in req.body.lines() {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    let (name, value) = line.split_once('=').unwrap_or((line, ""));
                    form = form.text(name.trim().to_string(), value.trim().to_string());
                }
                for part in &req.files {
                    let path = part.file.path.as_str();
                    if path.trim().is_empty() {
                        continue;
                    }
                    let bytes = tokio::fs::read(path).await.map_err(|e| format!("could not read {path}: {e}"))?;
                    let filename = part
                        .filename
                        .clone()
                        .or_else(|| Path::new(path).file_name().map(|n| n.to_string_lossy().to_string()))
                        .unwrap_or_else(|| "file".into());
                    let mime = part.content_type.clone().unwrap_or_else(|| mime_guess::from_path(path).first_or_octet_stream().to_string());
                    let piece = reqwest::multipart::Part::bytes(bytes).file_name(filename).mime_str(&mime).map_err(|e| e.to_string())?;
                    let field = if part.field.is_empty() { "file".to_string() } else { part.field.clone() };
                    form = form.part(field, piece);
                }
                builder = builder.multipart(form);
            }
        }
    }

    let response = builder.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let content_type = content_type_of(&response);
    let bytes = response.bytes().await.map_err(|e| e.to_string())?.to_vec();
    Ok(Answer { status, content_type, bytes })
}

/// Turn a successful answer into the file the action asked for.
async fn store(spec: &HttpSpec, req: &Expanded, client: &reqwest::Client, target: &Target, content_type: Option<&str>, bytes: &[u8]) -> Result<Option<PathBuf>, String> {
    match spec.response {
        HttpResponse::Text => {
            if spec.reuse {
                Ok(Some(target.write("txt", bytes).await?))
            } else {
                Ok(None)
            }
        }
        HttpResponse::File => {
            let ext = extension_for(content_type, Some(&req.url), bytes);
            Ok(Some(target.write(&ext, bytes).await?))
        }
        HttpResponse::Base64Field => {
            let data = decode_base64(&field_text(bytes, &req.field)?)?;
            let ext = extension_for(None, None, &data);
            Ok(Some(target.write(&ext, &data).await?))
        }
        HttpResponse::UrlField => {
            let url = field_text(bytes, &req.field)?;
            let url = url.trim();
            if !(url.starts_with("http://") || url.starts_with("https://")) {
                let shown: String = url.chars().take(80).collect();
                return Err(format!("the field does not hold a web address: {shown}"));
            }
            let response = client.get(url).send().await.map_err(|e| format!("download failed: {e}"))?;
            if !response.status().is_success() {
                return Err(format!("the download answered with status {}", response.status().as_u16()));
            }
            let ct = content_type_of(&response);
            let data = response.bytes().await.map_err(|e| format!("download failed: {e}"))?;
            let ext = extension_for(ct.as_deref(), Some(url), &data);
            Ok(Some(target.write(&ext, &data).await?))
        }
    }
}

/// Run the request (or find its file from an earlier run) and say what came of it.
pub async fn perform(spec: &HttpSpec, vars: &HashMap<&str, String>, download_dir: &Path) -> Result<HttpOutcome, String> {
    let req = expand(spec, vars);
    if req.url.is_empty() {
        return Err("no URL set".into());
    }
    let target = Target::new(download_dir, &substitute(&spec.file_name, vars), &cache_key(&req));

    if spec.reuse {
        if let Some(path) = target.existing() {
            let bytes = tokio::fs::metadata(&path).await.map(|m| m.len()).unwrap_or(0);
            let body_preview = if spec.response == HttpResponse::Text {
                tokio::fs::read(&path).await.map(|b| preview(None, &b)).unwrap_or_default()
            } else {
                String::new()
            };
            tracing::info!(url = %req.url, file = %path.display(), "http request reused its file");
            return Ok(HttpOutcome { status: 200, ok: true, elapsed_ms: 0, body_preview, bytes, file: Some(path.display().to_string()), cached: true, error: None });
        }
    }

    let client = client(spec)?;
    let started = Instant::now();
    let answer = send(&client, &req).await?;
    let elapsed_ms = started.elapsed().as_millis() as u64;
    let ok = (200..300).contains(&answer.status);
    let mut outcome = HttpOutcome {
        status: answer.status,
        ok,
        elapsed_ms,
        body_preview: preview(answer.content_type.as_deref(), &answer.bytes),
        bytes: answer.bytes.len() as u64,
        file: None,
        cached: false,
        error: None,
    };
    if !ok {
        return Ok(outcome);
    }
    match store(spec, &req, &client, &target, answer.content_type.as_deref(), &answer.bytes).await {
        Ok(file) => outcome.file = file.map(|p| p.display().to_string()),
        Err(e) => {
            tracing::warn!(url = %req.url, error = %e, "http response could not be saved");
            outcome.error = Some(e);
        }
    }
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(url: &str) -> HttpSpec {
        HttpSpec {
            method: HttpMethod::Get,
            url: url.into(),
            headers: Vec::new(),
            content_type: None,
            body: String::new(),
            body_mode: HttpBodyMode::Text,
            body_file: None,
            files: Vec::new(),
            auth: HttpAuth::None,
            timeout_ms: 1000,
            ignore_tls_errors: false,
            response: HttpResponse::Text,
            response_field: String::new(),
            file_name: String::new(),
            reuse: false,
        }
    }

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lunchpad-http-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn substitutes_placeholders() {
        let mut vars = HashMap::new();
        vars.insert("velocity", "100".to_string());
        vars.insert("x", "3".to_string());
        assert_eq!(substitute("v={{velocity}}&x={{x}}&keep={{unknown}}", &vars), "v=100&x=3&keep={{unknown}}");
    }

    #[test]
    fn cache_key_follows_the_inputs() {
        let mut vars = HashMap::new();
        vars.insert("text", "hello".to_string());
        let mut a = spec("https://api/tts");
        a.method = HttpMethod::Post;
        a.body = "{\"text\":\"{{text}}\"}".into();
        let key1 = cache_key(&expand(&a, &vars));
        assert_eq!(key1.len(), 24);
        assert_eq!(key1, cache_key(&expand(&a, &vars)), "stable for the same inputs");
        vars.insert("text", "bye".to_string());
        assert_ne!(key1, cache_key(&expand(&a, &vars)), "a different placeholder value is a different request");
        let mut b = a.clone();
        b.response = HttpResponse::Base64Field;
        assert_ne!(key1, cache_key(&expand(&b, &vars)), "the response mode is part of the key");
    }

    #[test]
    fn targets() {
        let dir = Path::new("/cache");
        assert_eq!(Target::new(dir, "", "abc"), Target { dir: dir.into(), stem: "abc".into(), ext: None });
        assert_eq!(Target::new(dir, "voice.mp3", "abc"), Target { dir: dir.into(), stem: "voice".into(), ext: Some("mp3".into()) });
        assert_eq!(Target::new(dir, "Dr. Who says hi", "abc"), Target { dir: dir.into(), stem: "Dr. Who says hi".into(), ext: None });
        assert_eq!(Target::new(dir, "a/b:c?.wav", "abc"), Target { dir: dir.into(), stem: "a_b_c_".into(), ext: Some("wav".into()) });
        assert_eq!(Target::new(dir, "/tmp/out/clip.WAV", "abc"), Target { dir: "/tmp/out".into(), stem: "clip".into(), ext: Some("WAV".into()) });
        assert_eq!(Target::new(dir, " ... ", "abc").stem, "abc", "a name that sanitizes to nothing falls back to the key");
        assert_eq!(Target::new(dir, "x", "abc").path("mp3"), PathBuf::from("/cache/x.mp3"));
    }

    #[test]
    fn json_fields() {
        let v: Value = serde_json::from_str(r#"{"audioContent":"QUJD","data":[{"url":"https://x/1.mp3"},{"url":"https://x/2.mp3"}],"n":3}"#).unwrap();
        assert_eq!(json_field(&v, "audioContent").unwrap(), "QUJD");
        assert_eq!(json_field(&v, "data.1.url").unwrap(), "https://x/2.mp3");
        assert_eq!(json_field(&v, "data[0].url").unwrap(), "https://x/1.mp3");
        assert!(json_field(&v, "data.5.url").is_none());
        assert!(json_field(&v, "missing").is_none());
        assert_eq!(field_text(br#"{"n":3}"#, "n").unwrap(), "3");
        assert_eq!(field_text(b"  aGVsbG8=\n", "").unwrap(), "aGVsbG8=");
        assert!(field_text(b"not json", "a").is_err());
    }

    #[test]
    fn base64_variants() {
        assert_eq!(decode_base64("aGVsbG8=").unwrap(), b"hello");
        assert_eq!(decode_base64("aGVsbG8").unwrap(), b"hello", "missing padding");
        assert_eq!(decode_base64("aGVs\nbG8=\n").unwrap(), b"hello", "line breaks");
        assert_eq!(decode_base64("data:audio/mpeg;base64,aGVsbG8=").unwrap(), b"hello", "data url");
        assert_eq!(decode_base64("-_-_").unwrap(), [0xFB, 0xFF, 0xBF], "url-safe alphabet");
        assert!(decode_base64("not base64!").is_err());
    }

    #[test]
    fn extensions() {
        assert_eq!(extension_for(None, None, b"ID3\x04\x00\x00\x00\x00\x00\x00"), "mp3");
        assert_eq!(extension_for(None, None, b"RIFF\x00\x00\x00\x00WAVEfmt "), "wav");
        assert_eq!(extension_for(None, None, b"OggS\x00\x02\x00\x00"), "ogg");
        assert_eq!(extension_for(None, None, b"fLaC\x00\x00\x00\x22"), "flac");
        assert_eq!(extension_for(None, None, b"\x00\x00\x00\x20ftypM4A \x00\x00"), "m4a");
        assert_eq!(extension_for(None, None, &[0xFF, 0xFB, 0x90, 0x64]), "mp3");
        assert_eq!(extension_for(None, None, &[0xFF, 0xF1, 0x50, 0x80]), "aac");
        assert_eq!(extension_for(Some("audio/mpeg; charset=binary"), None, b"????"), "mp3");
        assert_eq!(extension_for(Some("application/json"), None, b"{}  "), "json");
        assert_eq!(extension_for(Some("application/octet-stream"), Some("https://x/y/clip.ogg?token=1"), b"????"), "ogg");
        assert_eq!(extension_for(None, Some("https://x/y/clip"), b"????"), "bin");
    }

    #[test]
    fn previews() {
        assert_eq!(preview(Some("audio/mpeg"), b"ID3xxxx"), "");
        assert_eq!(preview(Some("application/json; charset=utf-8"), b"{\"a\":1}"), "{\"a\":1}");
        assert_eq!(preview(None, b"plain"), "plain");
    }

    #[tokio::test]
    async fn stores_and_reuses_files() {
        let dir = temp_dir();
        let client = reqwest::Client::new();
        let vars = HashMap::new();

        // A base64 field becomes a file whose extension comes from its bytes.
        let mut a = spec("https://api/tts");
        a.response = HttpResponse::Base64Field;
        a.response_field = "audio.data".into();
        a.reuse = true;
        let req = expand(&a, &vars);
        let target = Target::new(&dir, "", &cache_key(&req));
        assert!(target.existing().is_none());
        let body = br#"{"audio":{"data":"UklGRiQAAABXQVZFZm10IA=="}}"#;
        let file = store(&a, &req, &client, &target, Some("application/json"), body).await.unwrap().unwrap();
        assert_eq!(file.extension().unwrap(), "wav");
        assert!(std::fs::read(&file).unwrap().starts_with(b"RIFF"));
        assert_eq!(target.existing(), Some(file.clone()), "found again without knowing the extension");

        // Text with reuse keeps the body in a .txt next to it.
        let mut t = spec("https://api/text");
        t.reuse = true;
        let req = expand(&t, &vars);
        let target = Target::new(&dir, "", &cache_key(&req));
        let file = store(&t, &req, &client, &target, Some("text/plain"), b"hello there").await.unwrap().unwrap();
        assert_eq!(file.extension().unwrap(), "txt");
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "hello there");

        // Text without reuse writes nothing.
        let mut n = spec("https://api/text");
        n.reuse = false;
        let req = expand(&n, &vars);
        let target = Target::new(&dir, "", &cache_key(&req));
        assert!(store(&n, &req, &client, &target, Some("text/plain"), b"x").await.unwrap().is_none());

        // A chosen name wins, and a bad field is reported rather than written.
        let mut c = spec("https://api/tts");
        c.response = HttpResponse::File;
        c.file_name = "greeting".into();
        let req = expand(&c, &vars);
        let target = Target::new(&dir, &c.file_name, &cache_key(&req));
        let file = store(&c, &req, &client, &target, Some("audio/mpeg"), b"ID3\x04\x00\x00\x00\x00\x00\x00").await.unwrap().unwrap();
        assert_eq!(file, dir.join("greeting.mp3"));
        let mut bad = a.clone();
        bad.response_field = "nope".into();
        let req = expand(&bad, &vars);
        let target = Target::new(&dir, "", &cache_key(&req));
        assert!(store(&bad, &req, &client, &target, Some("application/json"), body).await.is_err());

        let info = cache_info(&dir);
        assert_eq!(info.files, 3);
        assert_eq!(clear_cache(&dir).unwrap(), 3);
        assert_eq!(cache_info(&dir).files, 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn perform_reuses_without_a_server() {
        let dir = temp_dir();
        let vars = HashMap::new();
        let mut a = spec("http://127.0.0.1:9/never");
        a.response = HttpResponse::File;
        a.file_name = "cached.mp3".into();
        a.reuse = true;
        std::fs::write(dir.join("cached.mp3"), b"ID3").unwrap();
        let outcome = perform(&a, &vars, &dir).await.unwrap();
        assert!(outcome.cached && outcome.ok);
        assert_eq!(outcome.file.as_deref(), Some(dir.join("cached.mp3").to_str().unwrap()));
        a.reuse = false;
        assert!(perform(&a, &vars, &dir).await.is_err(), "without reuse the request is made and fails");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
