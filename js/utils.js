// ============================================
// 工具函式 - 座標轉換與路徑計算
// ============================================

// ── 邏輯座標（遊戲運算用） ──

/** 格子 → 邏輯像素座標（格子中心） */
function gridToPixel(col, row) {
    return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

/** 兩點距離 */
function dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// ── 等角投影座標轉換 ──

/** 格子座標 → 螢幕座標（菱形頂點位置） */
function gridToScreen(col, row) {
    return {
        x: (col - row) * (ISO_W / 2) + ISO_OX,
        y: (col + row) * (ISO_H / 2) + ISO_OY,
    };
}

/** 格子中心 → 螢幕座標 */
function gridCenterToScreen(col, row) {
    return gridToScreen(col + 0.5, row + 0.5);
}

/** 螢幕座標 → 格子座標（取整） */
function screenToGrid(sx, sy) {
    const x = sx - ISO_OX;
    const y = sy - ISO_OY;
    const fc = (x / (ISO_W / 2) + y / (ISO_H / 2)) / 2;
    const fr = (y / (ISO_H / 2) - x / (ISO_W / 2)) / 2;
    return { col: Math.floor(fc), row: Math.floor(fr) };
}

/** 邏輯像素座標 → 螢幕座標 */
function logicalToScreen(lx, ly) {
    return gridToScreen(lx / TILE, ly / TILE);
}

// ── 等角菱形繪製 ──

/** 繪製菱形頂面 */
function drawDiamond(gfx, cx, cy, w, h, color, alpha) {
    gfx.fillStyle(color, alpha || 1);
    gfx.fillPoints([
        { x: cx, y: cy - h / 2 },
        { x: cx + w / 2, y: cy },
        { x: cx, y: cy + h / 2 },
        { x: cx - w / 2, y: cy },
    ], true);
}

/** 繪製菱形左側面（3D 厚度） */
function drawDiamondLeft(gfx, cx, cy, w, h, depth, color) {
    gfx.fillStyle(color);
    gfx.fillPoints([
        { x: cx - w / 2, y: cy },
        { x: cx, y: cy + h / 2 },
        { x: cx, y: cy + h / 2 + depth },
        { x: cx - w / 2, y: cy + depth },
    ], true);
}

/** 繪製菱形右側面（3D 厚度） */
function drawDiamondRight(gfx, cx, cy, w, h, depth, color) {
    gfx.fillStyle(color);
    gfx.fillPoints([
        { x: cx + w / 2, y: cy },
        { x: cx, y: cy + h / 2 },
        { x: cx, y: cy + h / 2 + depth },
        { x: cx + w / 2, y: cy + depth },
    ], true);
}

/** 繪製完整 3D 菱形格子（頂面 + 左側 + 右側） */
function drawIsoTile(gfx, cx, cy, topColor, leftColor, rightColor, depth) {
    depth = depth || ISO_DEPTH;
    drawDiamondLeft(gfx, cx, cy, ISO_W, ISO_H, depth, leftColor);
    drawDiamondRight(gfx, cx, cy, ISO_W, ISO_H, depth, rightColor);
    drawDiamond(gfx, cx, cy, ISO_W, ISO_H, topColor);
}

/** 繪製菱形描邊 */
function strokeDiamond(gfx, cx, cy, w, h, color, alpha, lineWidth) {
    gfx.lineStyle(lineWidth || 1, color, alpha || 1);
    gfx.strokePoints([
        { x: cx, y: cy - h / 2 },
        { x: cx + w / 2, y: cy },
        { x: cx, y: cy + h / 2 },
        { x: cx - w / 2, y: cy },
    ], true);
}

// ── 路徑計算 ──

/** 根據航點計算路徑經過的所有格子 */
function computePathTiles(waypoints) {
    const tiles = new Set();
    for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i], b = waypoints[i + 1];
        const dc = Math.sign(b.col - a.col);
        const dr = Math.sign(b.row - a.row);
        let c = a.col, r = a.row;
        while (c !== b.col || r !== b.row) {
            tiles.add(`${c},${r}`);
            c += dc;
            r += dr;
        }
        tiles.add(`${b.col},${b.row}`);
    }
    return tiles;
}
