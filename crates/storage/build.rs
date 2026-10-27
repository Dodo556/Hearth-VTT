fn main() {
    // SQLx embeds migrations; adding a file must invalidate incremental builds.
    println!("cargo:rerun-if-changed=migrations");
}
