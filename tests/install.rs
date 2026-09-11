use claude_review::install::{
    commands_dir, install_command, Outcome, COMMAND_FILE, COMMAND_SOURCE,
};
use tempfile::TempDir;

#[test]
fn installs_the_command_into_a_fresh_directory() {
    let home = TempDir::with_prefix("claude-review-home-").expect("temp dir");
    let dir = home.path().join(".claude/commands");

    let (destination, outcome) = install_command(&dir).expect("install");

    assert_eq!(outcome, Outcome::Created);
    assert!(destination.ends_with(COMMAND_FILE));
    assert_eq!(
        std::fs::read_to_string(&destination).expect("read"),
        COMMAND_SOURCE
    );
}

#[test]
fn re_running_reports_that_nothing_changed() {
    let home = TempDir::with_prefix("claude-review-home-").expect("temp dir");
    let dir = home.path().join(".claude/commands");

    install_command(&dir).expect("first install");
    let (_, outcome) = install_command(&dir).expect("second install");

    assert_eq!(outcome, Outcome::AlreadyCurrent);
}

#[test]
fn replaces_an_older_copy_and_says_it_updated() {
    let home = TempDir::with_prefix("claude-review-home-").expect("temp dir");
    let dir = home.path().join(".claude/commands");

    std::fs::create_dir_all(&dir).expect("mkdir");
    std::fs::write(dir.join(COMMAND_FILE), "# an older version\n").expect("write");

    let (destination, outcome) = install_command(&dir).expect("install");

    assert_eq!(outcome, Outcome::Updated);
    assert_eq!(
        std::fs::read_to_string(&destination).expect("read"),
        COMMAND_SOURCE
    );
}

#[test]
fn leaves_no_temp_files_behind() {
    let home = TempDir::with_prefix("claude-review-home-").expect("temp dir");
    let dir = home.path().join(".claude/commands");

    install_command(&dir).expect("install");

    let names: Vec<String> = std::fs::read_dir(&dir)
        .expect("read dir")
        .map(|e| e.expect("entry").file_name().to_string_lossy().into_owned())
        .collect();

    assert_eq!(names, vec![COMMAND_FILE]);
}

#[test]
fn project_scope_targets_the_repository() {
    let repo = TempDir::with_prefix("claude-review-repo-").expect("temp dir");

    let dir = commands_dir(claude_review::install::Scope::Project, repo.path()).expect("dir");

    assert_eq!(dir, repo.path().join(".claude").join("commands"));
}

#[test]
fn user_scope_targets_the_home_directory() {
    let dir = commands_dir(
        claude_review::install::Scope::User,
        std::path::Path::new("/ignored"),
    )
    .expect("dir");

    let home = dirs::home_dir().expect("home dir");
    assert_eq!(dir, home.join(".claude").join("commands"));
}

#[test]
fn the_embedded_command_looks_like_the_slash_command() {
    assert!(COMMAND_SOURCE.len() > 200);
    assert!(COMMAND_SOURCE.contains("latest.md"));
}
