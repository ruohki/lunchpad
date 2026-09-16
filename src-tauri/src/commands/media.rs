//! Commands for the sound, speech, OBS and Streamlabs editors and their settings.

use super::{err, AppState, CmdResult};
use crate::audio::peaks::{analyze, AudioInfo};
use crate::audio::{AudioDevices, PlayRequest};
use crate::config::{AudioSettings, ObsSettings, Settings, SlobsSettings};
use crate::obs::ObsState;
use crate::slobs::SlobsState;
use crate::http::{self, perform, DownloadCacheInfo, HttpOutcome, HttpSpec};
use crate::macros::{HttpAuth, HttpBodyMode, HttpFilePart, HttpHeader, HttpMethod, HttpResponse};
use crate::speech::{SpeakRequest, VoiceInfo};
use std::collections::HashMap;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};

// ----- audio ----------------------------------------------------------------

#[tauri::command]
pub async fn list_audio_devices(state: State<'_, AppState>) -> CmdResult<AudioDevices> {
    Ok(state.audio.devices().await)
}

/// Output or input devices of the system, for the "switch audio device" action.
#[tauri::command]
pub async fn list_system_audio_devices(target: crate::macros::SystemVolumeTarget) -> CmdResult<Vec<String>> {
    crate::audio_devices::list(target).await
}

