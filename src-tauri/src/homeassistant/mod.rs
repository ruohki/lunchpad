//! Home Assistant through its REST API: `GET /api/states` for the entity list
//! the editors offer, `POST /api/services/<domain>/<service>` to act. A
//! long-lived access token authenticates every call. There is no persistent
//! connection; `refresh` is called at start, when the settings change and when
//! the UI asks, and the result is published as `homeassistant:state`.

use crate::config::SharedSettings;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::runtime::Handle;

pub const EVENT_HA_STATE: &str = "homeassistant:state";
const TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HaEntity {
    pub entity_id: String,
    /// `friendly_name`, or the id when there is none
    pub name: String,
    /// The part before the dot: `light`, `switch`, `cover`, …
    pub domain: String,
    pub state: String,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HaState {
    pub connected: bool,
    pub error: Option<String>,
    pub version: Option<String>,
    pub location: Option<String>,
    pub entities: Vec<HaEntity>,
}

/// Numeric things an entity can be set to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum HaValueKind {
    /// Light brightness, 0–100 %
    #[default]
    Brightness,
    /// Light colour temperature in Kelvin
    ColorTemperature,
    /// Cover position, 0 (closed) – 100 (open)
    Position,
    /// Fan speed, 0–100 %
    FanSpeed,
    /// Media player volume, 0–100 %
    Volume,
    /// `number` / `input_number` value, in the entity's own unit
    Number,
    /// Climate target temperature
    Temperature,
}

/// On / off / toggle through the `homeassistant` domain, which works for every entity kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum HaPower {
    #[default]
    On,
    Off,
    Toggle,
}

impl HaPower {
    pub fn service(self) -> &'static str {
        match self {
            HaPower::On => "turn_on",
            HaPower::Off => "turn_off",
            HaPower::Toggle => "toggle",
        }
    }
}

/// The service call that sets `kind` of `entity` to `value`: `(domain, service, data)`.
pub fn value_service(kind: HaValueKind, entity: &str, value: f32) -> (String, &'static str, Value) {
    let pct = || json!(value.clamp(0.0, 100.0).round() as u32);
    match kind {
        HaValueKind::Brightness => ("light".into(), "turn_on", json!({ "brightness_pct": pct() })),
        HaValueKind::ColorTemperature => ("light".into(), "turn_on", json!({ "color_temp_kelvin": value.max(0.0).round() as u32 })),
        HaValueKind::Position => ("cover".into(), "set_cover_position", json!({ "position": pct() })),
        HaValueKind::FanSpeed => ("fan".into(), "set_percentage", json!({ "percentage": pct() })),
        HaValueKind::Volume => ("media_player".into(), "volume_set", json!({ "volume_level": (value.clamp(0.0, 100.0) / 100.0) })),
        HaValueKind::Number => {
            let domain = entity.split('.').next().filter(|d| !d.is_empty()).unwrap_or("input_number").to_string();
            (domain, "set_value", json!({ "value": value }))
        }
        HaValueKind::Temperature => ("climate".into(), "set_temperature", json!({ "temperature": value })),
    }
}

struct Connection {
    url: String,
    token: String,
    client: reqwest::Client,
}

struct Inner {
    settings: SharedSettings,
    app: Option<AppHandle>,
    state: Mutex<HaState>,
    connection: Mutex<Option<Arc<Connection>>>,
}

#[derive(Clone)]
pub struct HaHandle {
    inner: Arc<Inner>,
}

impl HaHandle {
    /// Create the handle; when the integration is on, the entity list is fetched in the background.
    pub fn spawn(app: Option<AppHandle>, settings: SharedSettings, runtime: &Handle) -> HaHandle {
        let handle = HaHandle { inner: Arc::new(Inner { settings, app, state: Mutex::new(HaState::default()), connection: Mutex::new(None) }) };
        let starter = handle.clone();
        runtime.spawn(async move { starter.settings_changed().await });
        handle
    }

    pub fn state(&self) -> HaState {
        self.inner.state.lock().clone()
    }

    fn publish(&self) {
        if let Some(app) = &self.inner.app {
            let _ = app.emit(EVENT_HA_STATE, self.state());
        }
    }

    fn set_state(&self, f: impl FnOnce(&mut HaState)) {
        f(&mut self.inner.state.lock());
        self.publish();
    }

    /// Re-read the settings: fetch the catalog when enabled, forget it otherwise.
    pub async fn settings_changed(&self) {
        *self.inner.connection.lock() = None;
        let enabled = self.inner.settings.lock().settings.home_assistant.enabled;
        if enabled {
            let _ = self.refresh().await;
        } else {
            self.set_state(|s| *s = HaState::default());
        }
    }

    fn connection(&self) -> Result<Arc<Connection>, String> {
        if let Some(c) = self.inner.connection.lock().clone() {
            return Ok(c);
        }
        let cfg = self.inner.settings.lock().settings.home_assistant.clone();
        if !cfg.enabled {
            return Err("Home Assistant is not enabled in the settings".into());
        }
        let url = cfg.url.trim().trim_end_matches('/').to_string();
        if url.is_empty() {
            return Err("no Home Assistant URL".into());
        }
        if cfg.token.trim().is_empty() {
            return Err("no access token".into());
        }
        let client = reqwest::Client::builder()
            .timeout(TIMEOUT)
            .danger_accept_invalid_certs(cfg.ignore_tls_errors)
            .build()
            .map_err(|e| e.to_string())?;
        let conn = Arc::new(Connection { url, token: cfg.token.trim().to_string(), client });
        *self.inner.connection.lock() = Some(conn.clone());
        Ok(conn)
    }

