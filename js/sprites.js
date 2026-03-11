// ============================================
// 像素風格圖像系統
// ============================================

const PX = 4; // 每像素渲染大小

/** 繪製像素圖（以 cx,cy 為中心） */
function drawPixelSprite(gfx, cx, cy, data, pal, px) {
    px = px || PX;
    const rows = data.length, cols = data[0].length;
    const ox = Math.round(cx - (cols * px) / 2);
    const oy = Math.round(cy - (rows * px) / 2);
    for (let r = 0; r < rows; r++) {
        const row = data[r];
        for (let c = 0; c < cols; c++) {
            const ch = row[c];
            if (ch === '.') continue;
            const color = pal[ch];
            if (color == null) continue;
            gfx.fillStyle(color);
            gfx.fillRect(ox + c * px, oy + r * px, px, px);
        }
    }
}

// ── 調色盤 ──

const PAL_ARROW = {
    'a': 0x143d0e, 'b': 0x1b5e20, 'c': 0x2e7d32, 'd': 0x4caf50,
    'e': 0x81c784, 'f': 0xc8e6c9,
    'W': 0x5d4037, 'X': 0x795548, 'Y': 0x8d6e63, 'Z': 0xa1887f,
    'G': 0xffd54f, 'H': 0xffeb3b,
};

const PAL_CANNON = {
    'a': 0x263238, 'b': 0x37474f, 'c': 0x546e7a, 'd': 0x78909c,
    'e': 0xb0bec5, 'f': 0xcfd8dc,
    'W': 0x4e342e, 'X': 0x5d4037, 'Y': 0x6d4c41, 'Z': 0x8d6e63,
    'R': 0xff3d00, 'O': 0xff6e40,
};

const PAL_ICE = {
    'a': 0x0d47a1, 'b': 0x1565c0, 'c': 0x1e88e5, 'd': 0x42a5f5,
    'e': 0x90caf9, 'f': 0xe3f2fd, 'w': 0xffffff,
    'W': 0x455a64, 'X': 0x607d8b, 'Y': 0x78909c, 'Z': 0xb0bec5,
};

const PAL_ENEMY = {
    'a': 0x7f0000, 'b': 0xb71c1c, 'c': 0xd32f2f, 'd': 0xef5350,
    'e': 0xef9a9a, 'f': 0xffcdd2,
    'W': 0xffffff, 'K': 0x212121,
};

const PAL_BOSS = {
    'a': 0x4a0028, 'b': 0x6a0038, 'c': 0x880e4f, 'd': 0xc2185b,
    'e': 0xf48fb1, 'f': 0xfce4ec,
    'W': 0xffffff, 'K': 0x212121, 'R': 0xff1744, 'G': 0xffd600,
};

const PAL_TREE = {
    'a': 0x1b5e20, 'b': 0x2e7d32, 'c': 0x4caf50, 'd': 0x81c784,
    'T': 0x4e342e, 'U': 0x5d4037,
};

const PAL_ROCK = {
    'a': 0x546e7a, 'b': 0x78909c, 'c': 0x90a4ae, 'd': 0xb0bec5,
    'e': 0xcfd8dc,
};

// ── 像素圖資料 ──

const SPR_ARROW_TOWER = [
    "....HG....",
    "...H..G...",
    "....ef....",
    "...defd...",
    "..deffed..",
    "..cdeedc..",
    "..cdeedc..",
    "...cddc...",
    "..YZZZY...",
    "..XYZYX...",
    "..XWYWX...",
    "..XXXXX...",
];

const SPR_CANNON_TOWER = [
    "..aabb....",
    "..abcf....",
    "....bc....",
    "...bcdb...",
    "..bcdecb..",
    "..abcdba..",
    "..abcdba..",
    "...abba...",
    "..YZZZY...",
    "..XYZYX...",
    "..XWYWX...",
    "..XXXXX...",
];

const SPR_ICE_TOWER = [
    "....fw....",
    "...efwe...",
    "..edfwde..",
    "...cddc...",
    "....cd....",
    "...cddc...",
    "..bcddcb..",
    "..abccba..",
    "..YZZZY...",
    "..XYZYX...",
    "..XWYWX...",
    "..XXXXX...",
];

const SPR_ENEMY = [
    "..bbbb..",
    ".bcddcb.",
    ".cWKdWK.",
    ".cddddc.",
    ".cdeedc.",
    ".bcddcb.",
    "..bccb..",
    "..b..b..",
];

const SPR_BOSS = [
    "R........R",
    "Rb......bR",
    ".bccccccb.",
    ".cdfffdc..",
    ".cWKfWKc..",
    ".cdfffdc..",
    ".cdeeeddc.",
    "..cddddc..",
    "..bcddcb..",
    "...bccb...",
    "..bb..bb..",
    "..b....b..",
];

const SPR_TREE = [
    "....dd....",
    "...cddc...",
    "..cddddc..",
    ".bcdddcb..",
    "..bcdcb...",
    "...bcb....",
    "....TU....",
    "....TU....",
];

const SPR_ROCK = [
    "..bcdb..",
    ".bcddcb.",
    ".bcdecb.",
    "..bcdb..",
];

const SPR_FLOWER_R = [
    "..d.",
    ".dcd",
    "..d.",
    "..b.",
    "..b.",
];

const SPR_FLOWER_Y = [
    "..d.",
    ".dcd",
    "..d.",
    "..b.",
    "..b.",
];

const PAL_FLOWER_R = {
    'b': 0x558b2f, 'c': 0xffff00, 'd': 0xff8a80,
};

const PAL_FLOWER_B = {
    'b': 0x558b2f, 'c': 0xffff00, 'd': 0x80d8ff,
};

const PAL_FLOWER_Y = {
    'b': 0x558b2f, 'c': 0xff8f00, 'd': 0xffff8d,
};

const PAL_FLOWER_P = {
    'b': 0x558b2f, 'c': 0xffff00, 'd': 0xb388ff,
};

const FLOWER_PALS = [PAL_FLOWER_R, PAL_FLOWER_B, PAL_FLOWER_Y, PAL_FLOWER_P];
