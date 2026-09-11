//! Execution of actions that talk to the outside world: sound, speech,
//! keyboard, processes, OBS and Streamlabs. Pure engine actions live in `engine.rs`.

use super::engine::RunContext;
use super::model::*;
use crate::audio::PlayRequest;
use crate::http::{self, HttpSpec};
use crate::script::{self, ScriptInput};
use crate::speech::SpeakRequest;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

const MAX_KEYSTROKE_DELAY: u64 = 5000;

pub async fn execute_external(ctx: &RunContext, action: &Action) {
    let services = ctx.services();
    match &action.kind {
        ActionKind::PlaySound { file, volume, start, end, output_device, volume_from_velocity } => {
            let Some(audio) = &services.audio else { return unavailable(action) };
            let device = output_device
                .clone()
                .or_else(|| services.settings.as_ref().and_then(|s| s.lock().settings.audio.output_device.clone()));
            let volume = if *volume_from_velocity { volume * (ctx.velocity as f32 / 127.0) } else { *volume };
            let (id, done) = audio.play(PlayRequest { file: PathBuf::from(file), device, volume, start: *start, end: *end });
            tokio::select! {
                result = done => {
                    if let Ok(Err(e)) = result {
                        tracing::warn!(action = %action.id, error = %e, "sound failed");
                    }
                }
                _ = ctx.token.cancelled() => audio.stop(id),
            }
        }

        ActionKind::TextToSpeech { text, voice, volume } => {
            let Some(speech) = &services.speech else { return unavailable(action) };
            let done = speech.speak(SpeakRequest { text: ctx.expand(text), voice: voice.clone(), volume: *volume });
            tokio::select! {
                result = done => {
                    if let Ok(Err(e)) = result {
                        tracing::warn!(action = %action.id, error = %e, "speech failed");
                    }
                }
                _ = ctx.token.cancelled() => speech.stop(),
            }
        }

        ActionKind::LaunchApplication { executable, arguments, hidden, kill_on_stop, save_output_to, save_scope } => {
            let output = launch(ctx, &ctx.expand(executable), &ctx.expand(arguments), *hidden, *kill_on_stop, save_output_to.is_some()).await;
            if let (Some(name), Some(text)) = (save_output_to, output) {
                ctx.set_var(name, text, *save_scope);
            }
        }

        ActionKind::Hotkey { keystrokes, restore_all_at_end } => {
            let Some(keyboard) = &services.keyboard else { return unavailable(action) };
            let mut held: Vec<(String, Vec<String>)> = Vec::new();
            for stroke in keystrokes {
                if ctx.token.is_cancelled() {
                    break;
                }
                match stroke {
                    Keystroke::Key { event, key, modifiers } => match event {
                        KeyEvent::Down => {
                            keyboard.hold(key, modifiers);
                            held.push((key.clone(), modifiers.clone()));
                        }
                        KeyEvent::Up => {
                            keyboard.release(key, modifiers);
                            held.retain(|(k, _)| k != key);
                        }
                        KeyEvent::Tap => keyboard.tap(key, modifiers),
                    },
                    Keystroke::Delay { ms } => sleep_cancellable(ctx, (*ms).min(MAX_KEYSTROKE_DELAY)).await,
                    Keystroke::Text { text, delay_ms } => {
                        let text = ctx.expand(text);
                        if *delay_ms > 0 {
                            for ch in text.chars() {
                                if ctx.token.is_cancelled() {
                                    break;
                                }
                                keyboard.text(&ch.to_string());
                                sleep_cancellable(ctx, (*delay_ms).min(MAX_KEYSTROKE_DELAY)).await;
                            }
                        } else {
                            keyboard.text(&text);
                        }
                    }
                }
            }
            if *restore_all_at_end {
                for (key, modifiers) in held.iter().rev() {
                    keyboard.release(key, modifiers);
                }
            }
        }

        // Scene, source and filter names take placeholders too, e.g. "{{nextScene}}".
        ActionKind::ObsSwitchScene { scene, collection } => {
            let Some(obs) = &services.obs else { return unavailable(action) };
            let (scene, collection) = (ctx.expand(scene), ctx.expand(collection));
            report(action, "OBS", obs.switch_scene(opt(&collection), &scene).await);
        }
        ActionKind::ObsToggleSource { scene, collection, source, visible, mode } => {
            let Some(obs) = &services.obs else { return unavailable(action) };
            let (scene, collection, source) = (ctx.expand(scene), ctx.expand(collection), ctx.expand(source));
            report(action, "OBS", obs.set_source_visible(opt(&collection), &scene, &source, visibility(*mode, *visible)).await);
        }
        ActionKind::ObsSetAudio { source, muted, mute_mode, volume_db, volume_from, volume_unit, set_volume, .. } => {
            let Some(obs) = &services.obs else { return unavailable(action) };
            let volume = set_volume.then(|| (number_from(ctx, volume_from, *volume_db), *volume_unit));
            report(action, "OBS", obs.set_audio(&ctx.expand(source), mute(*mute_mode, *muted), volume).await);
        }
        ActionKind::ObsToggleFilter { source, filter, enabled } => {
            let Some(obs) = &services.obs else { return unavailable(action) };
            report(action, "OBS", obs.set_filter(&ctx.expand(source), &ctx.expand(filter), *enabled).await);
        }
        ActionKind::ObsStream { target, mode } => {
            let Some(obs) = &services.obs else { return unavailable(action) };
            report(action, "OBS", obs.output(*target, *mode).await);
        }
        ActionKind::ObsSaveReplay => {
            let Some(obs) = &services.obs else { return unavailable(action) };
            report(action, "OBS", obs.save_replay().await);
        }
        ActionKind::ObsStudioMode { mode } => {
            let Some(obs) = &services.obs else { return unavailable(action) };
            report(action, "OBS", obs.studio_mode(*mode).await);
        }

        ActionKind::SlobsSwitchScene { scene, collection } => {
            let Some(slobs) = &services.slobs else { return unavailable(action) };
            let (scene, collection) = (ctx.expand(scene), ctx.expand(collection));
            report(action, "Streamlabs", slobs.switch_scene(opt(&collection), &scene).await);
        }
        ActionKind::SlobsToggleSource { scene, collection, source, visible, mode } => {
            let Some(slobs) = &services.slobs else { return unavailable(action) };
            let (scene, collection, source) = (ctx.expand(scene), ctx.expand(collection), ctx.expand(source));
            report(action, "Streamlabs", slobs.set_source_visible(opt(&collection), &scene, &source, visibility(*mode, *visible)).await);
        }
        ActionKind::SlobsSetAudio { source, muted, mute_mode, volume_db, volume_from, volume_unit, set_volume, .. } => {
            let Some(slobs) = &services.slobs else { return unavailable(action) };
            let volume = set_volume.then(|| (number_from(ctx, volume_from, *volume_db), *volume_unit));
            report(action, "Streamlabs", slobs.set_audio(&ctx.expand(source), mute(*mute_mode, *muted), volume).await);
        }
        ActionKind::StopAllSounds => {
            let Some(audio) = &services.audio else { return unavailable(action) };
            audio.stop_all();
        }
        ActionKind::SetAudioDevice { target, device } => {
            report(action, "Audio device", crate::audio_devices::set_default(*target, &ctx.expand(device)).await);
        }
        ActionKind::AddToVariable { name, amount, scope } => {
            let current = ctx.variables().get(name.as_str()).and_then(|v| v.trim().parse::<f64>().ok()).unwrap_or(0.0);
            let delta = ctx.expand(amount).trim().parse::<f64>().unwrap_or(0.0);
            ctx.set_var(name, number_text(current + delta), *scope);
        }
        ActionKind::SetSystemVolume { target, mode, volume, volume_from } => {
            let amount = number_from(ctx, volume_from, *volume);
            report(action, "System volume", crate::system_volume::apply(*target, *mode, amount).await);
        }
        ActionKind::SlobsToggleFilter { source, filter, enabled } => {
            let Some(slobs) = &services.slobs else { return unavailable(action) };
            report(action, "Streamlabs", slobs.set_filter(&ctx.expand(source), &ctx.expand(filter), *enabled).await);
        }
        ActionKind::SlobsStream { target, mode } => {
            let Some(slobs) = &services.slobs else { return unavailable(action) };
            report(action, "Streamlabs", slobs.output(*target, *mode).await);
        }
        ActionKind::SlobsSaveReplay => {
            let Some(slobs) = &services.slobs else { return unavailable(action) };
            report(action, "Streamlabs", slobs.save_replay().await);
        }
        ActionKind::SlobsStudioMode { mode } => {
            let Some(slobs) = &services.slobs else { return unavailable(action) };
            report(action, "Streamlabs", slobs.studio_mode(*mode).await);
        }
        ActionKind::HomeAssistantTurn { entity, mode } => {
            let Some(ha) = &services.home_assistant else { return unavailable(action) };
            let entity = ctx.expand(entity);
            report(action, "Home Assistant", ha.call_service("homeassistant", mode.service(), Some(&entity), serde_json::json!({})).await);
        }
        ActionKind::HomeAssistantSetValue { entity, kind, value, value_from } => {
            let Some(ha) = &services.home_assistant else { return unavailable(action) };
            let amount = number_from(ctx, value_from, *value);
            let entity = ctx.expand(entity);
            let (domain, service, data) = crate::homeassistant::value_service(*kind, &entity, amount);
            report(action, "Home Assistant", ha.call_service(&domain, service, Some(&entity), data).await);
        }
        ActionKind::HomeAssistantCallService { domain, service, entity, data } => {
            let Some(ha) = &services.home_assistant else { return unavailable(action) };
            let text = ctx.expand(data);
            let payload = if text.trim().is_empty() {
                serde_json::json!({})
            } else {
                match serde_json::from_str::<serde_json::Value>(&text) {
                    Ok(v) => v,
                    Err(e) => return report(action, "Home Assistant", Err(format!("service data is not valid JSON: {e}"))),
                }
            };
            let entity = ctx.expand(entity);
            report(action, "Home Assistant", ha.call_service(&ctx.expand(domain), &ctx.expand(service), opt(&entity), payload).await);
        }

        ActionKind::HttpRequest { method, url, headers, content_type, body, body_mode, body_file, files, auth, timeout_ms, ignore_tls_errors, save_to, save_scope } => {
            let spec = HttpSpec {
                method: *method,
                url: url.clone(),
                headers: headers.iter().map(|h| (h.name.clone(), h.value.clone())).collect(),
                content_type: content_type.clone(),
                body: body.clone(),
                body_mode: *body_mode,
                body_file: body_file.clone(),
                files: files.clone(),
                auth: auth.clone(),
                timeout_ms: *timeout_ms,
                ignore_tls_errors: *ignore_tls_errors,
            };
            let owned = ctx.variables();
            let vars: HashMap<&str, String> = owned.iter().map(|(k, v)| (k.as_str(), v.clone())).collect();
            tokio::select! {
                result = http::perform(&spec, &vars) => match result {
                    Ok(o) => {
                        if o.ok {
                            tracing::info!(action = %action.id, status = o.status, ms = o.elapsed_ms, "http request done");
                        } else {
                            tracing::warn!(action = %action.id, status = o.status, body = %o.body_preview.chars().take(200).collect::<String>(), "http request answered with an error status");
                        }
                        if let Some(name) = save_to {
                            ctx.set_var(name, o.body_preview.clone(), *save_scope);
                            ctx.set_var(&format!("{name}.status"), o.status.to_string(), *save_scope);
                        }
                    }
                    Err(e) => {
                        tracing::warn!(action = %action.id, error = %e, "http request failed");
                        if let Some(name) = save_to {
                            ctx.set_var(name, String::new(), *save_scope);
                            ctx.set_var(&format!("{name}.status"), "0".into(), *save_scope);
                        }
                    }
                },
                _ = ctx.token.cancelled() => {}
            }
        }

        ActionKind::SetVariable { name, value, scope } => {
            ctx.set_var(name, ctx.expand(value), *scope);
        }

        ActionKind::RunScript { code, save_to, save_scope } => {
            let input_locals = ctx.locals.lock().clone();
            let input_globals = ctx.globals_snapshot();
            let mut builtins: HashMap<&'static str, String> = HashMap::new();
            builtins.insert("velocity", ctx.velocity.to_string());
            builtins.insert("velocity01", format!("{:.3}", ctx.velocity as f32 / 127.0));
            let pressure = ctx.variables().get("pressure").cloned().unwrap_or_else(|| "0".into());
            builtins.insert("pressure01", format!("{:.3}", pressure.parse::<f32>().unwrap_or(0.0) / 127.0));
            builtins.insert("pressure", pressure);
            builtins.insert("x", ctx.x.to_string());
            builtins.insert("y", ctx.y.to_string());
            builtins.insert("pageId", ctx.page_id.clone());
            let code = code.clone();
            let job = tokio::task::spawn_blocking(move || script::run(ScriptInput { code: &code, locals: &input_locals, globals: &input_globals, builtins: &builtins }));
            match job.await {
                Ok(Ok(out)) => {
                    tracing::debug!(action = %action.id, ms = out.elapsed_ms, result = %out.result.chars().take(120).collect::<String>(), "script done");
                    {
                        let mut locals = ctx.locals.lock();
                        for (k, v) in out.locals {
                            locals.insert(k, v);
                        }
                    }
                    ctx.merge_globals(out.globals);
                    if let Some(name) = save_to {
                        ctx.set_var(name, out.result, *save_scope);
                    }
                }
                Ok(Err(e)) => tracing::warn!(action = %action.id, error = %e, "script failed"),
                Err(e) => tracing::warn!(action = %action.id, error = %e, "script task failed"),
            }
        }

        _ => {}
    }
}

