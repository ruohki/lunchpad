//! Sandboxed JavaScript snippets inside macros (boa engine, no I/O). The
//! snippet sees `vars` (locals over globals over the trigger values such as
//! `velocity`), `globals`, and the trigger values as bare globals; the
//! completion value (or `return` value) becomes the result, and writes to
//! `vars.*` / `globals.*` flow back into the macro's variables.

use boa_engine::property::Attribute;
use boa_engine::{js_string, Context, JsValue, Script, Source};
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptOutcome {
    /// Result as text (objects are JSON)
    pub result: String,
    pub locals: HashMap<String, String>,
    pub globals: HashMap<String, String>,
    pub elapsed_ms: u64,
}

pub struct ScriptInput<'a> {
    pub code: &'a str,
    pub locals: &'a HashMap<String, String>,
    pub globals: &'a HashMap<String, String>,
    pub builtins: &'a HashMap<&'static str, String>,
}

const LOOP_LIMIT: u64 = 2_000_000;

/// Run the snippet on the current thread (call from `spawn_blocking`).
pub fn run(input: ScriptInput<'_>) -> Result<ScriptOutcome, String> {
    let started = std::time::Instant::now();
    let mut ctx = Context::default();
    ctx.runtime_limits_mut().set_loop_iteration_limit(LOOP_LIMIT);
    ctx.runtime_limits_mut().set_recursion_limit(256);

    let to_js = |ctx: &mut Context, map: &HashMap<String, String>| -> Result<JsValue, String> {
        let json = serde_json::Value::Object(map.iter().map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone()))).collect());
        JsValue::from_json(&json, ctx).map_err(|e| e.to_string())
    };
    // `vars` = trigger values, overlaid with globals, overlaid with locals
    // (the same order `{{placeholders}}` resolve in).
    let mut merged: HashMap<String, String> = input.builtins.iter().map(|(k, v)| (k.to_string(), v.clone())).collect();
    merged.extend(input.globals.iter().map(|(k, v)| (k.clone(), v.clone())));
    merged.extend(input.locals.iter().map(|(k, v)| (k.clone(), v.clone())));
    let vars = to_js(&mut ctx, &merged)?;
    let globals = to_js(&mut ctx, input.globals)?;
    ctx.register_global_property(js_string!("vars"), vars, Attribute::all()).map_err(|e| e.to_string())?;
    ctx.register_global_property(js_string!("globals"), globals, Attribute::all()).map_err(|e| e.to_string())?;
    for (name, value) in input.builtins {
        let js: JsValue = match value.parse::<f64>() {
            Ok(n) if !name.ends_with("Id") => JsValue::from(n),
            _ => JsValue::from(js_string!(value.as_str())),
        };
        ctx.register_global_property(js_string!(*name), js, Attribute::all()).map_err(|e| e.to_string())?;
    }

    let script = parse(input.code, &mut ctx)?;
    let value = script.evaluate(&mut ctx).map_err(|e| e.to_string())?;
    let result = stringify(&value, &mut ctx);

    let read_back = |ctx: &mut Context, name: &str| -> HashMap<String, String> {
        let global = ctx.global_object();
        let Ok(obj) = global.get(js_string!(name), ctx) else { return HashMap::new() };
        match obj.to_json(ctx) {
            Ok(Some(serde_json::Value::Object(map))) => map.into_iter().map(|(k, v)| (k, json_text(v))).collect(),
            _ => HashMap::new(),
        }
    };
    let new_globals = read_back(&mut ctx, "globals");
    let new_vars = read_back(&mut ctx, "vars");
    // Anything in `vars` that differs from what came in becomes a local.
    let locals: HashMap<String, String> = new_vars.into_iter().filter(|(k, v)| merged.get(k) != Some(v) || input.locals.contains_key(k)).collect();

    Ok(ScriptOutcome { result, locals, globals: new_globals, elapsed_ms: started.elapsed().as_millis() as u64 })
}

/// Parse the snippet as a script, so its completion value (the last expression)
/// is the result. A top-level `return` is a syntax error in a script; then the
/// snippet is a function body instead and its return value is the result. A
/// `return` inside a function the snippet declares does not change anything.
fn parse(code: &str, ctx: &mut Context) -> Result<Script, String> {
    match Script::parse(Source::from_bytes(code.as_bytes()), None, ctx) {
        Ok(script) => Ok(script),
        Err(as_script) => {
            let wrapped = format!("(function () {{\n{code}\n}})()");
            Script::parse(Source::from_bytes(wrapped.as_bytes()), None, ctx).map_err(|_| as_script.to_string())
        }
    }
}

