use hearth_server::{AppState, config::Config, router};
use std::net::SocketAddr;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("hearth_server=info")
        .init();
    let config = Config::from_env()?;
    let bind = config.bind;
    let state = AppState::new(config).await?;
    let listener = tokio::net::TcpListener::bind(bind).await.map_err(|error| {
        anyhow::anyhow!("Cannot bind {bind}: {error}. Another process may be using the port.")
    })?;
    tracing::info!(address = %bind, "Hearth host ready; no external services or telemetry");
    let pool = state.store.pool.clone();
    let shutdown_state = state.clone();
    axum::serve(
        listener,
        router(state).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async move {
        let _ = tokio::signal::ctrl_c().await;
        shutdown_state.shutdown();
    })
    .await?;
    pool.close().await;
    Ok(())
}