/// `Some(true/false)` to show or hide, `None` to flip the current state.
fn visibility(mode: Option<VisibilityMode>, visible: bool) -> Option<bool> {
    match mode {
        Some(VisibilityMode::Show) => Some(true),
        Some(VisibilityMode::Hide) => Some(false),
        Some(VisibilityMode::Toggle) => None,
        None => Some(visible),
    }
}

fn mute(mode: Option<MuteMode>, muted: bool) -> MuteMode {
    mode.unwrap_or(if muted { MuteMode::Mute } else { MuteMode::Unmute })
}

/// Whole numbers without a trailing ".0", others with up to three decimals.
fn number_text(value: f64) -> String {
    if value.fract() == 0.0 && value.abs() < 1e15 {
        format!("{}", value as i64)
    } else {
        let s = format!("{value:.3}");
        s.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

/// A number typed in the editor, unless a variable / placeholder holds one
/// (faders write `value`, `percent`, …).
fn number_from(ctx: &RunContext, from: &Option<String>, fallback: f32) -> f32 {
    let Some(raw) = from.as_deref().map(str::trim).filter(|s| !s.is_empty()) else { return fallback };
    let template = if raw.contains("{{") { raw.to_string() } else { format!("{{{{{raw}}}}}") };
    let expanded = ctx.expand(&template);
    match expanded.trim().parse::<f32>() {
        Ok(n) => n,
        Err(_) => {
            tracing::warn!(reference = raw, expanded = %expanded, fallback, "value reference is not a number, using the fixed value");
            fallback
        }
    }
}

fn opt(s: &str) -> Option<&str> {
    if s.trim().is_empty() {
        None
    } else {
        Some(s)
    }
}

fn unavailable(action: &Action) {
    tracing::warn!(action = %action.id, "service for this action is not available");
}

fn report(action: &Action, service: &str, result: Result<(), String>) {
    if let Err(e) = result {
        tracing::warn!(action = %action.id, service, error = %e, "integration action failed");
    }
}

async fn sleep_cancellable(ctx: &RunContext, ms: u64) {
    tokio::select! {
        _ = tokio::time::sleep(Duration::from_millis(ms)) => {}
        _ = ctx.token.cancelled() => {}
    }
}

async fn launch(ctx: &RunContext, executable: &str, arguments: &str, hidden: bool, kill_on_stop: bool, capture: bool) -> Option<String> {
    if executable.trim().is_empty() {
        tracing::warn!("launch application: no executable set");
        return None;
    }
    let args = shlex::split(arguments).unwrap_or_else(|| arguments.split_whitespace().map(str::to_string).collect());
    let mut cmd = tokio::process::Command::new(executable);
    cmd.args(&args).stdin(std::process::Stdio::null()).kill_on_drop(kill_on_stop);
    if capture {
        cmd.stdout(std::process::Stdio::piped());
    }
    #[cfg(unix)]
    {
        // Own process group so "kill on stop" can take child processes along.
        cmd.process_group(0);
    }
    #[cfg(windows)]
    {
        if hidden {
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
    }
    #[cfg(not(windows))]
    let _ = hidden;

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(executable, error = %e, "could not start application");
            return None;
        }
    };
    let pid = child.id();
    tracing::info!(executable, ?args, pid, "application started");

    if capture {
        tokio::select! {
            output = child.wait_with_output() => match output {
                Ok(o) => {
                    tracing::info!(executable, status = ?o.status, "application exited");
                    return Some(String::from_utf8_lossy(&o.stdout).trim_end().to_string());
                }
                Err(e) => {
                    tracing::warn!(executable, error = %e, "application failed");
                    return None;
                }
            },
            _ = ctx.token.cancelled() => {
                return None;
            }
        }
    }

    tokio::select! {
        status = child.wait() => {
            tracing::info!(executable, ?status, "application exited");
        }
        _ = ctx.token.cancelled() => {
            if kill_on_stop {
                #[cfg(unix)]
                if let Some(pid) = pid {
                    let _ = std::process::Command::new("kill").args(["-TERM", &format!("-{pid}")]).status();
                }
                let _ = child.kill().await;
                tracing::info!(executable, "application stopped with the macro");
            } else {
                // Let it run on; reap it in the background.
                tokio::spawn(async move {
                    let _ = child.wait().await;
                });
            }
        }
    }
    None
}
