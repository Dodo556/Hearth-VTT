use super::*;
use sha2::{Digest, Sha256};
use std::{
    fs::OpenOptions,
    io::{Read, Write},
};

pub(super) fn hash_valid(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
pub(super) fn digest(path: &Path) -> Result<(u64, String)> {
    let metadata = std::fs::symlink_metadata(path)?;
    ensure!(
        metadata.is_file() && metadata.len() <= MAX_ARCHIVE_BYTES,
        "Invalid backup file"
    );
    let mut input = File::open(path)?;
    let mut hash = Sha256::new();
    let mut buf = [0u8; 65536];
    let mut size = 0;
    loop {
        let n = input.read(&mut buf)?;
        if n == 0 {
            break;
        }
        size += n as u64;
        ensure!(size <= MAX_ARCHIVE_BYTES, "Backup exceeds limit");
        hash.update(&buf[..n]);
    }
    Ok((size, hex::encode(hash.finalize())))
}
pub(super) fn describe(path: &Path, logical: String) -> Result<Entry> {
    let (byte_size, sha256) = digest(path)?;
    Ok(Entry {
        path: logical,
        byte_size,
        sha256,
    })
}
fn validate(manifest: &Manifest, header_bytes: usize) -> Result<u64> {
    ensure!(
        manifest.format_version == 1 && (10..=SCHEMA_VERSION).contains(&manifest.schema_version),
        "Unsupported backup version"
    );
    ensure!(
        !manifest.app_version.is_empty()
            && manifest.app_version.len() <= 32
            && !manifest.app_version.chars().any(char::is_control),
        "Invalid host version"
    );
    ensure!(
        (0..=253402300799).contains(&manifest.created_at),
        "Invalid creation time"
    );
    ensure!(
        (1..=MAX_FILES).contains(&manifest.files.len()),
        "Invalid file count"
    );
    let mut total = 12u64 + header_bytes as u64;
    let mut previous = "";
    for (n, f) in manifest.files.iter().enumerate() {
        ensure!(
            f.byte_size > 0 && hash_valid(&f.sha256),
            "Invalid file metadata"
        );
        if n == 0 {
            ensure!(
                f.path == "hearth.db" && f.byte_size <= MAX_DATABASE_BYTES,
                "Invalid database entry"
            );
        } else {
            let name = f
                .path
                .strip_prefix("assets/")
                .and_then(|s| s.strip_suffix(".png"))
                .context("Invalid artwork path")?;
            ensure!(
                hash_valid(name) && f.byte_size <= MAX_ASSET_BYTES && previous < f.path.as_str(),
                "Invalid or duplicate artwork entry"
            );
            ensure!(name == f.sha256, "Artwork path/hash mismatch");
            previous = &f.path;
        }
        total = total
            .checked_add(f.byte_size)
            .context("Backup size overflow")?;
        ensure!(total <= MAX_ARCHIVE_BYTES, "Backup exceeds size limit");
    }
    Ok(total)
}
fn transfer(input: &mut File, output: &mut File, entry: &Entry) -> Result<()> {
    let mut left = entry.byte_size;
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    while left > 0 {
        let size = usize::try_from(left.min(buffer.len() as u64))?;
        input.read_exact(&mut buffer[..size])?;
        output.write_all(&buffer[..size])?;
        hash.update(&buffer[..size]);
        left -= size as u64;
    }
    ensure!(
        hex::encode(hash.finalize()) == entry.sha256,
        "Backup checksum mismatch"
    );
    Ok(())
}
pub(super) fn write(
    path: &Path,
    manifest: &Manifest,
    resolve: impl Fn(&str) -> PathBuf,
) -> Result<()> {
    let header = serde_json::to_vec(manifest)?;
    ensure!(header.len() <= MAX_MANIFEST_BYTES, "Manifest exceeds limit");
    validate(manifest, header.len())?;
    let mut output = OpenOptions::new().write(true).create_new(true).open(path)?;
    output.write_all(b"HEARTHB1")?;
    output.write_all(&(header.len() as u32).to_le_bytes())?;
    output.write_all(&header)?;
    for entry in &manifest.files {
        let source = resolve(&entry.path);
        let meta = std::fs::symlink_metadata(&source)?;
        ensure!(
            meta.is_file() && meta.len() == entry.byte_size,
            "Source file changed"
        );
        transfer(&mut File::open(source)?, &mut output, entry)?;
    }
    output.sync_all()?;
    Ok(())
}
pub(super) fn extract(path: &Path, root: &Path) -> Result<Manifest> {
    let mut input = File::open(path)?;
    let mut magic = [0u8; 8];
    input.read_exact(&mut magic)?;
    ensure!(&magic == b"HEARTHB1", "Invalid backup signature");
    let mut size = [0u8; 4];
    input.read_exact(&mut size)?;
    let size = u32::from_le_bytes(size) as usize;
    ensure!(
        size > 0 && size <= MAX_MANIFEST_BYTES,
        "Invalid manifest size"
    );
    let mut header = vec![0; size];
    input.read_exact(&mut header)?;
    let manifest: Manifest = serde_json::from_slice(&header)?;
    let total = validate(&manifest, size)?;
    ensure!(
        input.metadata()?.len() == total,
        "Truncated or trailing backup bytes"
    );
    std::fs::create_dir(root.join("assets"))?;
    for entry in &manifest.files {
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(root.join(&entry.path))?;
        transfer(&mut input, &mut output, entry)?;
        output.sync_all()?;
    }
    Ok(manifest)
}