    async fn get(&self, conn: &Connection, path: &str) -> Result<Value, String> {
        let response = conn
            .client
            .get(format!("{}{}", conn.url, path))
            .bearer_auth(&conn.token)
            .send()
            .await
            .map_err(|e| describe(e))?;
        let status = response.status();
        if !status.is_success() {
            return Err(http_error(status, &response.text().await.unwrap_or_default()));
        }
        response.json::<Value>().await.map_err(|e| e.to_string())
    }

    /// Fetch the instance facts and every entity; the state event carries the result.
    pub async fn refresh(&self) -> Result<(), String> {
        let result = async {
            let conn = self.connection()?;
            let config = self.get(&conn, "/api/config").await?;
            let states = self.get(&conn, "/api/states").await?;
            let mut entities: Vec<HaEntity> = states
                .as_array()
                .map(|list| list.iter().filter_map(entity_from_state).collect())
                .unwrap_or_default();
            entities.sort_by(|a, b| a.entity_id.cmp(&b.entity_id));
            Ok::<_, String>((
                config.get("version").and_then(Value::as_str).map(str::to_string),
                config.get("location_name").and_then(Value::as_str).map(str::to_string),
                entities,
            ))
        }
        .await;
        match result {
            Ok((version, location, entities)) => {
                tracing::info!(count = entities.len(), version = version.as_deref().unwrap_or("?"), "Home Assistant entities loaded");
                self.set_state(|s| {
                    s.connected = true;
                    s.error = None;
                    s.version = version;
                    s.location = location;
                    s.entities = entities;
                });
                Ok(())
            }
            Err(e) => {
                tracing::warn!(error = %e, "Home Assistant unreachable");
                self.set_state(|s| {
                    s.connected = false;
                    s.error = Some(e.clone());
                });
                Err(e)
            }
        }
    }

    /// `POST /api/services/<domain>/<service>` with `entity_id` merged into `data`.
    pub async fn call_service(&self, domain: &str, service: &str, entity: Option<&str>, data: Value) -> Result<(), String> {
        let conn = self.connection()?;
        let mut body = match data {
            Value::Object(map) => map,
            Value::Null => serde_json::Map::new(),
            other => return Err(format!("service data must be a JSON object, got {other}")),
        };
        if let Some(id) = entity.map(str::trim).filter(|s| !s.is_empty()) {
            body.insert("entity_id".into(), Value::String(id.to_string()));
        }
        let domain = domain.trim();
        let service = service.trim();
        if domain.is_empty() || service.is_empty() {
            return Err("service needs a domain and a name".into());
        }
        let response = conn
            .client
            .post(format!("{}/api/services/{}/{}", conn.url, domain, service))
            .bearer_auth(&conn.token)
            .json(&Value::Object(body))
            .send()
            .await
            .map_err(|e| describe(e))?;
        let status = response.status();
        if !status.is_success() {
            let text = response.text().await.unwrap_or_default();
            let err = http_error(status, &text);
            self.set_state(|s| s.error = Some(err.clone()));
            return Err(err);
        }
        if !self.inner.state.lock().connected {
            self.set_state(|s| {
                s.connected = true;
                s.error = None;
            });
        }
        Ok(())
    }
}

fn entity_from_state(v: &Value) -> Option<HaEntity> {
    let entity_id = v.get("entity_id")?.as_str()?.to_string();
    let domain = entity_id.split('.').next().unwrap_or("").to_string();
    let name = v
        .get("attributes")
        .and_then(|a| a.get("friendly_name"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| entity_id.clone());
    let state = v.get("state").and_then(Value::as_str).unwrap_or("").to_string();
    Some(HaEntity { entity_id, name, domain, state })
}

fn describe(e: reqwest::Error) -> String {
    if e.is_timeout() {
        "timed out".into()
    } else if e.is_connect() {
        format!("could not connect: {}", e.without_url())
    } else {
        e.without_url().to_string()
    }
}

fn http_error(status: reqwest::StatusCode, body: &str) -> String {
    let detail = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| v.get("message").and_then(Value::as_str).map(str::to_string))
        .unwrap_or_else(|| body.chars().take(160).collect());
    match status.as_u16() {
        401 => "the access token was rejected".into(),
        404 => format!("not found: {detail}"),
        _ => format!("HTTP {}: {detail}", status.as_u16()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn value_services() {
        let (d, s, data) = value_service(HaValueKind::Brightness, "light.desk", 42.4);
        assert_eq!((d.as_str(), s), ("light", "turn_on"));
        assert_eq!(data["brightness_pct"], 42);
        let (d, s, data) = value_service(HaValueKind::Volume, "media_player.tv", 55.0);
        assert_eq!((d.as_str(), s), ("media_player", "volume_set"));
        assert!((data["volume_level"].as_f64().unwrap() - 0.55).abs() < 1e-6);
        let (d, _, data) = value_service(HaValueKind::Number, "input_number.gain", -3.5);
        assert_eq!(d, "input_number");
        assert_eq!(data["value"], -3.5);
        let (d, s, _) = value_service(HaValueKind::Number, "number.volume", 7.0);
        assert_eq!((d.as_str(), s), ("number", "set_value"));
        let (_, _, data) = value_service(HaValueKind::Position, "cover.blind", 140.0);
        assert_eq!(data["position"], 100);
        assert_eq!(HaPower::Toggle.service(), "toggle");
    }

    #[test]
    fn entities_from_states() {
        let v = json!({ "entity_id": "light.desk", "state": "on", "attributes": { "friendly_name": "Desk lamp" } });
        let e = entity_from_state(&v).unwrap();
        assert_eq!((e.domain.as_str(), e.name.as_str(), e.state.as_str()), ("light", "Desk lamp", "on"));
        let bare = entity_from_state(&json!({ "entity_id": "switch.plug", "state": "off", "attributes": {} })).unwrap();
        assert_eq!(bare.name, "switch.plug");
    }
}
