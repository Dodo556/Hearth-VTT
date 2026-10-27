//! Shared manual exploration. The server owns the mask and token visibility.
use crate::error::{ApiError, ApiResult};
use hearth_domain::{
    Fog,
    commands::{FogMode, TokenCommand},
};
use serde_json::{Value, json};

pub(crate) struct Mask {
    width: i64,
    height: i64,
    grid: i64,
    columns: usize,
    rows: usize,
    enabled: bool,
    bits: Vec<u8>,
}
impl Mask {
    pub(crate) fn new(
        width: i64,
        height: i64,
        grid: i64,
        enabled: bool,
        mut bits: Vec<u8>,
    ) -> ApiResult<Self> {
        if width <= 0 || height <= 0 || grid <= 0 {
            return Err(ApiError::internal());
        }
        let columns = (width - 1) / grid + 1;
        let rows = (height - 1) / grid + 1;
        if columns > 256 || rows > 256 {
            return Err(ApiError::internal());
        }
        let columns = columns as usize;
        let rows = rows as usize;
        let bytes = (columns * rows).div_ceil(8);
        if bits.is_empty() {
            bits.resize(bytes, 0);
        }
        if bits.len() != bytes {
            return Err(ApiError::internal());
        }
        Ok(Self {
            width,
            height,
            grid,
            columns,
            rows,
            enabled,
            bits,
        })
    }
    pub(crate) async fn load(
        conn: &mut sqlx::SqliteConnection,
        campaign: &str,
        scene: &str,
    ) -> ApiResult<Self> {
        let (w,h,g,e,b):(i64,i64,i64,bool,Vec<u8>)=sqlx::query_as("SELECT width,height,grid_size,fog_enabled,fog_bits FROM scenes WHERE campaign_id=? AND id=?").bind(campaign).bind(scene).fetch_optional(conn).await?.ok_or_else(ApiError::hidden)?;
        Self::new(w, h, g, e, b)
    }
    pub(crate) fn dto(&self) -> Fog {
        Fog {
            enabled: self.enabled,
            columns: self.columns,
            rows: self.rows,
            revealed: hex::encode(&self.bits),
        }
    }
    pub(crate) fn visible(&self, x: f64, y: f64, size: f64) -> bool {
        if !self.enabled {
            return true;
        }
        let half = size / 2.0;
        if !x.is_finite()
            || !y.is_finite()
            || !size.is_finite()
            || size <= 0.0
            || x - half < 0.0
            || y - half < 0.0
            || x + half > self.width as f64
            || y + half > self.height as f64
        {
            return false;
        }
        let left = ((x - half) / self.grid as f64).floor() as usize;
        let top = ((y - half) / self.grid as f64).floor() as usize;
        let right = ((x + half) / self.grid as f64).ceil() as usize;
        let bottom = ((y + half) / self.grid as f64).ceil() as usize;
        (top..bottom).all(|r| (left..right).all(|c| self.revealed(r * self.columns + c)))
    }
    pub(crate) fn rectangle_visible(&self, x1: f64, y1: f64, x2: f64, y2: f64) -> bool {
        if !self.enabled {
            return true;
        }
        if ![x1, y1, x2, y2].iter().all(|v| v.is_finite()) {
            return false;
        }
        // Account for the 3-pixel stroke, clipped to the scene edges.
        let left = (x1.min(x2) - 2.0).max(0.0);
        let right = (x1.max(x2) + 2.0).min(self.width as f64);
        let top = (y1.min(y2) - 2.0).max(0.0);
        let bottom = (y1.max(y2) + 2.0).min(self.height as f64);
        if left >= right || top >= bottom {
            return false;
        }
        let col0 = (left / self.grid as f64).floor() as usize;
        let col1 = (right / self.grid as f64).ceil() as usize;
        let row0 = (top / self.grid as f64).floor() as usize;
        let row1 = (bottom / self.grid as f64).ceil() as usize;
        (row0..row1).all(|r| (col0..col1).all(|c| self.revealed(r * self.columns + c)))
    }
    fn revealed(&self, index: usize) -> bool {
        self.bits
            .get(index / 8)
            .is_some_and(|b| b & (1 << (index % 8)) != 0)
    }
    fn set(&mut self, index: usize, reveal: bool) {
        let bit = 1 << (index % 8);
        if reveal {
            self.bits[index / 8] |= bit;
        } else {
            self.bits[index / 8] &= !bit;
        }
    }
}
pub(crate) async fn apply(
    conn: &mut sqlx::SqliteConnection,
    campaign: &str,
    command: &TokenCommand,
) -> ApiResult<Value> {
    let scene = command.token_id();
    let mut mask = Mask::load(conn, campaign, scene).await?;
    match command {
        TokenCommand::FogConfigure(p) => mask.enabled = p.enabled,
        TokenCommand::FogReset(p) => {
            mask.enabled = true;
            mask.bits.fill(0);
            if matches!(p.mode, FogMode::Reveal) {
                for i in 0..mask.columns * mask.rows {
                    mask.set(i, true);
                }
            }
        }
        TokenCommand::FogPaint(p) => {
            if !mask.enabled {
                return Err(ApiError::invalid("Enable manual fog before painting."));
            }
            if p.column < 0
                || p.row < 0
                || p.width <= 0
                || p.height <= 0
                || p.column
                    .checked_add(p.width)
                    .is_none_or(|v| v > mask.columns as i64)
                || p.row
                    .checked_add(p.height)
                    .is_none_or(|v| v > mask.rows as i64)
            {
                return Err(ApiError::invalid("Choose a rectangle inside the fog grid."));
            }
            for r in p.row..p.row + p.height {
                for c in p.column..p.column + p.width {
                    mask.set(
                        r as usize * mask.columns + c as usize,
                        matches!(p.mode, FogMode::Reveal),
                    );
                }
            }
        }
        _ => return Err(ApiError::invalid("Unsupported fog command.")),
    }
    sqlx::query("UPDATE scenes SET fog_enabled=?,fog_bits=? WHERE id=? AND campaign_id=?")
        .bind(mask.enabled)
        .bind(mask.bits)
        .bind(scene)
        .bind(campaign)
        .execute(conn)
        .await?;
    Ok(json!({"projection":"snapshot"}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn maximum_mask_is_bounded_and_footprints_use_exact_cell_edges() {
        let mut m =
            Mask::new(5120, 5120, 20, true, vec![]).unwrap_or_else(|_| panic!("valid max mask"));
        assert_eq!(m.dto().revealed.len(), 16384);
        m.set(0, true);
        assert!(m.visible(10.0, 10.0, 20.0));
        assert!(!m.visible(10.01, 10.0, 20.0));
        assert!(!m.visible(f64::NAN, 10.0, 20.0));
        assert!(Mask::new(5140, 20, 20, true, vec![]).is_err());
        assert!(Mask::new(20, 20, 20, true, vec![0, 0]).is_err());
        assert!(Mask::new(i64::MAX, i64::MAX, 1, true, vec![]).is_err());
    }
}
