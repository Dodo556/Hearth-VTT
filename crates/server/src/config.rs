use anyhow::{Context, bail};
use directories::ProjectDirs;
use std::{net::SocketAddr, path::PathBuf};

#[derive(Clone)]
pub struct Config {
    pub bind: SocketAddr,
    pub data_dir: PathBuf,
    pub web_dir: PathBuf,
    pub origins: Vec<String>,
    pub secure_cookie: bool,
    pub allow_lan: bool,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let bind = std::env::var("HEARTH_BIND")
            .unwrap_or_else(|_| "127.0.0.1:8787".into())
            .parse()?;
        let data_dir = match std::env::var_os("HEARTH_DATA_DIR") {
            Some(path) => PathBuf::from(path),
            None => ProjectDirs::from("local", "Hearth", "Hearth VTT")
                .context("Cannot locate user data directory; set HEARTH_DATA_DIR")?
                .data_local_dir()
                .into(),
        };
        let origins = std::env::var("HEARTH_ORIGINS")
            .unwrap_or_else(|_| "http://127.0.0.1:8787,http://localhost:8787,http://127.0.0.1:5173,http://localhost:5173".into())
            .split(',').map(|s| s.trim().to_owned()).collect();
        let beside_binary = std::env::current_exe()?
            .parent()
            .context("No executable directory")?
            .join("web");
        let web_dir = std::env::var_os("HEARTH_WEB_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                if beside_binary.is_dir() {
                    beside_binary
                } else {
                    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../apps/web/dist")
                }
            });
        let config = Self {
            bind,
            data_dir,
            web_dir,
            origins,
            secure_cookie: false,
            allow_lan: std::env::var("HEARTH_ALLOW_LAN").as_deref() == Ok("true"),
        };
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        let ip = self.bind.ip();
        if !ip.is_loopback() {
            let private = match ip {
                std::net::IpAddr::V4(ip) => ip.is_private(),
                std::net::IpAddr::V6(ip) => ip.is_unique_local(),
            };
            if !self.allow_lan || !private {
                bail!(
                    "Only loopback or an explicitly opted-in private LAN interface is supported; no public/wildcard listener. Set HEARTH_ALLOW_LAN=true and HEARTH_BIND to a private interface."
                );
            }
        }
        if self.origins.is_empty() {
            bail!("At least one exact HTTP origin is required");
        }
        for origin in &self.origins {
            let url = url::Url::parse(origin)?;
            if url.scheme() != "http"
                || url.host_str().is_none()
                || !url.username().is_empty()
                || url.password().is_some()
                || url.path() != "/"
                || url.query().is_some()
                || url.fragment().is_some()
                || url.origin().ascii_serialization() != *origin
            {
                bail!(
                    "HEARTH_ORIGINS must contain canonical HTTP origins, without paths or trailing slash"
                );
            }
        }
        Ok(())
    }
}
