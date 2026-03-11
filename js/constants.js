// ============================================
// 常數設定 - 遊戲核心參數
// ============================================

// ── 邏輯格子（用於遊戲運算） ──
/** 邏輯格子大小（內部運算用） */
const TILE = 64;

// ── 等角投影（Isometric）渲染參數 ──
/** 等角菱形寬度 */
const ISO_W = 80;
/** 等角菱形高度 */
const ISO_H = 40;
/** 格子側面厚度（3D 效果） */
const ISO_DEPTH = 30;

/** 地圖欄數 */
const COLS = 15;
/** 地圖列數 */
const ROWS = 9;

/** 底部 UI 面板高度 */
const UI_HEIGHT = 80;

// ── 畫面尺寸 ──
const GAME_WIDTH = 960;
/** 地圖區域高度（不含 UI） */
const PLAYFIELD_H = 510;
const GAME_HEIGHT = PLAYFIELD_H + UI_HEIGHT;

/** 等角偏移量（讓地圖置中） */
const ISO_OX = 360;
const ISO_OY = 15;

/** 最大波數 */
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
        color: 0x2d8a4e,
        colorLight: 0x4caf50,
        colorDark: 0x1b5e20,
        projColor: 0xffeb3b,
        projTrail: 0xfff9c4,
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
    grassTop:  [0x5a8c59, 0x4d7b4e, 0x5f8c45, 0x4f7e3d],
    grassLeft: [0x3d6b3a, 0x346032, 0x3f6b2e, 0x365f28],
    grassRight:[0x4a7a48, 0x3f6d3e, 0x4a7a35, 0x3e6c30],

    pathTop:   0xb8a88a,
    pathLeft:  0x8a7a60,
    pathRight: 0x9e8e70,
    pathEdge:  0x6d5f47,

    buildTop:  0x4e8b55,
    buildLeft: 0x3a6b3a,
    buildRight:0x448244,

    enemyNormal: 0xd32f2f,
    enemyNormalDark: 0xb71c1c,
    enemyBoss: 0x880e4f,
    enemyBossDark: 0x6a0038,
    enemyBossGlow: 0xff4081,

    uiBg: 0x1a1a2e,
    uiPanel: 0x252540,
    uiBorder: 0x3a3a5c,
    uiGold: '#ffd54f',
    uiLives: '#ef5350',
    uiWave: '#90caf9',
};
