use std::path::Path;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::watch;

const IGNORED_SEGMENTS: [&str; 2] = [".git", "node_modules"];

pub const DEFAULT_DEBOUNCE: Duration = Duration::from_millis(400);

pub fn is_ignored(path: Option<&str>) -> bool {
    let Some(path) = path else {
        return false;
    };

    let segments: Vec<&str> = path.split(['/', '\\']).collect();

    if segments.iter().any(|s| IGNORED_SEGMENTS.contains(s)) {
        return true;
    }

    segments
        .windows(2)
        .any(|pair| pair[0] == ".claude" && pair[1] == "review")
}

pub struct RepoWatcher {
    changes: watch::Receiver<u64>,
    active: bool,
    _watcher: Option<RecommendedWatcher>,
}

impl RepoWatcher {
    pub fn subscribe(&self) -> watch::Receiver<u64> {
        self.changes.clone()
    }

    pub fn active(&self) -> bool {
        self.active
    }
}

pub fn watch_repo(root: &Path, debounce: Duration) -> RepoWatcher {
    let (tx, rx) = watch::channel(0u64);
    let (raw_tx, raw_rx) = mpsc::channel::<()>();

    let watched = root.to_path_buf();
    let root = root.to_path_buf();

    let handler = move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else { return };

        let interesting = event.paths.iter().any(|path| {
            let relative = path.strip_prefix(&root).unwrap_or(path);
            !is_ignored(Some(&relative.to_string_lossy()))
        });

        if interesting {
            let _ = raw_tx.send(());
        }
    };

    let watcher = notify::recommended_watcher(handler)
        .and_then(|mut watcher| {
            watcher.watch(&watched, RecursiveMode::Recursive)?;
            Ok(watcher)
        })
        .ok();

    if watcher.is_some() {
        thread::spawn(move || {
            while raw_rx.recv().is_ok() {
                while raw_rx.recv_timeout(debounce).is_ok() {}
                tx.send_modify(|tick| *tick += 1);
            }
        });
    }

    RepoWatcher {
        changes: rx,
        active: watcher.is_some(),
        _watcher: watcher,
    }
}
