use similar::{ChangeTag, TextDiff};

use crate::types::{DiffLine, Hunk, LineType};

const SNIFF_BYTES: usize = 8000;

pub fn is_binary(buf: &[u8]) -> bool {
    buf.iter().take(SNIFF_BYTES).any(|&b| b == 0)
}

pub fn count_lines(text: &str) -> u32 {
    if text.is_empty() {
        return 0;
    }

    let n = text.split('\n').count() as u32;
    if text.ends_with('\n') {
        n - 1
    } else {
        n
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BuiltDiff {
    pub hunks: Vec<Hunk>,
    pub additions: u32,
    pub deletions: u32,
}

fn split_keeping_terminator(text: &str) -> Vec<&str> {
    text.split_inclusive('\n').collect()
}

pub fn build_diff(old_text: &str, new_text: &str, context: u32) -> BuiltDiff {
    let old_lines = split_keeping_terminator(old_text);
    let new_lines = split_keeping_terminator(new_text);

    let diff = TextDiff::from_slices(&old_lines, &new_lines);

    let mut hunks = Vec::new();
    let mut additions = 0;
    let mut deletions = 0;

    for group in diff.grouped_ops(context as usize) {
        let Some(first) = group.first() else { continue };

        let old_start = first.old_range().start as u32 + 1;
        let new_start = first.new_range().start as u32 + 1;
        let old_count: usize = group.iter().map(|op| op.old_range().len()).sum();
        let new_count: usize = group.iter().map(|op| op.new_range().len()).sum();

        let mut lines = Vec::new();

        for op in &group {
            for change in diff.iter_changes(op) {
                let raw = change.value();
                let content = raw.strip_suffix('\n').unwrap_or(raw).to_string();
                let no_newline_at_eof = !raw.ends_with('\n');

                let line_no = |index: Option<usize>| index.map(|i| i as u32 + 1);

                let line = match change.tag() {
                    ChangeTag::Delete => {
                        deletions += 1;
                        DiffLine {
                            line_type: LineType::Delete,
                            old_line_no: line_no(change.old_index()),
                            new_line_no: None,
                            content,
                            no_newline_at_eof,
                        }
                    }
                    ChangeTag::Insert => {
                        additions += 1;
                        DiffLine {
                            line_type: LineType::Add,
                            old_line_no: None,
                            new_line_no: line_no(change.new_index()),
                            content,
                            no_newline_at_eof,
                        }
                    }
                    ChangeTag::Equal => DiffLine {
                        line_type: LineType::Context,
                        old_line_no: line_no(change.old_index()),
                        new_line_no: line_no(change.new_index()),
                        content,
                        no_newline_at_eof,
                    },
                };

                lines.push(line);
            }
        }

        hunks.push(Hunk {
            old_start,
            old_lines: old_count as u32,
            new_start,
            new_lines: new_count as u32,
            lines,
        });
    }

    BuiltDiff {
        hunks,
        additions,
        deletions,
    }
}
