//! Pictures on buttons, made ready to leave this computer: a look that points
//! at a file becomes an embedded image, and every embedded image is shrunk to
//! what a pad can show, so shared pages stay small and never carry a path
//! that means nothing elsewhere.

use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::{CompressionType, FilterType as PngFilter, PngEncoder};
use image::{DynamicImage, ImageEncoder};

/// Longest side of an embedded picture; pads are drawn far smaller than this.
pub const MAX_SIDE: u32 = 256;
/// Above this many bytes a PNG becomes a JPEG (transparency goes, size stays sane).
const MAX_PNG_BYTES: usize = 300 * 1024;

/// The bytes of a look's image: a `data:` URI decoded, or a file read.
fn load_bytes(uri: &str) -> Result<Vec<u8>, String> {
    if let Some(rest) = uri.strip_prefix("data:") {
        let (_, payload) = rest.split_once(",").ok_or_else(|| "malformed data URI".to_string())?;
        return base64::engine::general_purpose::STANDARD.decode(payload.trim()).or_else(|_| base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(payload.trim())).map_err(|e| format!("image data unreadable: {e}"));
    }
    std::fs::read(uri).map_err(|e| format!("could not read {uri}: {e}"))
}

/// Shrink a picture to at most `MAX_SIDE` on its longest side and embed it as a
/// `data:` URI (PNG, or JPEG when the PNG would be large).
pub fn embed(uri: &str) -> Result<String, String> {
    let bytes = load_bytes(uri)?;
    let decoded = image::load_from_memory(&bytes).map_err(|e| format!("not an image: {e}"))?;
    let small = if decoded.width() > MAX_SIDE || decoded.height() > MAX_SIDE { decoded.resize(MAX_SIDE, MAX_SIDE, image::imageops::FilterType::Lanczos3) } else { decoded };
    let png = encode_png(&small)?;
    if png.len() <= MAX_PNG_BYTES {
        return Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png)));
    }
    let mut out = Vec::new();
    let rgb = small.to_rgb8();
    JpegEncoder::new_with_quality(&mut out, 82).write_image(rgb.as_raw(), rgb.width(), rgb.height(), image::ExtendedColorType::Rgb8).map_err(|e| format!("could not encode the image: {e}"))?;
    Ok(format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(out)))
}

fn encode_png(img: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let rgba = img.to_rgba8();
    PngEncoder::new_with_quality(&mut out, CompressionType::Best, PngFilter::Adaptive)
        .write_image(rgba.as_raw(), rgba.width(), rgba.height(), image::ExtendedColorType::Rgba8)
        .map_err(|e| format!("could not encode the image: {e}"))?;
    Ok(out)
}

/// Walk a page, a button or a profile as JSON and embed every image look in
/// place. The error names the button so the user can fix it.
pub fn embed_looks(value: &mut serde_json::Value) -> Result<(), String> {
    match value {
        serde_json::Value::Object(map) => {
            if map.get("look").is_some() {
                embed_button(map)?;
            }
            for (_, v) in map.iter_mut() {
                if v.is_array() || v.is_object() {
                    embed_looks(v)?;
                }
            }
            Ok(())
        }
        serde_json::Value::Array(items) => items.iter_mut().try_for_each(embed_looks),
        _ => Ok(()),
    }
}

fn embed_button(button: &mut serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    let (x, y) = (button.get("x").and_then(|v| v.as_u64()), button.get("y").and_then(|v| v.as_u64()));
    let Some(serde_json::Value::Object(look)) = button.get_mut("look") else { return Ok(()) };
    if look.get("type").and_then(|t| t.as_str()) != Some("image") {
        return Ok(());
    }
    let uri = look.get("uri").and_then(|u| u.as_str()).unwrap_or("").to_string();
    if uri.trim().is_empty() {
        return Ok(());
    }
    let embedded = embed(&uri).map_err(|e| match (x, y) {
        (Some(x), Some(y)) => format!("The picture of the button at column {}, row {} cannot be shared: {e}", x + 1, y + 1),
        _ => format!("The button's picture cannot be shared: {e}"),
    })?;
    look.insert("uri".into(), serde_json::Value::String(embedded));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_png(w: u32, h: u32) -> Vec<u8> {
        let img = image::RgbaImage::from_fn(w, h, |x, y| image::Rgba([(x % 255) as u8, (y % 255) as u8, 90, 255]));
        let mut out = Vec::new();
        PngEncoder::new(&mut out).write_image(img.as_raw(), w, h, image::ExtendedColorType::Rgba8).unwrap();
        out
    }

    #[test]
    fn embeds_and_shrinks() {
        let big = sample_png(1200, 800);
        let uri = format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(&big));
        let out = embed(&uri).unwrap();
        assert!(out.starts_with("data:image/"));
        let payload = out.split_once(',').unwrap().1;
        let bytes = base64::engine::general_purpose::STANDARD.decode(payload).unwrap();
        let img = image::load_from_memory(&bytes).unwrap();
        assert_eq!(img.width(), MAX_SIDE);
        assert!(img.height() <= MAX_SIDE);
        assert!(bytes.len() < big.len());
    }

    #[test]
    fn walks_pages_and_names_the_button() {
        let dir = std::env::temp_dir().join(format!("lunchpad-images-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("icon.png");
        std::fs::write(&file, sample_png(64, 64)).unwrap();
        let mut page = serde_json::json!({
            "id": "p", "name": "P",
            "buttons": [
                { "x": 2, "y": 3, "look": { "type": "image", "uri": file.to_string_lossy() }, "color": { "mode": "palette", "index": 5 }, "down": [], "up": [] },
                { "x": 0, "y": 0, "look": { "type": "text", "caption": "A", "size": 16, "face": "sans", "color": "#fff" }, "color": { "mode": "palette", "index": 5 }, "down": [], "up": [] }
            ],
            "faders": []
        });
        embed_looks(&mut page).unwrap();
        assert!(page["buttons"][0]["look"]["uri"].as_str().unwrap().starts_with("data:image/png;base64,"));
        assert_eq!(page["buttons"][1]["look"]["caption"], "A");
        let mut missing = serde_json::json!({ "buttons": [{ "x": 1, "y": 1, "look": { "type": "image", "uri": dir.join("gone.png").to_string_lossy() } }] });
        let err = embed_looks(&mut missing).unwrap_err();
        assert!(err.contains("column 2, row 2"), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