#[tauri::command]
pub async fn analyze_audio(path: String, buckets: Option<usize>) -> CmdResult<AudioInfo> {
    let path = PathBuf::from(path);
    tauri::async_runtime::spawn_blocking(move || analyze(&path, buckets.unwrap_or(160))).await.map_err(err)?
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSound {
    pub file: String,
    pub output_device: Option<String>,
    pub volume: f32,
    pub start: f32,
    pub end: f32,
}

/// Play a sound with the editor's current settings. Returns the play id.
#[tauri::command]
pub async fn preview_sound(request: PreviewSound, state: State<'_, AppState>) -> CmdResult<u64> {
    let device = request.output_device.or_else(|| state.settings.lock().settings.audio.output_device.clone());
    let (id, _done) = state.audio.play(PlayRequest {
        file: PathBuf::from(request.file),
        device,
        volume: request.volume,
        start: request.start,
        end: request.end,
    });
    Ok(id)
}

#[tauri::command]
pub async fn stop_sound(id: u64, state: State<'_, AppState>) -> CmdResult<()> {
    state.audio.stop(id);
    Ok(())
}

#[tauri::command]
pub async fn stop_all_sounds(state: State<'_, AppState>) -> CmdResult<()> {
    state.audio.stop_all();
    Ok(())
}

#[tauri::command]
pub async fn set_audio_settings(config: AudioSettings, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let settings = {
        let mut st = state.settings.lock();
        st.settings.audio = config;
        st.save().map_err(err)?;
        st.settings.clone()
    };
    let _ = app.emit(super::settings::EVENT_SETTINGS, &settings);
    Ok(settings)
}

/// Basename of a path, for labels.
#[tauri::command]
pub async fn file_name(path: String) -> CmdResult<String> {
    Ok(Path::new(&path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or(path))
}

// ----- speech ---------------------------------------------------------------

#[tauri::command]
pub async fn list_voices(state: State<'_, AppState>) -> CmdResult<Vec<VoiceInfo>> {
    Ok(state.speech.voices().await)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSpeech {
    pub text: String,
    pub voice: Option<String>,
    pub volume: f32,
}

#[tauri::command]
pub async fn preview_speech(request: PreviewSpeech, state: State<'_, AppState>) -> CmdResult<()> {
    let _ = state.speech.speak(SpeakRequest { text: request.text, voice: request.voice, volume: request.volume });
    Ok(())
}

#[tauri::command]
pub async fn stop_speech(state: State<'_, AppState>) -> CmdResult<()> {
    state.speech.stop();
    Ok(())
}

// ----- OBS ------------------------------------------------------------------

#[tauri::command]
pub async fn obs_state(state: State<'_, AppState>) -> CmdResult<ObsState> {
    Ok(state.obs.state())
}

#[tauri::command]
pub async fn obs_connect(state: State<'_, AppState>) -> CmdResult<ObsState> {
    let obs = state.obs.clone();
    obs.connect().await?;
    Ok(obs.state())
}

#[tauri::command]
pub async fn obs_disconnect(state: State<'_, AppState>) -> CmdResult<ObsState> {
    let obs = state.obs.clone();
    obs.disconnect().await;
    Ok(obs.state())
}

#[tauri::command]
pub async fn obs_refresh(state: State<'_, AppState>) -> CmdResult<ObsState> {
    let obs = state.obs.clone();
    obs.refresh().await?;
    Ok(obs.state())
}

#[tauri::command]
pub async fn obs_filters(source: String, state: State<'_, AppState>) -> CmdResult<Vec<String>> {
    let obs = state.obs.clone();
    obs.filters(&source).await
}

#[tauri::command]
pub async fn set_obs_settings(config: ObsSettings, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let settings = {
        let mut st = state.settings.lock();
        st.settings.obs = config;
        st.save().map_err(err)?;
        st.settings.clone()
    };
    let _ = app.emit(super::settings::EVENT_SETTINGS, &settings);
    Ok(settings)
}

// ----- Streamlabs Desktop ---------------------------------------------------

#[tauri::command]
pub async fn slobs_state(state: State<'_, AppState>) -> CmdResult<SlobsState> {
    Ok(state.slobs.state())
}

#[tauri::command]
pub async fn slobs_connect(state: State<'_, AppState>) -> CmdResult<SlobsState> {
    let slobs = state.slobs.clone();
    slobs.connect().await?;
    Ok(slobs.state())
}

#[tauri::command]
pub async fn slobs_disconnect(state: State<'_, AppState>) -> CmdResult<SlobsState> {
    let slobs = state.slobs.clone();
    slobs.disconnect().await;
    Ok(slobs.state())
}

#[tauri::command]
pub async fn slobs_refresh(state: State<'_, AppState>) -> CmdResult<SlobsState> {
    let slobs = state.slobs.clone();
    slobs.refresh().await?;
    Ok(slobs.state())
}

#[tauri::command]
pub async fn slobs_filters(source: String, state: State<'_, AppState>) -> CmdResult<Vec<String>> {
    let slobs = state.slobs.clone();
    slobs.filters(&source).await
}

#[tauri::command]
pub async fn set_slobs_settings(config: SlobsSettings, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let settings = {
        let mut st = state.settings.lock();
        st.settings.slobs = config;
        st.save().map_err(err)?;
        st.settings.clone()
    };
    let _ = app.emit(super::settings::EVENT_SETTINGS, &settings);
    Ok(settings)
}

// ----- HTTP -----------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpTest {
    pub method: HttpMethod,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<HttpHeader>,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub body_mode: HttpBodyMode,
    #[serde(default)]
    pub body_file: Option<String>,
    #[serde(default)]
    pub files: Vec<HttpFilePart>,
    #[serde(default)]
    pub auth: HttpAuth,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub ignore_tls_errors: bool,
    #[serde(default)]
    pub response: HttpResponse,
    #[serde(default)]
    pub response_field: String,
    #[serde(default)]
    pub file_name: String,
    #[serde(default)]
    pub reuse: bool,
}

#[tauri::command]
pub async fn home_assistant_state(state: State<'_, AppState>) -> CmdResult<crate::homeassistant::HaState> {
    Ok(state.home_assistant.state())
}

#[tauri::command]
pub async fn home_assistant_refresh(state: State<'_, AppState>) -> CmdResult<crate::homeassistant::HaState> {
    let ha = state.home_assistant.clone();
    ha.refresh().await?;
    Ok(ha.state())
}

#[tauri::command]
pub async fn set_home_assistant_settings(config: crate::config::HomeAssistantSettings, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let settings = {
        let mut st = state.settings.lock();
        st.settings.home_assistant = config;
        st.save().map_err(err)?;
        st.settings.clone()
    };
    let _ = app.emit(super::settings::EVENT_SETTINGS, &settings);
    let ha = state.home_assistant.clone();
    tauri::async_runtime::spawn(async move { ha.settings_changed().await });
    Ok(settings)
}

/// Send a request from the editor with sample placeholder values; files are
/// saved and reused exactly as when a macro runs it.
#[tauri::command]
pub async fn test_http_request(request: HttpTest, app: AppHandle, state: State<'_, AppState>) -> CmdResult<HttpOutcome> {
    let spec = HttpSpec {
        method: request.method,
        url: request.url,
        headers: request.headers.into_iter().map(|h| (h.name, h.value)).collect(),
        content_type: request.content_type,
        body: request.body,
        body_mode: request.body_mode,
        body_file: request.body_file,
        files: request.files,
        auth: request.auth,
        timeout_ms: request.timeout_ms.unwrap_or(10_000),
        ignore_tls_errors: request.ignore_tls_errors,
        response: request.response,
        response_field: request.response_field,
        file_name: request.file_name,
        reuse: request.reuse,
    };
    let mut vars: HashMap<&str, String> = crate::macros::builtins::values(&crate::macros::builtins::Press::sample());
    let secrets: Vec<(String, String)> = state.settings.lock().secrets.users().into_iter().map(|(name, value)| (format!("secret.{name}"), value)).collect();
    for (name, value) in &secrets {
        vars.insert(name.as_str(), value.clone());
    }
    perform(&spec, &vars, &http::download_dir(&app)).await
}

/// Files and size of the folder HTTP actions download into.
#[tauri::command]
pub async fn download_cache_info(app: AppHandle) -> CmdResult<DownloadCacheInfo> {
    let dir = http::download_dir(&app);
    tauri::async_runtime::spawn_blocking(move || http::cache_info(&dir)).await.map_err(err)
}

/// Open the download folder in the system's file manager.
#[tauri::command]
pub async fn open_download_folder(app: AppHandle) -> CmdResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let dir = http::download_dir(&app);
    std::fs::create_dir_all(&dir).map_err(err)?;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(err)
}

/// Remove every downloaded file; returns how many went.
#[tauri::command]
pub async fn clear_download_cache(app: AppHandle) -> CmdResult<u64> {
    let dir = http::download_dir(&app);
    tauri::async_runtime::spawn_blocking(move || http::clear_cache(&dir)).await.map_err(err)?
}

// ----- scripts & variables --------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptTest {
    pub code: String,
    #[serde(default)]
    pub locals: HashMap<String, String>,
}

