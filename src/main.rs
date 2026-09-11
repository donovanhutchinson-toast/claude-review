use std::net::{IpAddr, Ipv4Addr};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Args, Parser, Subcommand};

use claude_review::git;
use claude_review::install::{commands_dir, install_command, Scope};
use claude_review::open::open_browser;
use claude_review::review::{build_review, BuildOptions};
use claude_review::server::{start_server, ServerOptions};
use claude_review::statics::WebSource;
use claude_review::types::ReviewModel;

const AFTER_HELP: &str = "\
Review, comment, then press Submit review. The review lands in
.claude/review/latest.md, and `/review-feedback` in Claude Code picks it up.";

#[derive(Parser)]
#[command(
    name = "claude-review",
    version,
    about = "Review working-tree changes and hand comments back to Claude",
    after_help = AFTER_HELP,
    args_conflicts_with_subcommands = true
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    #[command(flatten)]
    review: ReviewArgs,
}

#[derive(Subcommand)]
enum Command {
    InstallCommand {
        #[arg(long)]
        project: bool,

        #[arg(long, value_name = "path")]
        cwd: Option<PathBuf>,
    },
}

#[derive(Args)]
struct ReviewArgs {
    #[arg(long, value_name = "rev", default_value = "HEAD")]
    base: String,

    #[arg(long = "no-untracked")]
    no_untracked: bool,

    #[arg(long, value_name = "n", default_value_t = 3)]
    context: u32,

    #[arg(long = "max-bytes", value_name = "n", default_value_t = 1_000_000)]
    max_bytes: u64,

    #[arg(long, value_name = "path")]
    cwd: Option<PathBuf>,

    #[arg(long, value_name = "n", default_value_t = 0)]
    port: u16,

    #[arg(long = "no-open")]
    no_open: bool,

    #[arg(long)]
    summary: bool,

    #[arg(long)]
    json: bool,

    #[arg(long = "web-root", value_name = "path")]
    web_root: Option<PathBuf>,
}

impl ReviewArgs {
    fn build_options(&self) -> BuildOptions {
        let defaults = BuildOptions::default();

        BuildOptions {
            cwd: self.cwd.clone().unwrap_or(defaults.cwd),
            base: self.base.clone(),
            include_untracked: !self.no_untracked,
            context_lines: self.context,
            max_file_bytes: self.max_bytes,
        }
    }
}

fn print_summary(model: &ReviewModel) {
    let short_sha = match &model.base.sha {
        Some(sha) => sha.chars().take(7).collect::<String>(),
        None => "no commits".to_string(),
    };

    if model.files.is_empty() {
        println!("No changes against {} ({short_sha}).", model.base.rev);
        return;
    }

    let named: Vec<(&_, String)> = model
        .files
        .iter()
        .map(|f| {
            let name = match &f.old_path {
                Some(old) => format!("{old} -> {}", f.path),
                None => f.path.clone(),
            };
            (f, name)
        })
        .collect();

    let width = named.iter().map(|(_, name)| name.len()).max().unwrap_or(0);

    for (file, name) in &named {
        let counts = match file.skipped {
            Some(reason) => format!("({})", reason.as_str()),
            None => format!("+{} -{}", file.additions, file.deletions),
        };
        println!("  {}  {name:width$}  {counts}", file.status.label());
    }

    let totals = &model.totals;
    let skipped = if totals.skipped > 0 {
        format!(", {} skipped", totals.skipped)
    } else {
        String::new()
    };

    println!(
        "\n{} file{} changed, +{} -{}{skipped} against {} ({short_sha}).",
        totals.files,
        if totals.files == 1 { "" } else { "s" },
        totals.additions,
        totals.deletions,
        model.base.rev,
    );
}

fn run_install(project: bool, cwd: Option<PathBuf>) -> anyhow::Result<()> {
    let scope = if project { Scope::Project } else { Scope::User };

    let repo_root = match scope {
        Scope::Project => {
            let cwd = cwd.unwrap_or(std::env::current_dir()?);
            PathBuf::from(git::repo_root(&cwd)?)
        }
        Scope::User => PathBuf::new(),
    };

    let dir = commands_dir(scope, &repo_root)?;
    let (destination, outcome) = install_command(&dir)?;

    println!("{} {}", outcome.describe(), destination.display());
    println!("Run /review-feedback in Claude Code after submitting a review.");

    Ok(())
}

async fn wait_for_shutdown() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};

        let mut term = match signal(SignalKind::terminate()) {
            Ok(term) => term,
            Err(_) => {
                let _ = tokio::signal::ctrl_c().await;
                return;
            }
        };

        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = term.recv() => {}
        }
    }

    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

async fn run(cli: Cli) -> anyhow::Result<()> {
    if let Some(Command::InstallCommand { project, cwd }) = cli.command {
        return run_install(project, cwd);
    }

    let args = cli.review;
    let build = args.build_options();

    if args.summary || args.json {
        let model = build_review(&build)?;

        if args.summary {
            print_summary(&model);
        } else {
            println!("{}", serde_json::to_string_pretty(&model)?);
        }

        return Ok(());
    }

    let web = match &args.web_root {
        Some(dir) => WebSource::Directory(dir.clone()),
        None => WebSource::Embedded,
    };

    let server = start_server(ServerOptions {
        build,
        host: IpAddr::V4(Ipv4Addr::LOCALHOST),
        port: args.port,
        web,
    })
    .await?;

    println!("claude-review listening on {}", server.url);
    println!("Press Ctrl+C to stop.");

    if !args.no_open {
        open_browser(&server.url);
    }

    wait_for_shutdown().await;
    server.close().await;

    Ok(())
}

#[tokio::main]
async fn main() -> ExitCode {
    let cli = Cli::parse();

    match run(cli).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("claude-review: {err}");
            ExitCode::FAILURE
        }
    }
}
