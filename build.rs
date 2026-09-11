use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const SKIP: &str = "CLAUDE_REVIEW_SKIP_UI";

const STUB: &str = "<!doctype html><meta charset=utf-8><title>claude-review</title>\
<p>This binary was built with CLAUDE_REVIEW_SKIP_UI set, so it has no interface. \
Rebuild without it.";

fn watched(web: &Path) {
    for path in [
        "src",
        "index.html",
        "package.json",
        "yarn.lock",
        "vite.config.ts",
        "tsconfig.json",
    ] {
        println!("cargo:rerun-if-changed={}", web.join(path).display());
    }
    println!("cargo:rerun-if-env-changed={SKIP}");
}

fn write_stub(out: &Path) {
    fs::create_dir_all(out).expect("create bundle directory");
    fs::write(out.join("index.html"), STUB).expect("write stub shell");
}

fn main() {
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let web = manifest.join("web");
    let out = PathBuf::from(env::var("OUT_DIR").unwrap()).join("web");

    watched(&web);

    if env::var_os(SKIP).is_some() {
        println!("cargo:warning={SKIP} is set: building without the browser interface");
        write_stub(&out);
        return;
    }

    let vite = web
        .join("node_modules")
        .join(".bin")
        .join(if cfg!(windows) { "vite.cmd" } else { "vite" });

    if !vite.exists() {
        panic!(
            "the browser interface cannot be built: {} is missing.\n\
             Run `yarn --cwd web install`, or set {SKIP}=1 to build without it.",
            vite.display()
        );
    }

    let status = Command::new(&vite)
        .current_dir(&web)
        .arg("build")
        .arg("--outDir")
        .arg(&out)
        .arg("--emptyOutDir")
        .status();

    match status {
        Ok(status) if status.success() => {}
        Ok(status) => panic!("`vite build` failed with {status}"),
        Err(err) => panic!(
            "could not run {}: {err}\n\
             Set {SKIP}=1 to build without the interface.",
            vite.display()
        ),
    }

    if !out.join("index.html").is_file() {
        panic!("`vite build` produced no index.html in {}", out.display());
    }
}
