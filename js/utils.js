// ============================================
// 工具函式 - 座標轉換與路徑計算
// ============================================

/**
 * 格子座標轉換為像素座標（格子中心點）
 * @param {number} col - 欄位索引
 * @param {number} row - 列索引
 * @returns {{ x: number, y: number }} 像素座標
 */
function gridToPixel(col, row) {
    return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

/**
 * 像素座標轉換為格子座標
 * @param {number} x - 像素 X
 * @param {number} y - 像素 Y
 * @returns {{ col: number, row: number }} 格子座標
 */
function pixelToGrid(x, y) {
    return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
}

/**
 * 計算兩點之間的距離
 */
function dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 根據航點陣列，計算路徑經過的所有格子
 * 航點之間只能是水平或垂直線段
 * @param {Array} waypoints - 航點陣列 [{ col, row }, ...]
 * @returns {Set<string>} 路徑格子集合，格式 "col,row"
 */
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
