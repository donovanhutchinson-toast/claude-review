use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const COMMAND_FILE: &str = "review-feedback.md";

pub const COMMAND_SOURCE: &str = include_str!("../commands/review-feedback.md");

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Created,
    Updated,
    AlreadyCurrent,
}

impl Outcome {
    pub fn describe(self) -> &'static str {
        match self {
            Outcome::Created => "Installed",
            Outcome::Updated => "Updated",
            Outcome::AlreadyCurrent => "Already up to date:",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    User,
    Project,
}

pub fn commands_dir(scope: Scope, repo_root: &Path) -> io::Result<PathBuf> {
    let base = match scope {
        Scope::Project => repo_root.to_path_buf(),
        Scope::User => dirs::home_dir().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "could not find your home directory",
            )
        })?,
    };

    Ok(base.join(".claude").join("commands"))
}

pub fn install_command(dir: &Path) -> io::Result<(PathBuf, Outcome)> {
    let destination = dir.join(COMMAND_FILE);

    if fs::read_to_string(&destination).is_ok_and(|existing| existing == COMMAND_SOURCE) {
        return Ok((destination, Outcome::AlreadyCurrent));
    }

    let outcome = if destination.exists() {
        Outcome::Updated
    } else {
        Outcome::Created
    };

    fs::create_dir_all(dir)?;
    crate::fsutil::write_atomic(&destination, COMMAND_SOURCE)?;

    Ok((destination, outcome))
}
