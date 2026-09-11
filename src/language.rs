const BY_EXTENSION: &[(&str, &str)] = &[
    ("bash", "bash"),
    ("c", "c"),
    ("cc", "cpp"),
    ("cjs", "javascript"),
    ("conf", "ini"),
    ("cpp", "cpp"),
    ("cs", "csharp"),
    ("css", "css"),
    ("cts", "typescript"),
    ("dart", "dart"),
    ("diff", "diff"),
    ("dockerfile", "dockerfile"),
    ("ex", "elixir"),
    ("exs", "elixir"),
    ("fish", "fish"),
    ("go", "go"),
    ("gradle", "groovy"),
    ("graphql", "graphql"),
    ("h", "c"),
    ("hpp", "cpp"),
    ("hs", "haskell"),
    ("htm", "html"),
    ("html", "html"),
    ("ini", "ini"),
    ("java", "java"),
    ("js", "javascript"),
    ("json", "json"),
    ("jsonc", "jsonc"),
    ("jsx", "jsx"),
    ("kt", "kotlin"),
    ("kts", "kotlin"),
    ("less", "less"),
    ("lua", "lua"),
    ("md", "markdown"),
    ("mdx", "mdx"),
    ("mjs", "javascript"),
    ("mts", "typescript"),
    ("patch", "diff"),
    ("php", "php"),
    ("pl", "perl"),
    ("proto", "proto"),
    ("ps1", "powershell"),
    ("py", "python"),
    ("r", "r"),
    ("rb", "ruby"),
    ("rs", "rust"),
    ("sass", "sass"),
    ("scala", "scala"),
    ("scss", "scss"),
    ("sh", "shellscript"),
    ("sql", "sql"),
    ("svelte", "svelte"),
    ("swift", "swift"),
    ("tf", "terraform"),
    ("toml", "toml"),
    ("ts", "typescript"),
    ("tsx", "tsx"),
    ("txt", "plaintext"),
    ("vue", "vue"),
    ("xml", "xml"),
    ("yaml", "yaml"),
    ("yml", "yaml"),
    ("zsh", "bash"),
];

const BY_FILENAME: &[(&str, &str)] = &[
    (".bashrc", "bash"),
    (".gitignore", "ini"),
    (".zshrc", "bash"),
    ("brewfile", "ruby"),
    ("dockerfile", "dockerfile"),
    ("gemfile", "ruby"),
    ("makefile", "makefile"),
    ("rakefile", "ruby"),
];

fn lookup(table: &[(&str, &'static str)], key: &str) -> Option<&'static str> {
    table
        .iter()
        .find(|(candidate, _)| *candidate == key)
        .map(|(_, language)| *language)
}

pub fn detect_language(path: &str) -> Option<&'static str> {
    let base = path.rsplit('/').next().unwrap_or(path).to_lowercase();

    if let Some(language) = lookup(BY_FILENAME, &base) {
        return Some(language);
    }

    let dot = base.rfind('.')?;
    if dot == 0 || dot == base.len() - 1 {
        return None;
    }

    lookup(BY_EXTENSION, &base[dot + 1..])
}

pub fn language_ids() -> Vec<&'static str> {
    let mut ids: Vec<&'static str> = BY_EXTENSION
        .iter()
        .chain(BY_FILENAME.iter())
        .map(|(_, language)| *language)
        .collect();

    ids.sort_unstable();
    ids.dedup();
    ids
}
