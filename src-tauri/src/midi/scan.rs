//! Discovers Launchpads by pairing MIDI inputs with outputs through a
//! Universal Device Inquiry.
//!
//! Strategy: open every input port at once, then for each output port send
//! the inquiry and wait (briefly) for a reply on *any* input. The input that
//! answers is the output's partner. This pairs ports without relying on OS
//! naming conventions, which differ between macOS, Windows and Linux.

use super::inquiry::{is_inquiry_reply, parse_inquiry_reply, DEVICE_INQUIRY};
use super::types::*;
use crossbeam_channel::{unbounded, RecvTimeoutError};
use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput};
use std::collections::HashSet;
use std::time::{Duration, Instant};

/// How long to wait for a reply from a port that looks like a Launchpad.
const LAUNCHPAD_TIMEOUT: Duration = Duration::from_millis(600);
/// How long to wait for a reply from any other port.
const OTHER_TIMEOUT: Duration = Duration::from_millis(150);

fn new_input(name: &str) -> MidiResult<MidiInput> {
    let mut input = MidiInput::new(name).map_err(|e| MidiError::Init(e.to_string()))?;
    // Default midir behaviour drops SysEx, which is exactly what we need.
    input.ignore(Ignore::None);
    Ok(input)
}

fn new_output(name: &str) -> MidiResult<MidiOutput> {
    MidiOutput::new(name).map_err(|e| MidiError::Init(e.to_string()))
}

/// List all MIDI input ports.
pub fn list_inputs() -> MidiResult<Vec<MidiPortInfo>> {
    let input = new_input("Lunchpad scanner")?;
    Ok(input
        .ports()
        .iter()
        .enumerate()
        .map(|(index, port)| MidiPortInfo {
            index,
            name: input.port_name(port).unwrap_or_else(|_| format!("Input {index}")),
        })
        .collect())
}

/// List all MIDI output ports.
pub fn list_outputs() -> MidiResult<Vec<MidiPortInfo>> {
    let output = new_output("Lunchpad scanner")?;
    Ok(output
        .ports()
        .iter()
        .enumerate()
        .map(|(index, port)| MidiPortInfo {
            index,
            name: output.port_name(port).unwrap_or_else(|_| format!("Output {index}")),
        })
        .collect())
}

/// A cheap fingerprint of the current port list, used by the hot-plug watcher.
pub fn port_fingerprint() -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    if let Ok(inputs) = list_inputs() {
        names.extend(inputs.into_iter().map(|p| format!("in:{}", p.name)));
    }
    if let Ok(outputs) = list_outputs() {
        names.extend(outputs.into_iter().map(|p| format!("out:{}", p.name)));
    }
    names
}