fn stringify(value: &JsValue, ctx: &mut Context) -> String {
    if value.is_undefined() {
        return String::new();
    }
    if let Some(s) = value.as_string() {
        return s.to_std_string_escaped();
    }
    match value.to_json(ctx) {
        Ok(Some(json)) => json_text(json),
        _ => value.to_string(ctx).map(|s| s.to_std_string_escaped()).unwrap_or_default(),
    }
}

/// JSON value as macro text: strings bare, whole numbers without ".0".
fn json_text(json: serde_json::Value) -> String {
    match json {
        serde_json::Value::String(s) => s,
        serde_json::Value::Number(n) => match n.as_f64() {
            Some(f) if f.fract() == 0.0 && f.abs() < 1e15 => format!("{}", f as i64),
            _ => n.to_string(),
        },
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run_code(code: &str, locals: &[(&str, &str)], globals: &[(&str, &str)]) -> ScriptOutcome {
        let locals: HashMap<String, String> = locals.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        let globals: HashMap<String, String> = globals.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        let mut builtins = HashMap::new();
        builtins.insert("velocity", "100".to_string());
        builtins.insert("pageId", "default".to_string());
        run(ScriptInput { code, locals: &locals, globals: &globals, builtins: &builtins }).expect("script ok")
    }

    #[test]
    fn expression_result_and_builtins() {
        assert_eq!(run_code("velocity * 2", &[], &[]).result, "200");
        assert_eq!(run_code("pageId + '!'", &[], &[]).result, "default!");
        assert_eq!(run_code("return JSON.parse(vars.body).temp", &[("body", r#"{"temp": 21.5}"#)], &[]).result, "21.5");
        // Trigger values are reachable through `vars` too, like `{{velocity}}`;
        // an untouched one does not come back as a local.
        let out = run_code("Math.round((vars.velocity / 127) * 100) + ' percent'", &[], &[]);
        assert_eq!(out.result, "79 percent");
        assert!(out.locals.is_empty());
        // A local or global with the same name wins over the trigger value.
        assert_eq!(run_code("vars.velocity", &[("velocity", "5")], &[]).result, "5");
    }

    #[test]
    fn writes_back_variables() {
        let out = run_code("vars.count = Number(vars.count) + 1; globals.last = 'x'; ({a: 1})", &[("count", "1")], &[("last", "")]);
        assert_eq!(out.locals.get("count").map(String::as_str), Some("2"));
        assert_eq!(out.globals.get("last").map(String::as_str), Some("x"));
        assert_eq!(out.result, r#"{"a":1}"#);
    }

    #[test]
    fn return_inside_a_declared_function_keeps_the_completion_value() {
        let code = "function twice(n) {\n  return n * 2;\n}\n\ntwice(21);";
        assert_eq!(run_code(code, &[], &[]).result, "42");
        // The user's report: a formatter with `return` inside, called as the last expression.
        let code = r#"function formatDateTime(date) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const day = days[date.getDay()];
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} ${hours}:${minutes} ${ampm}`;
}

formatDateTime(new Date(2026, 8, 13, 15, 5));"#;
        assert_eq!(run_code(code, &[], &[]).result, "Sun 3:05 PM");
        // A top-level return still works, and a real syntax error is reported as such.
        assert_eq!(run_code("const x = 2;\nreturn x * 3;", &[], &[]).result, "6");
        let locals = HashMap::new();
        let globals = HashMap::new();
        let builtins = HashMap::new();
        let err = run(ScriptInput { code: "const = ;", locals: &locals, globals: &globals, builtins: &builtins }).unwrap_err();
        assert!(err.contains("SyntaxError"), "{err}");
    }

    #[test]
    fn runaway_loops_are_stopped() {
        let locals = HashMap::new();
        let globals = HashMap::new();
        let builtins = HashMap::new();
        assert!(run(ScriptInput { code: "while (true) {}", locals: &locals, globals: &globals, builtins: &builtins }).is_err());
    }
}
