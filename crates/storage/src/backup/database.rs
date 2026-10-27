use super::*;
use image::{ImageFormat, ImageReader};
use sqlx::{SqliteConnection, sqlite::SqliteConnectOptions};

pub(super) struct Asset {
    pub sha: String,
    pub bytes: u64,
    pub width: u32,
    pub height: u32,
}
type SchemaRow = (String, String, String, Option<String>);
async fn schema(conn: &mut SqliteConnection) -> Result<Vec<SchemaRow>> {
    let rows: Vec<SchemaRow> =
        sqlx::query_as("SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name")
            .fetch_all(conn)
            .await?;
    // ANALYZE may add these exact engine-owned tables. Every other schema
    // object, including reserved-looking names, must match the migrations.
    Ok(rows
        .into_iter()
        .filter(|(kind, name, table, sql)| {
            !(kind == "table"
                && name == table
                && matches!(
                    (name.as_str(), sql.as_deref()),
                    (
                        "sqlite_stat1",
                        Some("CREATE TABLE sqlite_stat1(tbl,idx,stat)")
                    ) | (
                        "sqlite_stat4",
                        Some("CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample)")
                    )
                ))
        })
        .collect())
}
pub(super) async fn validate(path: &Path, version: i64) -> Result<(Counts, Vec<Asset>)> {
    let meta = std::fs::symlink_metadata(path)?;
    ensure!(
        meta.is_file() && meta.len() > 0 && meta.len() <= MAX_DATABASE_BYTES,
        "Invalid snapshot database"
    );
    let mut db = SqliteConnection::connect_with(
        &SqliteConnectOptions::new()
            .filename(path)
            .read_only(true)
            .pragma("trusted_schema", "OFF"),
    )
    .await?;
    let result=async {
        let expected=sqlx::sqlite::SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await?;
        ensure!((10..=SCHEMA_VERSION).contains(&version), "Unsupported database version");
        let migrations: Vec<_> = crate::MIGRATOR.iter().filter(|m| m.version <= version).cloned().collect();
        ensure!(migrations.last().is_some_and(|m| m.version == version), "Unsupported database version");
        let migrator = sqlx::migrate::Migrator::with_migrations(migrations);
        migrator.run(&expected).await?;
        let mut expected_connection=expected.acquire().await?;
        let canonical=schema(&mut expected_connection).await?;
        drop(expected_connection);expected.close().await;
        ensure!(schema(&mut db).await?==canonical,"Unsupported database schema");
        let records:Vec<(i64,Vec<u8>,bool)>=sqlx::query_as("SELECT version,checksum,success FROM _sqlx_migrations ORDER BY version").fetch_all(&mut db).await?;
        ensure!(records.len()==migrator.iter().count(),"Unsupported migration history");
        for (row,migration) in records.iter().zip(migrator.iter()) {
            ensure!(row.0==migration.version && row.1.as_slice()==migration.checksum.as_ref() && row.2,"Incompatible migration checksum");
        }
        let check:Vec<String>=sqlx::query_scalar("PRAGMA integrity_check").fetch_all(&mut db).await?;
        ensure!(check==["ok"],"Database integrity failure");
        ensure!(sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut db).await?.is_empty(),"Broken database references");
        let owners:i64=sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_owner=1").fetch_one(&mut db).await?;
        let profiles:i64=sqlx::query_scalar("SELECT COUNT(*) FROM host_profile h JOIN users u ON u.id=h.owner_id WHERE u.is_owner=1").fetch_one(&mut db).await?;
        ensure!(owners==1 && profiles==1,"Backup must contain one coherent host owner");
        let rows:Vec<(String,i64,i64,i64,i64,i64,i64)>=sqlx::query_as("SELECT sha256,MIN(byte_size),MAX(byte_size),MIN(width),MAX(width),MIN(height),MAX(height) FROM assets GROUP BY sha256 ORDER BY sha256 LIMIT 4097").fetch_all(&mut db).await?;
        ensure!(rows.len()<MAX_FILES,"Too many artwork files");
        let mut assets=Vec::with_capacity(rows.len());
        for (sha,bytes,max_bytes,w,max_w,h,max_h) in rows {
            ensure!(format::hash_valid(&sha) && bytes>0 && bytes as u64<=MAX_ASSET_BYTES && bytes==max_bytes && w==max_w && h==max_h && (1..=4096).contains(&w) && (1..=4096).contains(&h),"Invalid artwork reference");
            assets.push(Asset {sha,bytes:bytes as u64,width:w as u32,height:h as u32});
        }
        let mut totals=Vec::new();
        for query in ["SELECT COUNT(*) FROM users","SELECT COUNT(*) FROM campaigns","SELECT COUNT(*) FROM scenes","SELECT COUNT(*) FROM tokens","SELECT COUNT(*) FROM actors","SELECT COUNT(*) FROM journals","SELECT COUNT(*) FROM chat_messages","SELECT COUNT(*) FROM dice_rolls","SELECT COUNT(*) FROM combat_encounters"] {
            let count:i64=sqlx::query_scalar(query).fetch_one(&mut db).await?;totals.push(count as u64);
        }
        Ok((Counts {users:totals[0],campaigns:totals[1],scenes:totals[2],tokens:totals[3],actors:totals[4],journals:totals[5],messages:totals[6],rolls:totals[7],encounters:totals[8],assets:assets.len() as u64},assets))
    }.await;
    db.close().await?;
    result
}
pub(super) fn check_artwork(root: &Path, assets: &[Asset]) -> Result<()> {
    ensure!(
        std::fs::symlink_metadata(root.join("assets"))?
            .file_type()
            .is_dir(),
        "Artwork directory cannot be a link"
    );
    let mut pixels = 0u64;
    for asset in assets {
        pixels += u64::from(asset.width) * u64::from(asset.height);
        ensure!(pixels <= MAX_PIXELS, "Artwork pixel budget exceeded");
        let path = root.join("assets").join(format!("{}.png", asset.sha));
        let meta = std::fs::symlink_metadata(&path)?;
        ensure!(
            meta.is_file() && meta.len() == asset.bytes,
            "Missing or changed artwork"
        );
        let mut reader = ImageReader::open(path)?.with_guessed_format()?;
        ensure!(
            reader.format() == Some(ImageFormat::Png),
            "Artwork must be PNG"
        );
        let mut limits = image::Limits::default();
        limits.max_image_width = Some(4096);
        limits.max_image_height = Some(4096);
        limits.max_alloc = Some(128 * 1024 * 1024);
        reader.limits(limits);
        let image = reader.decode()?;
        ensure!(
            image.width() == asset.width && image.height() == asset.height,
            "Artwork dimensions do not match"
        );
    }
    Ok(())
}