/// Scan for Launchpads.
///
/// `exclude` holds port names that must not be opened (typically the pair the
/// app is already connected to, which Windows would refuse to open twice).
pub fn scan_launchpads(exclude: &[String]) -> MidiResult<Vec<DiscoveredLaunchpad>> {
    let started = Instant::now();
    let excluded: HashSet<&str> = exclude.iter().map(|s| s.as_str()).collect();

    let inputs = list_inputs()?;
    let outputs = list_outputs()?;
    tracing::debug!(inputs = ?inputs.iter().map(|p| &p.name).collect::<Vec<_>>(),
                    outputs = ?outputs.iter().map(|p| &p.name).collect::<Vec<_>>(),
                    "scanning MIDI ports");

    // Open every input we are allowed to and funnel inquiry replies into one channel.
    let (tx, rx) = unbounded::<(usize, Vec<u8>)>();
    let mut open_inputs: Vec<MidiInputConnection<()>> = Vec::new();
    for port in &inputs {
        if excluded.contains(port.name.as_str()) {
            continue;
        }
        let midi_in = new_input("Lunchpad scanner input")?;
        let Some(handle) = midi_in.ports().get(port.index).cloned() else { continue };
        let tx = tx.clone();
        let index = port.index;
        match midi_in.connect(
            &handle,
            "lunchpad-scan",
            move |_ts, msg, _| {
                if is_inquiry_reply(msg) {
                    let _ = tx.send((index, msg.to_vec()));
                }
            },
            (),
        ) {
            Ok(conn) => open_inputs.push(conn),
            Err(e) => tracing::warn!(port = %port.name, error = %e, "could not open input for scanning"),
        }
    }
    drop(tx);

    let mut found: Vec<DiscoveredLaunchpad> = Vec::new();
    let mut claimed_inputs: HashSet<usize> = HashSet::new();

    for out_port in &outputs {
        if excluded.contains(out_port.name.as_str()) {
            continue;
        }
        let midi_out = new_output("Lunchpad scanner output")?;
        let Some(handle) = midi_out.ports().get(out_port.index).cloned() else { continue };
        let mut conn = match midi_out.connect(&handle, "lunchpad-scan") {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(port = %out_port.name, error = %e, "could not open output for scanning");
                continue;
            }
        };

        // Drain stale replies that may still be queued from a previous output.
        while rx.try_recv().is_ok() {}

        if let Err(e) = conn.send(&DEVICE_INQUIRY) {
            tracing::warn!(port = %out_port.name, error = %e, "inquiry send failed");
            continue;
        }

        let looks_like_launchpad = LaunchpadModel::from_port_name(&out_port.name).is_some();
        let timeout = if looks_like_launchpad { LAUNCHPAD_TIMEOUT } else { OTHER_TIMEOUT };
        let deadline = Instant::now() + timeout;

        // A device that is busy (another app talking to it, or a scan of its own going on)
        // can swallow the first inquiry, so it is asked once more halfway through the window.
        let retry_at = Instant::now() + timeout / 2;
        let mut retried = false;
        let mut reply: Option<(usize, Vec<u8>)> = None;
        loop {
            let now = Instant::now();
            if !retried && now >= retry_at {
                retried = true;
                if let Err(e) = conn.send(&DEVICE_INQUIRY) {
                    tracing::debug!(port = %out_port.name, error = %e, "inquiry retry failed");
                }
            }
            let wait_until = if retried { deadline } else { retry_at.min(deadline) };
            let remaining = wait_until.saturating_duration_since(now);
            match rx.recv_timeout(remaining) {
                Ok((input_index, msg)) => {
                    if claimed_inputs.contains(&input_index) {
                        continue;
                    }
                    reply = Some((input_index, msg));
                    break;
                }
                Err(RecvTimeoutError::Timeout) => {
                    if Instant::now() >= deadline {
                        break;
                    }
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
        drop(conn);

        let input_for = |index: usize| inputs.iter().find(|p| p.index == index).cloned();

        match reply {
            Some((input_index, msg)) => {
                let parsed = parse_inquiry_reply(&msg);
                let model = parsed
                    .as_ref()
                    .and_then(|r| r.model())
                    .map(|m| refine_by_port_name(m, &out_port.name));
                let Some(input) = input_for(input_index) else { continue };
                match (model, parsed) {
                    (Some(model), Some(parsed)) => {
                        tracing::info!(model = %model, input = %input.name, output = %out_port.name,
                                       firmware = %parsed.firmware, "identified Launchpad by device inquiry");
                        claimed_inputs.insert(input_index);
                        found.push(DiscoveredLaunchpad {
                            model,
                            model_name: model.display_name().to_string(),
                            input,
                            output: out_port.clone(),
                            firmware: Some(parsed.firmware.clone()),
                            identified_by: IdentificationSource::DeviceInquiry,
                            inquiry_reply: Some(parsed.raw_hex()),
                            connected: false,
                        });
                    }
                    _ => {
                        // Answered, but not a Launchpad we know. Fall back to the name.
                        if let Some(model) = LaunchpadModel::from_port_name(&out_port.name) {
                            tracing::info!(model = %model, output = %out_port.name,
                                           reply = %hex(&msg), "unknown inquiry reply, identified by port name");
                            claimed_inputs.insert(input_index);
                            found.push(DiscoveredLaunchpad {
                                model,
                                model_name: model.display_name().to_string(),
                                input,
                                output: out_port.clone(),
                                firmware: None,
                                identified_by: IdentificationSource::PortName,
                                inquiry_reply: Some(hex(&msg)),
                                connected: false,
                            });
                        } else {
                            tracing::debug!(output = %out_port.name, reply = %hex(&msg), "non-Launchpad inquiry reply");
                        }
                    }
                }
            }
            None => {
                // No reply. Devices like the original Launchpad MK1 never answer,
                // so pair by identical port name as a last resort.
                if let Some(model) = LaunchpadModel::from_port_name(&out_port.name) {
                    let partner = inputs
                        .iter()
                        .find(|p| p.name == out_port.name && !claimed_inputs.contains(&p.index))
                        .cloned();
                    if let Some(input) = partner {
                        tracing::info!(model = %model, output = %out_port.name, "no inquiry reply, identified by port name");
                        claimed_inputs.insert(input.index);
                        found.push(DiscoveredLaunchpad {
                            model,
                            model_name: model.display_name().to_string(),
                            input,
                            output: out_port.clone(),
                            firmware: None,
                            identified_by: IdentificationSource::PortName,
                            inquiry_reply: None,
                            connected: false,
                        });
                    }
                }
            }
        }
    }

    drop(open_inputs);
    let found = prefer_documented_pair(found);
    tracing::info!(count = found.len(), elapsed_ms = started.elapsed().as_millis(), "scan finished");
    Ok(found)
}

/// The X, Mini MK3 and Pro MK3 manuals all print the same inquiry reply
/// (`13 01`), so the family bytes alone may not tell them apart. When the
/// reply says "third generation", let the port name decide between them.
fn refine_by_port_name(model: LaunchpadModel, port_name: &str) -> LaunchpadModel {
    use LaunchpadModel::*;
    let third_gen = matches!(model, LaunchpadX | LaunchpadMiniMk3 | LaunchpadProMk3);
    if !third_gen {
        return model;
    }
    match LaunchpadModel::from_port_name(port_name) {
        Some(named @ (LaunchpadX | LaunchpadMiniMk3 | LaunchpadProMk3)) if named != model => {
            tracing::info!(inquiry = %model, name = %named, port = port_name, "port name overrides inquiry model");
            named
        }
        _ => model,
    }
}


fn rank_for(model: LaunchpadModel, name: &str, on_windows: bool) -> u8 {
    use LaunchpadModel::*;
    let n = name.to_lowercase();
    if on_windows {
        // Windows names the first interface after the device and numbers the
        // rest "MIDIIN2 (…)" / "MIDIOUT2 (…)"; the manuals fix the order per
        // model (X / Mini MK3: DAW, MIDI; Pro MK3: MIDI, DIN, DAW; Pro: Live,
        // Standalone, MIDI).
        let wanted = match model {
            // The Launchkey's DAW interface is its second one.
            LaunchpadX | LaunchpadMiniMk3 | LaunchpadProMk2 | LaunchkeyMiniMk3 => 2,
            LaunchpadProMk3 => 1,
            _ => return 0,
        };
        return if windows_ordinal(&n).unwrap_or(1) == wanted { 0 } else { 2 };
    }
    // macOS and Linux carry the interface name in the port name.
    match model {
        LaunchpadX | LaunchpadMiniMk3 => {
            if n.contains("daw") {
                2
            } else if n.contains("midi") {
                0
            } else {
                1
            }
        }
        LaunchpadProMk3 => {
            if n.contains("daw") || n.contains("din") {
                2
            } else if n.contains("midi") {
                0
            } else {
                1
            }
        }
        LaunchpadProMk2 => {
            if n.contains("standalone") {
                0
            } else if n.contains("live") || n.contains("midi") {
                2
            } else {
                1
            }
        }
        // The Launchkey talks to apps on its DAW interface; the MIDI one carries the keys.
        LaunchkeyMiniMk3 => {
            if n.contains("daw") {
                0
            } else if n.contains("midi") {
                2
            } else {
                1
            }
        }
        _ => 0,
    }
}

/// `MIDIIN2 (Launchpad X)` → 2; a name without the prefix is the first interface.
fn windows_ordinal(lower: &str) -> Option<u32> {
    let rest = lower.strip_prefix("midiin").or_else(|| lower.strip_prefix("midiout"))?;
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok()
}

/// Multi-interface models answer the inquiry on every pair; keep only the
/// pair meant for apps whenever the names can tell them apart.
fn prefer_documented_pair(found: Vec<DiscoveredLaunchpad>) -> Vec<DiscoveredLaunchpad> {
    prefer_documented_pair_on(found, cfg!(target_os = "windows"))
}

/// `prefer_documented_pair` with the platform's naming rule chosen explicitly,
/// so the tests can check both rules on any host. Ranks: 0 = the documented
/// pair (MIDI on the MK3 family, Standalone on the 2015 Pro), 2 = one of the
/// others (DAW, DIN, Live), 1 = the name does not say.
fn prefer_documented_pair_on(found: Vec<DiscoveredLaunchpad>, on_windows: bool) -> Vec<DiscoveredLaunchpad> {
    let rank = |d: &DiscoveredLaunchpad| {
        let out = rank_for(d.model, &d.output.name, on_windows);
        if out == 1 {
            rank_for(d.model, &d.input.name, on_windows)
        } else {
            out
        }
    };
    let ranked: Vec<(u8, DiscoveredLaunchpad)> = found.into_iter().map(|d| (rank(&d), d)).collect();
    let best: Vec<u8> = ranked
        .iter()
        .map(|(_, d)| ranked.iter().filter(|(_, o)| o.model == d.model).map(|(r, _)| *r).min().unwrap_or(0))
        .collect();
    ranked
        .into_iter()
        .zip(best)
        .filter(|((r, d), best)| {
            let keep = r == best;
            if !keep {
                tracing::debug!(model = %d.model, input = %d.input.name, output = %d.output.name, "skipping secondary interface");
            }
            keep
        })
        .map(|((_, d), _)| d)
        .collect()
}

#[cfg(test)]
mod interface_tests {
    use super::*;
    use LaunchpadModel::*;

    fn pair(model: LaunchpadModel, name: &str) -> DiscoveredLaunchpad {
        DiscoveredLaunchpad {
            model,
            model_name: model.display_name().to_string(),
            input: MidiPortInfo { index: 0, name: name.replace("Out", "In") },
            output: MidiPortInfo { index: 0, name: name.to_string() },
            firmware: None,
            identified_by: IdentificationSource::DeviceInquiry,
            inquiry_reply: None,
            connected: false,
        }
    }

    #[test]
    fn interface_names_on_macos_and_linux() {
        assert_eq!(rank_for(LaunchpadX, "Launchpad X LPX MIDI Out", false), 0);
        assert_eq!(rank_for(LaunchpadX, "Launchpad X LPX DAW Out", false), 2);
        assert_eq!(rank_for(LaunchpadMiniMk3, "Launchpad Mini MK3:Launchpad Mini MK3 LPMiniMK3 MIDI 20:1", false), 0);
        assert_eq!(rank_for(LaunchpadProMk3, "Launchpad Pro MK3 LPProMK3 DIN Out", false), 2);
        assert_eq!(rank_for(LaunchpadProMk3, "Launchpad Pro MK3 LPProMK3 DAW Out", false), 2);
        assert_eq!(rank_for(LaunchpadProMk3, "Launchpad Pro MK3 LPProMK3 MIDI Out", false), 0);
        assert_eq!(rank_for(LaunchpadProMk2, "Launchpad Pro Standalone Port", false), 0);
        assert_eq!(rank_for(LaunchpadProMk2, "Launchpad Pro Live Port", false), 2);
        assert_eq!(rank_for(LaunchpadProMk2, "Launchpad Pro MIDI Port", false), 2);
        assert_eq!(rank_for(LaunchpadMk2, "Launchpad MK2", false), 0);
        assert_eq!(rank_for(LaunchpadX, "Launchpad X", false), 1);
    }

    #[test]
    fn interface_ordinals_on_windows() {
        assert_eq!(windows_ordinal("midiin2 (lpx midi)"), Some(2));
        assert_eq!(windows_ordinal("midiout3 (lppromk3 midi)"), Some(3));
        assert_eq!(windows_ordinal("lpx midi"), None);
        // The first interface of the X is the DAW one, whatever it is called.
        assert_eq!(rank_for(LaunchpadX, "LPX MIDI", true), 2);
        assert_eq!(rank_for(LaunchpadX, "MIDIOUT2 (LPX MIDI)", true), 0);
        assert_eq!(rank_for(LaunchpadMiniMk3, "MIDIOUT2 (LPMiniMK3 MIDI)", true), 0);
        assert_eq!(rank_for(LaunchpadProMk3, "LPProMK3 MIDI", true), 0);
        assert_eq!(rank_for(LaunchpadProMk3, "MIDIOUT2 (LPProMK3 MIDI)", true), 2);
        assert_eq!(rank_for(LaunchpadProMk3, "MIDIOUT3 (LPProMK3 MIDI)", true), 2);
        assert_eq!(rank_for(LaunchpadProMk2, "MIDIOUT2 (Launchpad Pro)", true), 0);
        assert_eq!(rank_for(LaunchpadProMk2, "Launchpad Pro", true), 2);
        assert_eq!(rank_for(LaunchpadMk2, "Launchpad MK2", true), 0);
    }

    #[test]
    fn keeps_only_the_documented_pair() {
        // macOS / Linux names carry the interface name.
        let found = vec![pair(LaunchpadX, "Launchpad X LPX DAW Out"), pair(LaunchpadX, "Launchpad X LPX MIDI Out"), pair(LaunchpadMk2, "Launchpad MK2")];
        let kept = prefer_documented_pair_on(found, false);
        assert_eq!(kept.len(), 2);
        assert!(kept.iter().any(|d| d.model == LaunchpadX && d.output.name.contains("MIDI")));
        assert!(kept.iter().all(|d| !d.output.name.contains("DAW")));
        // A lone secondary pair is better than nothing.
        let only_daw = prefer_documented_pair_on(vec![pair(LaunchpadX, "Launchpad X LPX DAW Out")], false);
        assert_eq!(only_daw.len(), 1);
        // Names the rule cannot read keep every pair.
        let unknown = prefer_documented_pair_on(vec![pair(LaunchpadX, "Launchpad X"), pair(LaunchpadX, "Launchpad X #2")], false);
        assert_eq!(unknown.len(), 2);
        // Windows numbers the interfaces instead: the second pair of the X is the MIDI one.
        let windows = vec![pair(LaunchpadX, "LPX MIDI"), pair(LaunchpadX, "MIDIOUT2 (LPX MIDI)"), pair(LaunchpadProMk2, "MIDIOUT2 (Launchpad Pro)"), pair(LaunchpadProMk2, "Launchpad Pro")];
        let kept = prefer_documented_pair_on(windows, true);
        assert_eq!(kept.len(), 2);
        assert!(kept.iter().any(|d| d.model == LaunchpadX && d.output.name == "MIDIOUT2 (LPX MIDI)"));
        assert!(kept.iter().any(|d| d.model == LaunchpadProMk2 && d.output.name == "MIDIOUT2 (Launchpad Pro)"));
    }
}

