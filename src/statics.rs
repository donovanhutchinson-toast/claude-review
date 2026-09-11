use std::fs;
use std::path::{Path, PathBuf};

use percent_encoding::percent_decode_str;
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "$OUT_DIR/web/"]
struct WebAssets;

#[derive(Debug, Clone)]
pub struct StaticFile {
    pub body: Vec<u8>,
    pub content_type: &'static str,
}

fn content_type_for(path: &str) -> &'static str {
    let ext = path
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "css" => "text/css; charset=utf-8",
        "html" => "text/html; charset=utf-8",
        "ico" => "image/x-icon",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" | "map" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

pub fn safe_relative(url_path: &str) -> Option<String> {
    let decoded = percent_decode_str(url_path).decode_utf8().ok()?;
    let trimmed = decoded.trim_start_matches(['/', '\\']);

    let mut parts: Vec<&str> = Vec::new();
    for segment in trimmed.split(['/', '\\']) {
        match segment {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            other => parts.push(other),
        }
    }

    if parts.is_empty() {
        return None;
    }

    Some(parts.join("/"))
}

pub fn read_static_fs(root: &Path, url_path: &str) -> Option<StaticFile> {
    let rel = safe_relative(url_path)?;

    let root = fs::canonicalize(root).ok()?;
    let resolved = fs::canonicalize(root.join(&rel)).ok()?;

    if !resolved.starts_with(&root) {
        return None;
    }

    if !fs::metadata(&resolved).ok()?.is_file() {
        return None;
    }

    Some(StaticFile {
        body: fs::read(&resolved).ok()?,
        content_type: content_type_for(&rel),
    })
}

pub fn embedded_paths() -> Vec<String> {
    WebAssets::iter().map(|path| path.to_string()).collect()
}

#[derive(Debug, Clone)]
pub enum WebSource {
    Embedded,
    Directory(PathBuf),
}

impl WebSource {
    pub fn read(&self, url_path: &str) -> Option<StaticFile> {
        match self {
            WebSource::Directory(dir) => read_static_fs(dir, url_path),
            WebSource::Embedded => {
                let rel = safe_relative(url_path)?;
                let file = WebAssets::get(&rel)?;

                Some(StaticFile {
                    body: file.data.into_owned(),
                    content_type: content_type_for(&rel),
                })
            }
        }
    }

    pub fn has_shell(&self) -> bool {
        self.read("index.html").is_some()
    }
}
