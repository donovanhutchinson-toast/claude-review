use claude_review::statics::{read_static_fs, safe_relative, WebSource};
use tempfile::TempDir;

#[test]
fn strips_the_leading_slash_and_normalises_dots() {
    assert_eq!(safe_relative("/index.html").as_deref(), Some("index.html"));
    assert_eq!(
        safe_relative("/assets/./app.js").as_deref(),
        Some("assets/app.js")
    );
    assert_eq!(
        safe_relative("/assets/vendor/../app.js").as_deref(),
        Some("assets/app.js")
    );
    assert_eq!(safe_relative("///a/b").as_deref(), Some("a/b"));
}

#[test]
fn decodes_percent_escapes() {
    assert_eq!(
        safe_relative("/dir%20with%20spaces/a%20b.txt").as_deref(),
        Some("dir with spaces/a b.txt")
    );
}

#[test]
fn refuses_anything_that_climbs_above_the_root() {
    assert!(safe_relative("../etc/passwd").is_none());
    assert!(safe_relative("/../../etc/passwd").is_none());
    assert!(safe_relative("a/../../etc/passwd").is_none());
    assert!(safe_relative("/%2e%2e%2f%2e%2e%2fa.txt").is_none());
}

#[test]
fn refuses_a_path_that_names_nothing() {
    assert!(safe_relative("/").is_none());
    assert!(safe_relative("").is_none());
    assert!(safe_relative("/./").is_none());
}

#[test]
fn handles_windows_separators() {
    assert_eq!(
        safe_relative("\\assets\\app.js").as_deref(),
        Some("assets/app.js")
    );
    assert!(safe_relative("..\\secrets.txt").is_none());
}

#[test]
fn reads_a_file_from_a_directory_and_types_it() {
    let dir = TempDir::with_prefix("claude-review-static-").expect("temp dir");
    std::fs::write(dir.path().join("app.js"), "console.log(1)").expect("write");
    std::fs::create_dir_all(dir.path().join("nested")).expect("mkdir");
    std::fs::write(dir.path().join("nested/style.css"), "body{}").expect("write");

    let js = read_static_fs(dir.path(), "/app.js").expect("app.js");
    assert_eq!(js.body, b"console.log(1)");
    assert!(js.content_type.contains("text/javascript"));

    let css = read_static_fs(dir.path(), "/nested/style.css").expect("style.css");
    assert!(css.content_type.contains("text/css"));

    assert!(read_static_fs(dir.path(), "/missing.js").is_none());
    assert!(read_static_fs(dir.path(), "/nested").is_none());
}

#[test]
fn refuses_to_read_outside_the_directory() {
    let dir = TempDir::with_prefix("claude-review-static-").expect("temp dir");
    std::fs::create_dir_all(dir.path().join("web")).expect("mkdir");
    std::fs::write(dir.path().join("secret.txt"), "no").expect("write");

    let web = dir.path().join("web");

    assert!(read_static_fs(&web, "/../secret.txt").is_none());
    assert!(read_static_fs(&web, "/%2e%2e/secret.txt").is_none());
}

#[test]
fn a_directory_source_reports_whether_it_has_a_shell() {
    let dir = TempDir::with_prefix("claude-review-static-").expect("temp dir");
    let source = WebSource::Directory(dir.path().to_path_buf());

    assert!(!source.has_shell());

    std::fs::write(dir.path().join("index.html"), "<!doctype html>").expect("write");
    assert!(source.has_shell());
}
