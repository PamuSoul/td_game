// ============================================
// 常數設定 - 遊戲核心參數
// ============================================

/** 每格像素大小 */
const TILE = 64;

/** 地圖欄數 */
const COLS = 15;

/** 地圖列數（不含 UI 區域） */
const ROWS = 9;

/** 底部 UI 面板高度 */
const UI_HEIGHT = 80;

/** 遊戲畫面寬度 */
const GAME_WIDTH = COLS * TILE;

/** 遊戲畫面高度（含 UI） */
const GAME_HEIGHT = ROWS * TILE + UI_HEIGHT;

/** 最大波數，撐過即獲勝 */
const MAX_WAVES = 20;

// ── 路徑航點 ──
const PATH_WAYPOINTS = [
    { col: 0,  row: 1 },
    { col: 3,  row: 1 },
    { col: 3,  row: 4 },
    { col: 7,  row: 4 },
    { col: 7,  row: 1 },
    { col: 11, row: 1 },
    { col: 11, row: 7 },
    { col: 14, row: 7 },
];

// ── 防禦塔類型設定 ──
const TOWER_TYPES = {
    arrow: {
        name: '箭塔',
        cost: 50,
        range: 160,
        damage: 12,
        fireRate: 700,
        color: 0x2d8a4e,        // 主色：森林綠
        colorLight: 0x4caf50,   // 亮色
        colorDark: 0x1b5e20,    // 暗色
        projColor: 0xffeb3b,    // 投射物：亮黃
        projTrail: 0xfff9c4,    // 拖尾色
    },
    cannon: {
        name: '砲塔',
        cost: 100,
        range: 130,
        damage: 40,
        fireRate: 1400,
        color: 0x616161,
        colorLight: 0x9e9e9e,
        colorDark: 0x424242,
        projColor: 0xff5722,
        projTrail: 0xffccbc,
    },
    ice: {
        name: '冰塔',
        cost: 75,
        range: 150,
        damage: 8,
        fireRate: 900,
        color: 0x1565c0,
        colorLight: 0x42a5f5,
        colorDark: 0x0d47a1,
        projColor: 0x4fc3f7,
        projTrail: 0xb3e5fc,
    },
};

// ── 配色主題 ──
const COLORS = {
    // 地面
    grassBase: [0x4a7c59, 0x3d6b4e, 0x557c45, 0x436e3d],  // 草地色（隨機選用）
    grassAccent: [0x5a8f5c, 0x6b9e5a, 0x4e8848],            // 草地點綴
    pathBase: 0x9e8b6e,         // 路徑主色：沙土
    pathDark: 0x7d6f57,         // 路徑暗色
    pathEdge: 0x6d5f47,         // 路徑邊緣
    buildable: 0x3e6b45,        // 可建造區
    buildableEdge: 0x4e8b55,    // 可建造邊框

    // 敵人
    enemyNormal: 0xd32f2f,
    enemyNormalDark: 0xb71c1c,
    enemyBoss: 0x880e4f,
    enemyBossDark: 0x6a0038,
    enemyBossGlow: 0xff4081,

    // UI
    uiBg: 0x1a1a2e,
    uiPanel: 0x252540,
    uiBorder: 0x3a3a5c,
    uiGold: '#ffd54f',
    uiLives: '#ef5350',
    uiWave: '#90caf9',
};
