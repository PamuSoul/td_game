// ============================================
// 常數設定 - 遊戲核心參數
// ============================================

/** 格子寬度 */
const TILE_W = 64;
/** 格子高度（矮於寬，營造 2.5D 俯視感） */
const TILE_H = 48;

/** 前牆高度（最底排可見的深度） */
const FRONT_H = 12;

const COLS = 15;
const ROWS = 12;
const UI_HEIGHT = 80;

const GAME_WIDTH = COLS * TILE_W;
/** 地圖高度（含最底排前牆） */
const PLAYFIELD_H = ROWS * TILE_H + FRONT_H;
const GAME_HEIGHT = PLAYFIELD_H + UI_HEIGHT;

const MAX_WAVES = 20;

// ── 路徑航點 ──
const PATH_WAYPOINTS = [
    { col: 0,  row: 1 },
    { col: 3,  row: 1 },
    { col: 3,  row: 5 },
    { col: 7,  row: 5 },
    { col: 7,  row: 1 },
    { col: 11, row: 1 },
    { col: 11, row: 10 },
    { col: 14, row: 10 },
];

// ── 防禦塔類型 ──
const TOWER_TYPES = {
    arrow: {
        name: '箭塔', cost: 50, range: 160, damage: 12, fireRate: 700,
        color: 0x2d8a4e, colorLight: 0x4caf50, colorDark: 0x1b5e20,
        projColor: 0xffeb3b, projTrail: 0xfff9c4,
    },
    cannon: {
        name: '砲塔', cost: 100, range: 130, damage: 40, fireRate: 1400,
        color: 0x616161, colorLight: 0x9e9e9e, colorDark: 0x424242,
        projColor: 0xff5722, projTrail: 0xffccbc,
    },
    ice: {
        name: '冰塔', cost: 75, range: 150, damage: 8, fireRate: 900,
        color: 0x1565c0, colorLight: 0x42a5f5, colorDark: 0x0d47a1,
        projColor: 0x4fc3f7, projTrail: 0xb3e5fc,
    },
};

// ── 配色 ──
const COLORS = {
    grassTop:   [0x5a9060, 0x4e8455, 0x5f8c4a, 0x528a50],
    grassFront: [0x3a6038, 0x345832, 0x3c5e30, 0x385a35],

    pathTop:    0xc4b494,
    pathFront:  0x8a7a60,

    buildTop:   0x508a58,
    buildFront: 0x3a6a3e,

    enemyNormal: 0xd32f2f, enemyNormalDark: 0xb71c1c,
    enemyBoss: 0x880e4f, enemyBossDark: 0x6a0038, enemyBossGlow: 0xff4081,

    uiGold: '#ffd54f', uiLives: '#ef5350', uiWave: '#90caf9',
};
