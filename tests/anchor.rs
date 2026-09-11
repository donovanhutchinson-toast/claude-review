use claude_review::anchor::{create_anchor, hash_lines, reanchor, split_lines};
use claude_review::types::{AnchorState, CommentAnchor, Side};

fn file() -> Vec<String> {
    ["alpha", "beta", "gamma", "delta", "epsilon"]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

fn owned(ls: &[&str]) -> Vec<String> {
    ls.iter().map(|s| s.to_string()).collect()
}

fn anchor_on(lines: &[String], start: u32, end: u32) -> CommentAnchor {
    create_anchor(Side::New, start, end, lines)
}

#[test]
fn ignores_the_terminator_not_a_genuine_blank_last_line() {
    assert_eq!(split_lines("a\nb\n"), owned(&["a", "b"]));
    assert_eq!(split_lines("a\nb"), owned(&["a", "b"]));
    assert_eq!(split_lines("a\n\n"), owned(&["a", ""]));
    assert!(split_lines("").is_empty());
}

#[test]
fn keeps_a_comment_in_place_when_nothing_moved() {
    let lines = file();
    let result = reanchor(&anchor_on(&lines, 3, 3), &hash_lines(&lines));

    assert_eq!((result.start_line, result.end_line), (3, 3));
    assert_eq!(result.state, AnchorState::Anchored);
}

#[test]
fn follows_its_line_when_lines_are_inserted_above() {
    let lines = file();
    let anchor = anchor_on(&lines, 3, 3);

    let mut edited = owned(&["new one", "new two"]);
    edited.extend(lines);

    let result = reanchor(&anchor, &hash_lines(&edited));

    assert_eq!((result.start_line, result.end_line), (5, 5));
    assert_eq!(result.state, AnchorState::Moved);
}

#[test]
fn follows_its_line_when_lines_are_removed_above() {
    let lines = file();
    let anchor = anchor_on(&lines, 4, 4);
    let edited = lines[2..].to_vec();

    let result = reanchor(&anchor, &hash_lines(&edited));

    assert_eq!((result.start_line, result.end_line), (2, 2));
    assert_eq!(result.state, AnchorState::Moved);
}

#[test]
fn moves_a_multi_line_anchor_as_a_unit() {
    let lines = file();
    let anchor = anchor_on(&lines, 2, 4);

    let mut edited = owned(&["header"]);
    edited.extend(lines);

    let result = reanchor(&anchor, &hash_lines(&edited));

    assert_eq!((result.start_line, result.end_line), (3, 5));
    assert_eq!(result.state, AnchorState::Moved);
}

#[test]
fn orphans_a_comment_whose_line_was_deleted() {
    let lines = file();
    let anchor = anchor_on(&lines, 3, 3);
    let edited: Vec<String> = lines.into_iter().filter(|l| l != "gamma").collect();

    assert_eq!(
        reanchor(&anchor, &hash_lines(&edited)).state,
        AnchorState::Orphaned
    );
}

#[test]
fn orphans_a_comment_whose_line_was_rewritten() {
    let lines = file();
    let anchor = anchor_on(&lines, 3, 3);

    let mut edited = lines.clone();
    edited[2] = "GAMMA".to_string();

    assert_eq!(
        reanchor(&anchor, &hash_lines(&edited)).state,
        AnchorState::Orphaned
    );
}

#[test]
fn reports_the_original_position_when_orphaned() {
    let lines = file();
    let anchor = anchor_on(&lines, 3, 3);
    let result = reanchor(&anchor, &hash_lines(&owned(&["nothing", "matches"])));

    assert_eq!((result.start_line, result.end_line), (3, 3));
    assert_eq!(result.state, AnchorState::Orphaned);
}

#[test]
fn uses_surrounding_context_to_pick_between_identical_lines() {
    let lines = owned(&[
        "fn a() {",
        "  return 1;",
        "}",
        "",
        "fn b() {",
        "  return 1;",
        "}",
    ]);

    let anchor = create_anchor(Side::New, 6, 6, &lines);

    let mut edited = owned(&["// header"]);
    edited.extend(lines);

    let result = reanchor(&anchor, &hash_lines(&edited));

    assert_eq!(result.state, AnchorState::Moved);
    assert_eq!(result.start_line, 7);
}

#[test]
fn falls_back_to_the_nearest_candidate_when_context_cannot_disambiguate() {
    let lines = owned(&["x", "x", "x", "x", "x"]);
    let anchor = create_anchor(Side::New, 4, 4, &lines);

    let result = reanchor(&anchor, &hash_lines(&owned(&["x", "x", "x", "x"])));

    assert_eq!(result.start_line, 4);
}

#[test]
fn treats_an_anchor_with_no_recorded_lines_as_orphaned() {
    let lines = file();
    let anchor = CommentAnchor {
        line_hashes: Vec::new(),
        ..anchor_on(&lines, 1, 1)
    };

    assert_eq!(
        reanchor(&anchor, &hash_lines(&lines)).state,
        AnchorState::Orphaned
    );
}

#[test]
fn records_the_anchored_text_and_its_context() {
    let lines = file();
    let anchor = anchor_on(&lines, 3, 3);

    assert_eq!(anchor.line_texts, owned(&["gamma"]));
    assert_eq!(anchor.before_hashes, hash_lines(&owned(&["alpha", "beta"])));
    assert_eq!(
        anchor.after_hashes,
        hash_lines(&owned(&["delta", "epsilon"]))
    );
}
