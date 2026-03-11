// ============================================
// 工具函式 - 座標轉換與繪圖
// ============================================

/** 格子 → 邏輯像素（中心） */
function gridToPixel(col, row) {
    return { x: col * TILE_W + TILE_W / 2, y: row * TILE_H + TILE_H / 2 };
}

/** 格子 → 螢幕座標（格子中心） */
function gridCenterToScreen(col, row) {
    return { x: col * TILE_W + TILE_W / 2, y: row * TILE_H + TILE_H / 2 };
}

/** 螢幕 → 格子 */
function screenToGrid(sx, sy) {
    return { col: Math.floor(sx / TILE_W), row: Math.floor(sy / TILE_H) };
}

/** 兩點距離 */
function dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// ── 2.5D 方塊繪製 ──

/**
 * 頂面填滿整格，前牆往下延伸（被下一排蓋住）。
 */
function drawBlock(gfx, col, row, topColor, frontColor) {
    const x = col * TILE_W;
    const y = row * TILE_H;

    // 前牆（往下延伸，被下一排頂面蓋住）
    gfx.fillStyle(frontColor);
    gfx.fillRect(x, y + TILE_H, TILE_W, FRONT_H);

    // 頂面（填滿整格）
    gfx.fillStyle(topColor);
    gfx.fillRect(x, y, TILE_W, TILE_H);
}

// ── 路徑計算 ──

function computePathTiles(waypoints) {
    const tiles = new Set();
    for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i], b = waypoints[i + 1];
        const dc = Math.sign(b.col - a.col);
        const dr = Math.sign(b.row - a.row);
        let c = a.col, r = a.row;
        while (c !== b.col || r !== b.row) {
            tiles.add(`${c},${r}`);
            c += dc; r += dr;
        }
        tiles.add(`${b.col},${b.row}`);
    }
    return tiles;
}
