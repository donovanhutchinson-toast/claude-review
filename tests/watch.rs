use claude_review::watch::is_ignored;

fn ignored(path: &str) -> bool {
    is_ignored(Some(path))
}

#[test]
fn ignores_git_internals_which_every_status_refresh_rewrites() {
    assert!(ignored(".git/index"));
    assert!(ignored(".git/refs/heads/main"));
    assert!(ignored("nested/.git/index"));
}

#[test]
fn ignores_our_own_drafts_and_exports() {
    assert!(ignored(".claude/review/.draft.json"));
    assert!(ignored(".claude/review/latest.md"));
}

#[test]
fn ignores_dependency_directories() {
    assert!(ignored("node_modules/react/index.js"));
}

#[test]
fn does_not_ignore_ordinary_source_files() {
    assert!(!ignored("src/main.rs"));
    assert!(!ignored("README.md"));
}

#[test]
fn does_not_ignore_other_things_under_claude() {
    assert!(!ignored(".claude/commands/review-feedback.md"));
    assert!(!ignored(".claude/settings.json"));
}

#[test]
fn matches_whole_segments_not_substrings() {
    assert!(!ignored("src/.gitignore"));
    assert!(!ignored("src/gitlab/index.ts"));
    assert!(!ignored("my-node_modules-notes.md"));
}

#[test]
fn handles_windows_separators() {
    assert!(ignored(".git\\index"));
    assert!(!ignored("src\\main.rs"));
}

#[test]
fn fires_for_an_unnamed_event_rather_than_silently_dropping_it() {
    assert!(!is_ignored(None));
}
