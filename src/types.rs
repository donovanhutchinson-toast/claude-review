use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

fn is_false(b: &bool) -> bool {
    !*b
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Untracked,
    Unmerged,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SkipReason {
    Binary,
    TooLarge,
    Unmerged,
    Submodule,
}

impl FileStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            FileStatus::Added => "added",
            FileStatus::Modified => "modified",
            FileStatus::Deleted => "deleted",
            FileStatus::Renamed => "renamed",
            FileStatus::Untracked => "untracked",
            FileStatus::Unmerged => "unmerged",
        }
    }

    pub fn label(self) -> char {
        match self {
            FileStatus::Added => 'A',
            FileStatus::Modified => 'M',
            FileStatus::Deleted => 'D',
            FileStatus::Renamed => 'R',
            FileStatus::Untracked => '?',
            FileStatus::Unmerged => 'U',
        }
    }
}

impl SkipReason {
    pub fn as_str(self) -> &'static str {
        match self {
            SkipReason::Binary => "binary",
            SkipReason::TooLarge => "too-large",
            SkipReason::Unmerged => "unmerged",
            SkipReason::Submodule => "submodule",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineType {
    Context,
    Add,
    Delete,
}

impl LineType {
    pub fn as_str(self) -> &'static str {
        match self {
            LineType::Context => "context",
            LineType::Add => "add",
            LineType::Delete => "delete",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    #[serde(rename = "type")]
    pub line_type: LineType,
    pub old_line_no: Option<u32>,
    pub new_line_no: Option<u32>,
    pub content: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub no_newline_at_eof: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Hunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub old_path: Option<String>,
    pub status: FileStatus,
    pub similarity: Option<u32>,
    pub language: Option<String>,
    pub binary: bool,
    pub skipped: Option<SkipReason>,
    pub additions: u32,
    pub deletions: u32,
    pub old_line_count: u32,
    pub new_line_count: u32,
    pub old_size: u64,
    pub new_size: u64,
    pub digest: String,
    pub hunks: Vec<Hunk>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReviewBase {
    pub rev: String,
    pub sha: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Totals {
    pub files: u32,
    pub additions: u32,
    pub deletions: u32,
    pub skipped: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewModel {
    pub version: u32,
    pub repo_root: String,
    pub base: ReviewBase,
    pub generated_at: String,
    pub include_untracked: bool,
    pub context_lines: u32,
    pub files: Vec<FileDiff>,
    pub totals: Totals,
}

impl ReviewModel {
    pub fn file(&self, path: &str) -> Option<&FileDiff> {
        self.files.iter().find(|f| f.path == path)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Old,
    New,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommentTag {
    MustFix,
    Question,
    Nit,
    Idea,
}

pub const COMMENT_TAGS: [CommentTag; 4] = [
    CommentTag::MustFix,
    CommentTag::Question,
    CommentTag::Nit,
    CommentTag::Idea,
];

impl CommentTag {
    pub fn as_str(self) -> &'static str {
        match self {
            CommentTag::MustFix => "must-fix",
            CommentTag::Question => "question",
            CommentTag::Nit => "nit",
            CommentTag::Idea => "idea",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        COMMENT_TAGS.into_iter().find(|t| t.as_str() == value)
    }

    pub fn parse_or_question(value: Option<&str>) -> Self {
        value.and_then(Self::parse).unwrap_or(CommentTag::Question)
    }

    pub fn heading(self) -> &'static str {
        match self {
            CommentTag::MustFix => "Must fix",
            CommentTag::Question => "Questions",
            CommentTag::Nit => "Nits",
            CommentTag::Idea => "Ideas",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentAnchor {
    pub side: Side,
    pub start_line: u32,
    pub end_line: u32,
    pub line_hashes: Vec<String>,
    pub line_texts: Vec<String>,
    pub before_hashes: Vec<String>,
    pub after_hashes: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnchorState {
    Anchored,
    Moved,
    Orphaned,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: String,
    pub path: String,
    pub anchor: Option<CommentAnchor>,
    pub tag: CommentTag,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<AnchorState>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_start_line: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_end_line: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub version: u32,
    pub overall: String,
    pub comments: Vec<Comment>,
    pub viewed: BTreeMap<String, String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReviewPayload {
    pub model: ReviewModel,
    pub draft: Draft,
}