/// Run a snippet from the editor against the current globals with sample trigger values.
#[tauri::command]
pub async fn test_script(request: ScriptTest, state: State<'_, AppState>) -> CmdResult<crate::script::ScriptOutcome> {
    let globals = state.engine.globals();
    tauri::async_runtime::spawn_blocking(move || {
        let builtins = crate::macros::builtins::values(&crate::macros::builtins::Press::sample());
        crate::script::run(crate::script::ScriptInput { code: &request.code, locals: &request.locals, globals: &globals, builtins: &builtins })
    })
    .await
    .map_err(err)?
}

#[tauri::command]
pub async fn get_variables(state: State<'_, AppState>) -> CmdResult<HashMap<String, String>> {
    Ok(state.engine.globals())
}

#[tauri::command]
pub async fn delete_variables(names: Vec<String>, state: State<'_, AppState>) -> CmdResult<HashMap<String, String>> {
    state.engine.remove_globals(&names);
    Ok(state.engine.globals())
}

#[tauri::command]
pub async fn clear_variables(state: State<'_, AppState>) -> CmdResult<HashMap<String, String>> {
    state.engine.clear_globals();
    Ok(state.engine.globals())
}

/// Drop `fader.*` variables no fader publishes any more; returns how many went.
#[tauri::command]
pub async fn prune_fader_variables(state: State<'_, AppState>) -> CmdResult<usize> {
    Ok(state.engine.prune_fader_variables())
}
