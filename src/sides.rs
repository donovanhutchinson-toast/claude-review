use std::fs;
use std::path::Path;

use crate::anchor::split_lines;
use crate::git;
use crate::types::{FileDiff, FileStatus, Side};

#[derive(Debug, Clone, Default)]
pub struct FileSides {
    pub old: Vec<String>,
    pub new: Vec<String>,
}

fn read_working_text(root: &Path, path: &str) -> Option<String> {
    let abs = root.join(path);
    let meta = fs::symlink_metadata(&abs).ok()?;

    if meta.file_type().is_symlink() {
        return fs::read_link(&abs)
            .ok()
            .map(|t| t.to_string_lossy().into_owned());
    }
    if !meta.is_file() {
        return None;
    }

    fs::read(&abs)
        .ok()
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
}

pub fn read_sides(root: &Path, rev: Option<&str>, file: &FileDiff) -> FileSides {
    if file.skipped.is_some() {
        return FileSides::default();
    }

    let base_path = file.old_path.as_deref().unwrap_or(&file.path);
    let tracked_before = file.status != FileStatus::Untracked && file.status != FileStatus::Added;

    let old_buf = match rev {
        Some(rev) if tracked_before => git::read_blob(root, rev, base_path),
        _ => None,
    };

    FileSides {
        old: old_buf
            .map(|b| split_lines(&String::from_utf8_lossy(&b)))
            .unwrap_or_default(),
        new: read_working_text(root, &file.path)
            .map(|t| split_lines(&t))
            .unwrap_or_default(),
    }
}

pub fn side_lines(sides: &FileSides, side: Side) -> &[String] {
    match side {
        Side::Old => &sides.old,
        Side::New => &sides.new,
    }
}
