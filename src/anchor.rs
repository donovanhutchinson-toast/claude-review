use sha1::{Digest, Sha1};

use crate::types::{AnchorState, CommentAnchor, Side};

const CONTEXT: usize = 3;

const MAX_STORED_LINES: usize = 200;
const MAX_STORED_LINE_LENGTH: usize = 500;

pub fn hash_line(line: &str) -> String {
    let digest = Sha1::digest(line.as_bytes());
    hex::encode(digest)[..12].to_string()
}

pub fn hash_lines<S: AsRef<str>>(lines: &[S]) -> Vec<String> {
    lines.iter().map(|l| hash_line(l.as_ref())).collect()
}

pub fn split_lines(text: &str) -> Vec<String> {
    let mut lines: Vec<String> = text.split('\n').map(str::to_string).collect();
    if lines.last().is_some_and(|l| l.is_empty()) {
        lines.pop();
    }
    lines
}

pub fn create_anchor(
    side: Side,
    start_line: u32,
    end_line: u32,
    lines: &[String],
) -> CommentAnchor {
    let first = start_line.saturating_sub(1) as usize;
    let last = end_line.saturating_sub(1) as usize;

    let anchored: &[String] = if first <= last && first < lines.len() {
        &lines[first..(last + 1).min(lines.len())]
    } else {
        &[]
    };

    let line_texts = if anchored.len() > MAX_STORED_LINES {
        Vec::new()
    } else {
        anchored
            .iter()
            .map(|l| l.chars().take(MAX_STORED_LINE_LENGTH).collect())
            .collect()
    };

    let before = &lines[first.saturating_sub(CONTEXT)..first.min(lines.len())];
    let after_start = (last + 1).min(lines.len());
    let after = &lines[after_start..(after_start + CONTEXT).min(lines.len())];

    CommentAnchor {
        side,
        start_line,
        end_line,
        line_hashes: hash_lines(anchored),
        line_texts,
        before_hashes: hash_lines(before),
        after_hashes: hash_lines(after),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Reanchored {
    pub start_line: u32,
    pub end_line: u32,
    pub state: AnchorState,
}

pub fn reanchor(anchor: &CommentAnchor, hashes: &[String]) -> Reanchored {
    let span = anchor.line_hashes.len();

    let unchanged = |state| Reanchored {
        start_line: anchor.start_line,
        end_line: anchor.end_line,
        state,
    };

    if span == 0 {
        return unchanged(AnchorState::Orphaned);
    }

    let matches_at = |i: usize| {
        anchor
            .line_hashes
            .iter()
            .enumerate()
            .all(|(k, h)| hashes.get(i + k) == Some(h))
    };

    let original = anchor.start_line.saturating_sub(1) as usize;
    if original + span <= hashes.len() && matches_at(original) {
        return unchanged(AnchorState::Anchored);
    }

    let mut candidates: Vec<usize> = if span <= hashes.len() {
        (0..=hashes.len() - span)
            .filter(|&i| matches_at(i))
            .collect()
    } else {
        Vec::new()
    };

    if candidates.is_empty() {
        return unchanged(AnchorState::Orphaned);
    }

    if candidates.len() > 1 {
        let context_score = |i: usize| -> usize {
            let before = anchor
                .before_hashes
                .iter()
                .enumerate()
                .filter(|(k, h)| {
                    let idx = i as i64 - anchor.before_hashes.len() as i64 + *k as i64;
                    idx >= 0 && hashes.get(idx as usize) == Some(*h)
                })
                .count();

            let after = anchor
                .after_hashes
                .iter()
                .enumerate()
                .filter(|(k, h)| hashes.get(i + span + k) == Some(*h))
                .count();

            before + after
        };

        let best = candidates
            .iter()
            .map(|&i| context_score(i))
            .max()
            .unwrap_or(0);
        candidates.retain(|&i| context_score(i) == best);
    }

    candidates.sort_by_key(|&i| (i as i64 - original as i64).abs());

    let start_line = candidates[0] as u32 + 1;

    Reanchored {
        start_line,
        end_line: start_line + span as u32 - 1,
        state: AnchorState::Moved,
    }
}
