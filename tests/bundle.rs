use claude_review::statics::{embedded_paths, WebSource};

const MAX_BUNDLE_FILES: usize = 90;

fn bundle() -> WebSource {
    WebSource::Embedded
}

#[test]
fn the_bundle_is_present() {
    assert!(!embedded_paths().is_empty());
    assert!(bundle().has_shell());
}

#[test]
fn the_shell_references_assets_that_exist() {
    let shell = bundle().read("index.html").expect("index.html");
    let html = String::from_utf8(shell.body).expect("utf-8 shell");

    let referenced: Vec<&str> = html
        .split(['"', '\''])
        .filter(|token| token.starts_with("/assets/"))
        .collect();

    assert!(
        referenced.len() >= 2,
        "expected a script and a stylesheet, got {referenced:?}"
    );

    for path in referenced {
        assert!(
            bundle().read(path).is_some(),
            "the shell references {path}, which is not in the bundle"
        );
    }
}

#[test]
fn the_entry_chunk_is_javascript_and_not_empty() {
    let entry = bundle().read("/assets/index.js").expect("assets/index.js");

    assert!(entry.content_type.contains("javascript"));
    assert!(entry.body.len() > 1000, "entry chunk looks truncated");
}

#[test]
fn grammars_the_cli_can_ask_for_are_bundled() {
    for language in ["rust", "typescript", "python", "markdown"] {
        let path = format!("/assets/{language}.js");
        assert!(bundle().read(&path).is_some(), "no grammar for {language}");
    }
}

#[test]
fn nothing_unreachable_is_bundled() {
    let paths = embedded_paths();

    for unreachable in [
        "assets/wolfram.js",
        "assets/emacs-lisp.js",
        "assets/abap.js",
        "assets/dracula.js",
        "assets/nord.js",
        "assets/monokai.js",
    ] {
        assert!(
            !paths.iter().any(|p| p == unreachable),
            "{unreachable} is bundled but nothing can ask for it"
        );
    }
}

#[test]
fn the_bundle_stays_roughly_the_size_it_should_be() {
    let count = embedded_paths().len();

    assert!(
        count < MAX_BUNDLE_FILES,
        "the bundle grew to {count} files; check web/src/languages.ts and web/src/highlight.ts"
    );
}
