mod common;

use claude_review::diff::{build_diff, count_lines, is_binary};
use claude_review::types::LineType;
use common::{as_refs, lines, numbered};

#[test]
fn does_not_count_the_terminator_as_a_line() {
    assert_eq!(count_lines(""), 0);
    assert_eq!(count_lines("a\n"), 1);
    assert_eq!(count_lines("a\nb\n"), 2);
    assert_eq!(count_lines("a\nb"), 2);
}

#[test]
fn detects_a_nul_byte() {
    assert!(!is_binary(b"text only"));
    assert!(is_binary(&[0x89, 0x50, 0x00, 0x01]));
}

#[test]
fn numbers_both_sides_of_a_replaced_line() {
    let before = lines(&["one", "two", "three"]);
    let after = lines(&["one", "TWO", "three"]);

    let built = build_diff(&before, &after, 3);

    assert_eq!(built.additions, 1);
    assert_eq!(built.deletions, 1);
    assert_eq!(built.hunks.len(), 1);

    let shape: Vec<(LineType, Option<u32>, Option<u32>, &str)> = built.hunks[0]
        .lines
        .iter()
        .map(|l| {
            (
                l.line_type,
                l.old_line_no,
                l.new_line_no,
                l.content.as_str(),
            )
        })
        .collect();

    assert_eq!(
        shape,
        vec![
            (LineType::Context, Some(1), Some(1), "one"),
            (LineType::Delete, Some(2), None, "two"),
            (LineType::Add, None, Some(2), "TWO"),
            (LineType::Context, Some(3), Some(3), "three"),
        ]
    );
}

#[test]
fn keeps_line_numbers_correct_across_two_hunks() {
    let source = numbered(20, "line");
    let before = lines(&as_refs(&source));
    let after = before
        .replace("line 2\n", "LINE 2\n")
        .replace("line 19\n", "LINE 19\n");

    let built = build_diff(&before, &after, 1);

    assert_eq!(built.hunks.len(), 2);

    let deleted = |hunk: &claude_review::types::Hunk| {
        hunk.lines
            .iter()
            .find(|l| l.line_type == LineType::Delete)
            .and_then(|l| l.old_line_no)
    };
    let added = |hunk: &claude_review::types::Hunk| {
        hunk.lines
            .iter()
            .find(|l| l.line_type == LineType::Add)
            .and_then(|l| l.new_line_no)
    };

    assert_eq!(deleted(&built.hunks[0]), Some(2));
    assert_eq!(deleted(&built.hunks[1]), Some(19));
    assert_eq!(added(&built.hunks[1]), Some(19));
}

#[test]
fn marks_a_missing_trailing_newline_on_the_line_it_belongs_to() {
    let built = build_diff("a\nb\n", "a\nb", 3);

    let flagged: Vec<_> = built.hunks[0]
        .lines
        .iter()
        .filter(|l| l.no_newline_at_eof)
        .collect();

    assert_eq!(flagged.len(), 1);
    assert_eq!(flagged[0].line_type, LineType::Add);
    assert_eq!(flagged[0].content, "b");

    assert!(!built.hunks[0]
        .lines
        .iter()
        .any(|l| l.content.starts_with("No newline")));
}

#[test]
fn flags_a_missing_trailing_newline_on_the_base_side_too() {
    let built = build_diff("a\nb", "a\nb\n", 3);

    let flagged: Vec<_> = built.hunks[0]
        .lines
        .iter()
        .filter(|l| l.no_newline_at_eof)
        .collect();

    assert_eq!(flagged.len(), 1);
    assert_eq!(flagged[0].line_type, LineType::Delete);
}

#[test]
fn produces_no_hunks_for_identical_text() {
    assert!(build_diff("same\n", "same\n", 3).hunks.is_empty());
}

#[test]
fn treats_a_new_file_as_all_additions() {
    let built = build_diff("", &lines(&["a", "b"]), 3);

    assert_eq!((built.additions, built.deletions), (2, 0));

    let numbers: Vec<Option<u32>> = built.hunks[0].lines.iter().map(|l| l.new_line_no).collect();

    assert_eq!(numbers, vec![Some(1), Some(2)]);
}

#[test]
fn numbers_the_hunk_header_the_way_unified_diff_does() {
    let built = build_diff("", &lines(&["a", "b"]), 3);
    let hunk = &built.hunks[0];

    assert_eq!(
        (
            hunk.old_start,
            hunk.old_lines,
            hunk.new_start,
            hunk.new_lines
        ),
        (1, 0, 1, 2)
    );

    let source = numbered(20, "l");
    let before = lines(&as_refs(&source));
    let after = before.replace("l 10\n", "CHANGED\n");
    let mid = &build_diff(&before, &after, 3).hunks[0];

    assert_eq!(
        (mid.old_start, mid.old_lines, mid.new_start, mid.new_lines),
        (7, 7, 7, 7)
    );
}
