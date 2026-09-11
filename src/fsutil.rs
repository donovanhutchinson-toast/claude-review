use std::fs;
use std::io;
use std::path::Path;
use std::process;

pub fn write_atomic(target: &Path, contents: &str) -> io::Result<()> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut temp = target.as_os_str().to_os_string();
    temp.push(format!(".{}.tmp", process::id()));
    let temp = Path::new(&temp);

    fs::write(temp, contents)?;
    fs::rename(temp, target)
}
