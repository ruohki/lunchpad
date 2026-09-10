//! Waveform overview for the sound editor: decode a file and reduce it to a
//! fixed number of peak buckets.

use rodio::{Decoder, Source};
use serde::Serialize;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioInfo {
    pub duration_secs: f32,
    /// Peak amplitude (0..1) per bucket, evenly spread over the file
    pub peaks: Vec<f32>,
}

pub fn analyze(path: &Path, buckets: usize) -> Result<AudioInfo, String> {
    let buckets = buckets.clamp(8, 2000);
    let file = File::open(path).map_err(|e| format!("could not open {}: {e}", path.display()))?;
    let len = file.metadata().map(|m| m.len()).ok();
    let mut builder = Decoder::builder().with_data(BufReader::new(file)).with_seekable(true);
    if let Some(len) = len {
        builder = builder.with_byte_len(len);
    }
    let source = builder.build().map_err(|e| format!("could not decode {}: {e}", path.display()))?;
    let channels = (source.channels() as usize).max(1);
    let sample_rate = (source.sample_rate() as f64).max(1.0);

    let samples: Vec<f32> = source.collect();
    let frames = samples.len() / channels;
    let duration_secs = (frames as f64 / sample_rate) as f32;
    if frames == 0 {
        return Ok(AudioInfo { duration_secs: 0.0, peaks: vec![0.0; buckets] });
    }
    let mut peaks = vec![0.0f32; buckets];
    for (i, chunk) in samples.chunks(channels).enumerate() {
        let bucket = (i * buckets / frames).min(buckets - 1);
        let v = chunk.iter().fold(0.0f32, |m, s| m.max(s.abs()));
        if v > peaks[bucket] {
            peaks[bucket] = v;
        }
    }
    let max = peaks.iter().cloned().fold(0.0f32, f32::max);
    if max > 0.0 {
        for p in peaks.iter_mut() {
            *p /= max;
        }
    }
    Ok(AudioInfo { duration_secs, peaks })
}
