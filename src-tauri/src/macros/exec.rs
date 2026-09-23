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
            let (id, done) = audio.play(PlayRequest { file: PathBuf::from(ctx.expand(file)), device, volume, start: *start, end: *end });
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

        ActionKind::GetWindow { target, title, matching, app, save_to, save_scope } => match find_window(ctx, *target, title, *matching, app).await {
            Ok(window) => remember_window(ctx, save_to, window.as_ref(), *save_scope),
            Err(e) => tracing::warn!(action = %action.id, error = %e, "window lookup failed"),
        },

        ActionKind::SetWindow { target, title, matching, app, op, x, y, width, height, screen } => {
            let window = match find_window(ctx, *target, title, *matching, app).await {
                Ok(Some(window)) => window,
                Ok(None) => {
                    tracing::warn!(action = %action.id, "no window matches");
                    return;
                }
                Err(e) => {
                    tracing::warn!(action = %action.id, error = %e, "window lookup failed");
                    return;
                }
            };
            let number = |text: &str| -> Option<i32> { ctx.expand(text).trim().parse::<f64>().ok().map(|v| v.round() as i32) };
            let screen = number(screen).filter(|n| *n > 0).map(|n| n as u32);
            use crate::desktop::Change;
            let change = match op {
                WindowOp::Focus => Change::Focus,
                WindowOp::Minimize => Change::Minimize,
                WindowOp::Maximize => Change::Maximize,
                WindowOp::Restore => Change::Restore,
                WindowOp::SendToBack => Change::SendToBack,
                WindowOp::Close => Change::Close,
                WindowOp::Move => Change::Move { x: number(x), y: number(y), screen },
                WindowOp::Resize => Change::Resize { width: number(width), height: number(height) },
                WindowOp::Bounds => Change::Bounds { x: number(x), y: number(y), width: number(width), height: number(height), screen },
                WindowOp::Center => Change::Center { screen },
                WindowOp::Screen => match screen {
                    Some(n) => Change::Move { x: None, y: None, screen: Some(n) },
                    None => {
                        tracing::warn!(action = %action.id, "no screen number to move to");
                        return;
                    }
                },
            };
            let target = window.clone();
            let done = tokio::task::spawn_blocking(move || {
                let screens = crate::desktop::screens().unwrap_or_default();
                let op = crate::desktop::resolve(&target, change, &screens)?;
                crate::desktop::perform(&target, op)
            })
            .await
            .map_err(|e| e.to_string())
            .and_then(|r| r);
            if let Err(e) = done {
                tracing::warn!(action = %action.id, window = %window.title, error = %e, "window change failed");
            }
        }

        ActionKind::Mouse { steps } => {
            let Some(keyboard) = &services.keyboard else { return unavailable(action) };
            let number = |text: &str| -> Option<i32> { ctx.expand(text).trim().parse::<f64>().ok().map(|v| v.round() as i32) };
            for step in steps {
                if ctx.token.is_cancelled() {
                    break;
                }
                match step {
                    MouseStep::Move { x, y, relative } => match (number(x), number(y)) {
                        (Some(x), Some(y)) => keyboard.mouse_move(x, y, *relative),
                        _ => tracing::warn!(action = %action.id, "mouse target is not a pair of numbers"),
                    },
                    MouseStep::Click { button, clicks } => {
                        for i in 0..(*clicks).clamp(1, 5) {
                            if i > 0 {
                                sleep_cancellable(ctx, 60).await;
                            }
                            keyboard.mouse_button(*button, enigo::Direction::Click);
                        }
                    }
                    MouseStep::Press { button } => keyboard.mouse_button(*button, enigo::Direction::Press),
                    MouseStep::Release { button } => keyboard.mouse_button(*button, enigo::Direction::Release),
                    MouseStep::Scroll { amount, axis } => match number(amount) {
                        Some(n) => keyboard.mouse_scroll(n, *axis == ScrollAxis::Horizontal),
                        None => tracing::warn!(action = %action.id, "scroll amount is not a number"),
                    },
                    MouseStep::Drag { x, y, button } => {
                        let (Some(x), Some(y)) = (number(x), number(y)) else {
                            tracing::warn!(action = %action.id, "drag target is not a pair of numbers");
                            continue;
                        };
                        keyboard.mouse_button(*button, enigo::Direction::Press);
                        sleep_cancellable(ctx, 80).await;
                        keyboard.mouse_move(x, y, false);
                        sleep_cancellable(ctx, 80).await;
                        keyboard.mouse_button(*button, enigo::Direction::Release);
                    }
                    MouseStep::Delay { ms } => sleep_cancellable(ctx, (*ms).min(MAX_KEYSTROKE_DELAY)).await,
                }
            }
        }

        ActionKind::GetScreen { pick, number, save_to, save_scope } => {
            let wanted = ctx.expand(number).trim().parse::<f64>().ok().map(|v| v.round() as u32);
            let pointer = match (pick, &services.keyboard) {
                (ScreenPick::Pointer, Some(keyboard)) => {
                    let keyboard = keyboard.clone();
                    tokio::task::spawn_blocking(move || keyboard.mouse_location()).await.ok().flatten()
                }
                _ => None,
            };
            let pick = *pick;
            let found = tokio::task::spawn_blocking(move || -> Result<(Vec<crate::desktop::ScreenInfo>, Option<usize>), String> {
                let screens = crate::desktop::screens()?;
                let index = match pick {
                    ScreenPick::Primary => screens.iter().position(|s| s.primary).or(if screens.is_empty() { None } else { Some(0) }),
                    ScreenPick::Number => wanted.and_then(|n| screens.iter().position(|s| s.number == n)),
                    ScreenPick::Foreground => crate::desktop::foreground()?.and_then(|w| crate::desktop::screen_of(&screens, w.x, w.y, w.width, w.height).map(|s| s.number)).and_then(|n| screens.iter().position(|s| s.number == n)),
                    ScreenPick::Pointer => pointer.and_then(|(x, y)| crate::desktop::screen_of(&screens, x, y, 1, 1).map(|s| s.number)).and_then(|n| screens.iter().position(|s| s.number == n)),
                };
                Ok((screens, index))
            })
            .await
            .map_err(|e| e.to_string())
            .and_then(|r| r);
            match found {
                Ok((screens, index)) => {
                    if index.is_none() {
                        tracing::warn!(action = %action.id, "no such screen");
                    }
                    remember_screen(ctx, save_to, index.map(|i| &screens[i]), screens.len(), *save_scope);
                }
                Err(e) => tracing::warn!(action = %action.id, error = %e, "screen lookup failed"),
            }
        }

        ActionKind::Debug { title, text, always_on_top } => {
            let Some(app) = &services.app else { return unavailable(action) };
            let title = ctx.expand(title);
            // The pad the macro runs for, so several debug windows can be told apart.
            let title = format!("{} · column {}, row {}", if title.trim().is_empty() { "Debug" } else { title.trim() }, ctx.x + 1, ctx.y + 1);
            if let Err(e) = crate::debug::show(app, &action.id, title, ctx.expand(text), *always_on_top) {
                tracing::warn!(action = %action.id, error = %e, "debug window failed");
            }
        }

        ActionKind::MousePosition {
            save_to,
            save_scope,
        } => {
            let Some(keyboard) = &services.keyboard else {
                return unavailable(action);
            };
            let keyboard = keyboard.clone();
            let at = tokio::task::spawn_blocking(move || keyboard.mouse_location())
                .await
                .ok()
                .flatten();
            match at {
                Some((x, y)) => {
                    ctx.set_var(save_to, format!("{x},{y}"), *save_scope);
                    ctx.set_var(&format!("{save_to}.x"), x.to_string(), *save_scope);
                    ctx.set_var(&format!("{save_to}.y"), y.to_string(), *save_scope);
                }
                None => {
                    tracing::warn!(action = %action.id, "the pointer position could not be read")
                }
            }
        }

        ActionKind::LaunchApplication { executable, arguments, hidden, kill_on_stop, save_output_to, save_scope } => {
            let output = launch(ctx, &ctx.expand(executable), &ctx.expand(arguments), *hidden, *kill_on_stop, save_output_to.is_some(), action.wait).await;
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
        ActionKind::ObsTriggerHotkey { by, name, context, key, shift, control, alt, command } => {
            let Some(obs) = &services.obs else { return unavailable(action) };
            let result = match by {
                ObsHotkeyBy::Name => {
                    let (name, context) = (ctx.expand(name), ctx.expand(context));
                    obs.trigger_hotkey(name.trim(), opt(&context)).await
                }
                ObsHotkeyBy::Keys => obs.trigger_key_sequence(&obs_key_id(&ctx.expand(key)), *shift, *control, *alt, *command).await,
            };
            report(action, "OBS", result);
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
        ActionKind::SetSystemVolume { target, mode, volume, volume_from, device } => {
            let amount = number_from(ctx, volume_from, *volume);
            let device = device.as_deref().map(|d| ctx.expand(d));
            report(action, "System volume", crate::system_volume::apply(*target, *mode, amount, device.as_deref()).await);
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

        ActionKind::HttpRequest { method, url, headers, content_type, body, body_mode, body_file, files, auth, timeout_ms, ignore_tls_errors, save_to, save_scope, response, response_field, file_name, reuse } => {
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
                response: *response,
                response_field: response_field.clone(),
                file_name: file_name.clone(),
                reuse: *reuse,
            };
            let mut owned = ctx.variables();
            owned.extend(ctx.secrets());
            let vars: HashMap<&str, String> = owned.iter().map(|(k, v)| (k.as_str(), v.clone())).collect();
            let download_dir = services.downloads.clone().unwrap_or_else(http::fallback_download_dir);
            tokio::select! {
                result = http::perform(&spec, &vars, &download_dir) => match result {
                    Ok(o) => {
                        if o.cached {
                            tracing::info!(action = %action.id, file = o.file.as_deref().unwrap_or(""), "http request reused its file");
                        } else if o.ok {
                            tracing::info!(action = %action.id, status = o.status, ms = o.elapsed_ms, file = o.file.as_deref().unwrap_or(""), "http request done");
                        } else {
                            tracing::warn!(action = %action.id, status = o.status, body = %o.body_preview.chars().take(200).collect::<String>(), "http request answered with an error status");
                        }
                        if let Some(name) = save_to {
                            ctx.set_var(name, o.body_preview.clone(), *save_scope);
                            ctx.set_var(&format!("{name}.status"), o.status.to_string(), *save_scope);
                            ctx.set_var(&format!("{name}.file"), o.file.clone().unwrap_or_default(), *save_scope);
                            ctx.set_var(&format!("{name}.cached"), if o.cached { "true" } else { "false" }.into(), *save_scope);
                        }
                    }
                    Err(e) => {
                        tracing::warn!(action = %action.id, error = %e, "http request failed");
                        if let Some(name) = save_to {
                            ctx.set_var(name, String::new(), *save_scope);
                            ctx.set_var(&format!("{name}.status"), "0".into(), *save_scope);
                            ctx.set_var(&format!("{name}.file"), String::new(), *save_scope);
                            ctx.set_var(&format!("{name}.cached"), "false".into(), *save_scope);
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
            let builtins = super::builtins::values(&ctx.press(), &ctx.env());
            let lunchpad = ctx.script_info();
            let code = code.clone();
            let job = tokio::task::spawn_blocking(move || script::run(ScriptInput { code: &code, locals: &input_locals, globals: &input_globals, builtins: &builtins, lunchpad }));
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
                    for line in &out.logs {
                        tracing::info!(action = %action.id, "script: {line}");
                    }
                    run_queued(ctx, action, out.actions).await;
                }
                Ok(Err(e)) => tracing::warn!(action = %action.id, error = %e, "script failed"),
                Err(e) => tracing::warn!(action = %action.id, error = %e, "script task failed"),
            }
        }

        _ => {}
    }
}

/// Actions a script queued through `Lunchpad.*`: run in order once the script
/// is done, with the script's own context. Flow markers only mean something
/// inside a list and are left out; a page may be named instead of identified.
async fn run_queued(ctx: &RunContext, script: &Action, queued: Vec<serde_json::Value>) {
    for value in queued {
        if ctx.token.is_cancelled() {
            return;
        }
        let kind = match serde_json::from_value::<ActionKind>(value.clone()) {
            Ok(kind) => kind,
            Err(e) => {
                tracing::warn!(action = %script.id, error = %e, json = %value, "script queued an action the engine does not understand");
                continue;
            }
        };
        let kind = match kind {
            ActionKind::IfStart { .. }
            | ActionKind::IfElse { .. }
            | ActionKind::IfEnd { .. }
            | ActionKind::FlipFlopStart { .. }
            | ActionKind::FlipFlopMiddle { .. }
            | ActionKind::FlipFlopEnd { .. }
            | ActionKind::PushToTalkStart { .. }
            | ActionKind::PushToTalkEnd { .. } => {
                tracing::warn!(action = %script.id, "script queued a flow marker, which only works inside an action list");
                continue;
            }
            ActionKind::SwitchPage { page_id } => ActionKind::SwitchPage { page_id: ctx.page_id_for(&page_id) },
            other => other,
        };
        let action = Action { id: uuid::Uuid::new_v4().to_string(), wait: true, kind };
        Box::pin(super::engine::execute(ctx, &action)).await;
    }
}

/// A found window into variables: the handle under `name`, its details under `name.<field>`;
/// everything empty when nothing matched, so a following check can tell.
/// The window an action means: the one in front, a remembered handle, or a title search.
async fn find_window(ctx: &RunContext, target: WindowTarget, title: &str, matching: crate::desktop::TitleMatch, app: &str) -> Result<Option<crate::desktop::WindowInfo>, String> {
    let title = ctx.expand(title);
    let app = ctx.expand(app);
    tokio::task::spawn_blocking(move || match target {
        WindowTarget::Foreground => crate::desktop::foreground(),
        WindowTarget::Title if title.trim().starts_with(crate::desktop::HANDLE_PREFIX) => crate::desktop::by_handle(title.trim()),
        // What a "get window" variable holds: the window as JSON; its handle names the window.
        WindowTarget::Title if title.trim().starts_with('{') => match serde_json::from_str::<serde_json::Value>(title.trim()).ok().and_then(|v| v.get("handle").and_then(|h| h.as_str()).map(str::to_string)) {
            Some(handle) => crate::desktop::by_handle(&handle),
            None => Err("the title is neither a window nor a text".into()),
        },
        WindowTarget::Title => {
            let windows = crate::desktop::list()?;
            Ok(crate::desktop::find(&windows, &title, matching, &app)?.cloned())
        }
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r)
}

/// OBS's key ids (`OBS_KEY_F5`, `OBS_KEY_SPACE`) from what a user might type: `F5`, `space`, `a`.
fn obs_key_id(key: &str) -> String {
    let key = key.trim();
    if key.to_ascii_uppercase().starts_with("OBS_KEY_") {
        return key.to_ascii_uppercase();
    }
    let name = match key.to_ascii_lowercase().as_str() {
        "enter" | "return" => "RETURN".to_string(),
        "esc" | "escape" => "ESCAPE".to_string(),
        "pageup" | "page up" => "PAGEUP".to_string(),
        "pagedown" | "page down" => "PAGEDOWN".to_string(),
        "backspace" => "BACKSPACE".to_string(),
        "delete" | "del" => "DELETE".to_string(),
        "insert" | "ins" => "INSERT".to_string(),
        "up" | "arrowup" => "UP".to_string(),
        "down" | "arrowdown" => "DOWN".to_string(),
        "left" | "arrowleft" => "LEFT".to_string(),
        "right" | "arrowright" => "RIGHT".to_string(),
        " " | "space" => "SPACE".to_string(),
        other => other.replace(' ', "").to_ascii_uppercase(),
    };
    format!("OBS_KEY_{name}")
}

/// `<name>` = the screen as JSON plus `count` (empty when there is none), and every field beside it as `<name>.<field>`.
fn remember_screen(ctx: &RunContext, name: &str, screen: Option<&crate::desktop::ScreenInfo>, count: usize, scope: VarScope) {
    let json = screen.and_then(|s| serde_json::to_value(s).ok()).map(|mut v| {
        v["count"] = serde_json::Value::from(count);
        v.to_string()
    });
    ctx.set_var(name, json.unwrap_or_default(), scope);
    let text = |s: Option<String>| s.unwrap_or_default();
    for (field, value) in [
        ("number", screen.map(|s| s.number.to_string())),
        ("x", screen.map(|s| s.x.to_string())),
        ("y", screen.map(|s| s.y.to_string())),
        ("width", screen.map(|s| s.width.to_string())),
        ("height", screen.map(|s| s.height.to_string())),
        ("scale", screen.map(|s| s.scale.to_string())),
        ("dpi", screen.map(|s| s.dpi.to_string())),
        ("primary", screen.map(|s| s.primary.to_string())),
        ("count", screen.map(|_| count.to_string())),
    ] {
        ctx.set_var(&format!("{name}.{field}"), text(value), scope);
    }
}

/// `<name>` = the window as JSON (empty when there is none), and every field beside it as `<name>.<field>`.
fn remember_window(ctx: &RunContext, name: &str, window: Option<&crate::desktop::WindowInfo>, scope: VarScope) {
    ctx.set_var(name, window.and_then(|w| serde_json::to_string(w).ok()).unwrap_or_default(), scope);
    let text = |s: Option<String>| s.unwrap_or_default();
    ctx.set_var(&format!("{name}.handle"), text(window.map(|w| w.handle.clone())), scope);
    ctx.set_var(&format!("{name}.title"), text(window.map(|w| w.title.clone())), scope);
    ctx.set_var(&format!("{name}.app"), text(window.map(|w| w.app.clone())), scope);
    for (field, value) in [("x", window.map(|w| w.x)), ("y", window.map(|w| w.y)), ("width", window.map(|w| w.width)), ("height", window.map(|w| w.height))] {
        ctx.set_var(&format!("{name}.{field}"), text(value.map(|v| v.to_string())), scope);
    }
    ctx.set_var(&format!("{name}.screen"), text(window.map(|w| w.screen.to_string())), scope);
    ctx.set_var(&format!("{name}.minimized"), text(window.map(|w| w.minimized.to_string())), scope);
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
pub(super) fn number_from(ctx: &RunContext, from: &Option<String>, fallback: f32) -> f32 {
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

/// An `.app` bundle on macOS is a folder: it starts through Launch Services, not as a process.
fn is_app_bundle(executable: &str) -> bool {
    let name = executable.trim().trim_end_matches('/');
    name.len() > 4 && name.to_ascii_lowercase().ends_with(".app")
}

/// `open -a <app> [--args …]`: an app that is already running comes forward instead of
/// starting twice. With `wait`, `open -W` stays while the app runs, so the action lasts
/// as long as a started program would. "Start without a window" keeps the app hidden
/// and in the background.
fn app_open_args(app: &str, args: &[String], hidden: bool, wait: bool) -> Vec<String> {
    let mut out = Vec::new();
    if wait {
        out.push("-W".to_string());
    }
    if hidden {
        out.push("-j".into());
        out.push("-g".into());
    }
    out.push("-a".into());
    out.push(app.trim().trim_end_matches('/').to_string());
    if !args.is_empty() {
        out.push("--args".into());
        out.extend(args.iter().cloned());
    }
    out
}

/// On macOS, what `open` should start instead of the executable itself: an `.app` bundle.
#[cfg(target_os = "macos")]
fn app_for(executable: &str) -> Option<String> {
    is_app_bundle(executable).then(|| executable.trim().to_string())
}
#[cfg(not(target_os = "macos"))]
fn app_for(_executable: &str) -> Option<String> {
    None
}

/// On macOS, a bare name that is not a command on the PATH may still be an app's name
/// ("Spotify"), which Launch Services knows.
#[cfg(target_os = "macos")]
fn app_fallback(executable: &str, error: &std::io::Error) -> Option<String> {
    (error.kind() == std::io::ErrorKind::NotFound && !executable.contains('/')).then(|| executable.trim().to_string())
}
#[cfg(not(target_os = "macos"))]
fn app_fallback(_executable: &str, _error: &std::io::Error) -> Option<String> {
    None
}

/// Ask an app to quit the way the Dock would (macOS); the `open -W` child ends with it.
#[cfg(target_os = "macos")]
async fn quit_app(app: &str) {
    let name = app.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!("tell application \"{name}\" to quit");
    let quit = tokio::process::Command::new("osascript").args(["-e", &script]).stdin(std::process::Stdio::null()).status();
    match tokio::time::timeout(Duration::from_secs(5), quit).await {
        Ok(Ok(status)) if status.success() => tracing::info!(app, "application asked to quit"),
        Ok(Ok(status)) => tracing::warn!(app, ?status, "application did not take the quit request"),
        Ok(Err(e)) => tracing::warn!(app, error = %e, "could not ask the application to quit"),
        Err(_) => tracing::warn!(app, "the application is taking its time to quit"),
    }
}
#[cfg(not(target_os = "macos"))]
async fn quit_app(_app: &str) {}

/// The command for a launch: the executable itself, or `open` for an app on macOS.
fn launch_command(executable: &str, app: Option<&str>, args: &[String], hidden: bool, kill_on_stop: bool, capture: bool, wait: bool) -> tokio::process::Command {
    let mut cmd = match app {
        Some(app) => {
            let mut cmd = tokio::process::Command::new("open");
            cmd.args(app_open_args(app, args, hidden, wait));
            cmd
        }
        None => {
            let mut cmd = tokio::process::Command::new(executable);
            cmd.args(args);
            cmd
        }
    };
    cmd.stdin(std::process::Stdio::null()).kill_on_drop(kill_on_stop);
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
    cmd
}

/// `wait` is the action's own switch. Off, and with nothing that needs the macro to
/// outlive the start (no "stop the program when the macro stops", no output variable),
/// the program is started and left alone: the macro goes on and ends without it.
async fn launch(ctx: &RunContext, executable: &str, arguments: &str, hidden: bool, kill_on_stop: bool, capture: bool, wait: bool) -> Option<String> {
    let executable = executable.trim();
    if executable.is_empty() {
        tracing::warn!("launch application: no executable set");
        return None;
    }
    let args = shlex::split(arguments).unwrap_or_else(|| arguments.split_whitespace().map(str::to_string).collect());
    let detached = !wait && !kill_on_stop && !capture;
    let mut app = app_for(executable);
    let mut cmd = launch_command(executable, app.as_deref(), &args, hidden, kill_on_stop, capture, !detached);
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => match app_fallback(executable, &e) {
            Some(name) => {
                let mut cmd = launch_command(executable, Some(&name), &args, hidden, kill_on_stop, capture, !detached);
                app = Some(name);
                match cmd.spawn() {
                    Ok(c) => c,
                    Err(e) => {
                        tracing::warn!(executable, error = %e, "could not start application");
                        return None;
                    }
                }
            }
            None => {
                tracing::warn!(executable, error = %e, "could not start application");
                return None;
            }
        },
    };
    let pid = child.id();
    tracing::info!(executable, ?args, pid, app = app.is_some(), detached, "application started");
    if detached {
        // Reap it in the background; nothing waits for it.
        tokio::spawn(async move {
            let _ = child.wait().await;
        });
        return None;
    }

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
                if let Some(app) = &app {
                    quit_app(app).await;
                }
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

#[cfg(test)]
mod launch_tests {
    use super::{app_open_args, is_app_bundle};

    #[test]
    fn an_app_bundle_is_told_apart_from_a_program() {
        assert!(is_app_bundle("/Applications/Spotify.app"));
        assert!(is_app_bundle("/Applications/Spotify.app/"));
        assert!(is_app_bundle("~/Applications/OBS.APP"));
        assert!(!is_app_bundle("/usr/bin/say"));
        assert!(!is_app_bundle("Spotify"));
        assert!(!is_app_bundle(".app"));
    }

    #[test]
    fn open_waits_only_when_asked_and_passes_the_arguments_on() {
        assert_eq!(app_open_args("/Applications/Spotify.app/", &[], false, false), ["-a", "/Applications/Spotify.app"]);
        let args = vec!["--minimized".to_string(), "a b".to_string()];
        assert_eq!(app_open_args("Spotify", &args, true, true), ["-W", "-j", "-g", "-a", "Spotify", "--args", "--minimized", "a b"]);
    }
}
