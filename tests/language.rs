use claude_review::language::{detect_language, language_ids};

#[test]
fn maps_paths_to_grammars() {
    assert_eq!(detect_language("src/main.rs"), Some("rust"));
    assert_eq!(detect_language("web/src/App.tsx"), Some("tsx"));
    assert_eq!(detect_language("a/b/c.YAML"), Some("yaml"));
    assert_eq!(detect_language("Dockerfile"), Some("dockerfile"));
    assert_eq!(detect_language("deep/dir/Makefile"), Some("makefile"));
    assert_eq!(detect_language(".bashrc"), Some("bash"));
}

#[test]
fn declines_paths_it_has_no_grammar_for() {
    assert_eq!(detect_language("LICENSE"), None);
    assert_eq!(detect_language("archive.tar.xz"), None);
    assert_eq!(detect_language(".hidden"), None);
    assert_eq!(detect_language("weird."), None);
}

#[test]
fn language_ids_are_sorted_and_unique() {
    let ids = language_ids();

    let mut sorted = ids.clone();
    sorted.sort_unstable();
    sorted.dedup();

    assert_eq!(ids, sorted);
}

#[test]
fn every_id_is_reachable_from_some_path() {
    let ids = language_ids();

    assert!(ids.contains(&"rust"));
    assert!(ids.contains(&"typescript"));
    assert!(!ids.is_empty());
}

#[test]
fn the_web_bundle_ships_exactly_these_grammars() {
    let source = std::fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("web/src/languages.ts"),
    )
    .expect("read web/src/languages.ts");

    let mut listed_sorted: Vec<&str> = source
        .lines()
        .map(str::trim)
        .filter_map(|line| line.strip_prefix('\''))
        .filter_map(|rest| rest.split('\'').next())
        .collect();

    listed_sorted.sort_unstable();
    listed_sorted.dedup();

    assert_eq!(
        listed_sorted,
        language_ids(),
        "web/src/languages.ts is out of step with src/language.rs"
    );
}
