// ============================================
// 主遊戲場景 - 核心遊戲邏輯
// ============================================

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    // ── 場景初始化 ──────────────────────────
    create() {
        // 玩家狀態
        this.gold = 200;
        this.lives = 20;
        this.waveNumber = 0;
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.selectedTowerType = null;
        this.waveActive = false;
        this.spawnQueue = [];
        this.spawnTimer = 0;
        this.enemiesAlive = 0;

        // 用於隨機裝飾的種子（每局固定）
        this.decoSeed = 12345;

        // 建構地圖
        this.buildGrid();
        this.drawGrid();
        this.drawDecorations();
        this.createUI();
        this.setupInput();

        // 建塔預覽
        this.previewGfx = this.add.graphics().setDepth(5);
    }

    /** 簡易偽隨機（確保裝飾每局一致） */
    seededRandom() {
        this.decoSeed = (this.decoSeed * 16807 + 0) % 2147483647;
        return (this.decoSeed & 0x7fffffff) / 2147483647;
    }

    // ── 地圖格子建構 ────────────────────────

    buildGrid() {
        this.pathTiles = computePathTiles(PATH_WAYPOINTS);
        this.grid = [];

        for (let c = 0; c < COLS; c++) {
            this.grid[c] = [];
            for (let r = 0; r < ROWS; r++) {
                this.grid[c][r] = this.pathTiles.has(`${c},${r}`) ? 'path' : 'empty';
            }
        }

        this.pathTiles.forEach(key => {
            const [c, r] = key.split(',').map(Number);
            for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nc = c + dc, nr = r + dr;
                if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && this.grid[nc][nr] === 'empty') {
                    this.grid[nc][nr] = 'buildable';
                }
            }
        });
    }

    /** 繪製美化地圖 */
    drawGrid() {
        const gfx = this.add.graphics().setDepth(0);

        // ── 繪製所有格子 ──
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                const x = c * TILE, y = r * TILE;
                const type = this.grid[c][r];

                if (type === 'path') {
                    this.drawPathTile(gfx, c, r, x, y);
                } else if (type === 'buildable') {
                    this.drawBuildableTile(gfx, c, r, x, y);
                } else {
                    this.drawGrassTile(gfx, c, r, x, y);
                }
            }
        }

        // ── 路徑邊緣加深（路徑與草地交界處） ──
        const edgeGfx = this.add.graphics().setDepth(0);
        this.pathTiles.forEach(key => {
            const [c, r] = key.split(',').map(Number);
            const x = c * TILE, y = r * TILE;
            edgeGfx.lineStyle(2, COLORS.pathEdge, 0.6);

            // 檢查四個方向，非路徑處畫邊緣線
            if (!this.pathTiles.has(`${c},${r - 1}`)) edgeGfx.lineBetween(x, y, x + TILE, y);
            if (!this.pathTiles.has(`${c},${r + 1}`)) edgeGfx.lineBetween(x, y + TILE, x + TILE, y + TILE);
            if (!this.pathTiles.has(`${c - 1},${r}`)) edgeGfx.lineBetween(x, y, x, y + TILE);
            if (!this.pathTiles.has(`${c + 1},${r}`)) edgeGfx.lineBetween(x + TILE, y, x + TILE, y + TILE);
        });

        // ── 入口與出口標記 ──
        this.drawPortal(PATH_WAYPOINTS[0].col, PATH_WAYPOINTS[0].row, '入口', 0x4caf50);
        this.drawPortal(PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].col, PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].row, '出口', 0xef5350);
    }

    /** 繪製草地格子（帶顏色變化） */
    drawGrassTile(gfx, c, r, x, y) {
        const colorIdx = ((c * 7 + r * 13) % COLORS.grassBase.length);
        gfx.fillStyle(COLORS.grassBase[colorIdx]);
        gfx.fillRect(x, y, TILE, TILE);

        // 淡淡的格線
        gfx.lineStyle(1, 0x2a5a35, 0.2);
        gfx.strokeRect(x, y, TILE, TILE);

        // 隨機草地紋理點
        const accent = COLORS.grassAccent[(c + r) % COLORS.grassAccent.length];
        gfx.fillStyle(accent, 0.3);
        const sr = this.seededRandom;
        for (let i = 0; i < 3; i++) {
            const dx = 8 + this.seededRandom() * (TILE - 16);
            const dy = 8 + this.seededRandom() * (TILE - 16);
            gfx.fillCircle(x + dx, y + dy, 1 + this.seededRandom() * 2);
        }
    }

    /** 繪製路徑格子（沙土質感） */
    drawPathTile(gfx, c, r, x, y) {
        // 底色
        gfx.fillStyle(COLORS.pathBase);
        gfx.fillRect(x, y, TILE, TILE);

        // 沙土紋理
        gfx.fillStyle(COLORS.pathDark, 0.3);
        for (let i = 0; i < 6; i++) {
            const dx = 4 + this.seededRandom() * (TILE - 8);
            const dy = 4 + this.seededRandom() * (TILE - 8);
            const s = 1 + this.seededRandom() * 2;
            gfx.fillRect(x + dx, y + dy, s, s);
        }

        // 淡色高光點
        gfx.fillStyle(0xc4b491, 0.25);
        for (let i = 0; i < 3; i++) {
            const dx = 8 + this.seededRandom() * (TILE - 16);
            const dy = 8 + this.seededRandom() * (TILE - 16);
            gfx.fillCircle(x + dx, y + dy, 1);
        }
    }

    /** 繪製可建造格子（草地 + 高亮邊框） */
    drawBuildableTile(gfx, c, r, x, y) {
        gfx.fillStyle(COLORS.buildable);
        gfx.fillRect(x, y, TILE, TILE);

        // 內部虛線邊框提示可建造
        gfx.lineStyle(1, COLORS.buildableEdge, 0.35);
        gfx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);

        // 角落小標記
        const m = 6;
        gfx.lineStyle(2, COLORS.buildableEdge, 0.3);
        // 左上
        gfx.lineBetween(x + m, y + m, x + m + 8, y + m);
        gfx.lineBetween(x + m, y + m, x + m, y + m + 8);
        // 右上
        gfx.lineBetween(x + TILE - m, y + m, x + TILE - m - 8, y + m);
        gfx.lineBetween(x + TILE - m, y + m, x + TILE - m, y + m + 8);
        // 左下
        gfx.lineBetween(x + m, y + TILE - m, x + m + 8, y + TILE - m);
        gfx.lineBetween(x + m, y + TILE - m, x + m, y + TILE - m - 8);
        // 右下
        gfx.lineBetween(x + TILE - m, y + TILE - m, x + TILE - m - 8, y + TILE - m);
        gfx.lineBetween(x + TILE - m, y + TILE - m, x + TILE - m, y + TILE - m - 8);
    }

    /** 繪製入口/出口標記 */
    drawPortal(col, row, label, color) {
        const pos = gridToPixel(col, row);
        const g = this.add.graphics().setDepth(1);

        // 光暈
        g.fillStyle(color, 0.15);
        g.fillCircle(pos.x, pos.y, 28);
        g.fillStyle(color, 0.08);
        g.fillCircle(pos.x, pos.y, 36);

        // 箭頭標記
        g.lineStyle(2, color, 0.8);
        g.strokeCircle(pos.x, pos.y, 20);

        // 文字標籤
        const txt = this.add.text(pos.x, pos.y - 26, label, {
            fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
            backgroundColor: color === 0x4caf50 ? '#2e7d32' : '#c62828',
            padding: { x: 6, y: 2 },
        }).setOrigin(0.5).setDepth(6);

        // 浮動動畫
        this.tweens.add({
            targets: txt, y: txt.y - 4, duration: 1500,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    /** 繪製地圖裝飾（小樹、石頭、花） */
    drawDecorations() {
        const decoGfx = this.add.graphics().setDepth(0);

        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (this.grid[c][r] !== 'empty') continue;
                const rand = this.seededRandom();

                if (rand < 0.12) {
                    // 小樹
                    this.drawTree(decoGfx, c * TILE + TILE / 2, r * TILE + TILE / 2);
                } else if (rand < 0.20) {
                    // 石頭
                    this.drawRock(decoGfx, c * TILE + TILE / 2, r * TILE + TILE / 2);
                } else if (rand < 0.28) {
                    // 小花
                    this.drawFlower(decoGfx, c * TILE + 16 + this.seededRandom() * 32, r * TILE + 16 + this.seededRandom() * 32);
                }
            }
        }
    }

    drawTree(gfx, x, y) {
        // 樹幹
        gfx.fillStyle(0x5d4037);
        gfx.fillRect(x - 3, y + 2, 6, 14);
        // 樹冠（三層）
        gfx.fillStyle(0x2e7d32, 0.9);
        gfx.fillTriangle(x, y - 16, x - 14, y + 4, x + 14, y + 4);
        gfx.fillStyle(0x388e3c, 0.9);
        gfx.fillTriangle(x, y - 22, x - 11, y - 4, x + 11, y - 4);
        gfx.fillStyle(0x43a047, 0.8);
        gfx.fillTriangle(x, y - 26, x - 8, y - 12, x + 8, y - 12);
    }

    drawRock(gfx, x, y) {
        gfx.fillStyle(0x757575, 0.7);
        gfx.fillEllipse(x, y + 4, 16, 10);
        gfx.fillStyle(0x9e9e9e, 0.5);
        gfx.fillEllipse(x - 2, y + 2, 10, 7);
    }

    drawFlower(gfx, x, y) {
        const colors = [0xff8a80, 0xffff8d, 0x80d8ff, 0xb388ff, 0xffd180];
        const fc = colors[Math.floor(this.seededRandom() * colors.length)];
        // 花莖
        gfx.lineStyle(1, 0x558b2f, 0.6);
        gfx.lineBetween(x, y, x, y + 8);
        // 花朵
        gfx.fillStyle(fc, 0.7);
        gfx.fillCircle(x, y, 3);
        gfx.fillStyle(0xffff00, 0.8);
        gfx.fillCircle(x, y, 1.5);
    }

    // ── 使用者介面 ──────────────────────────

    createUI() {
        const uiY = ROWS * TILE;

        // UI 背景（漸層效果）
        const uiBg = this.add.graphics().setDepth(10);
        for (let i = 0; i < UI_HEIGHT; i++) {
            const t = i / UI_HEIGHT;
            const r = Math.floor(0x1a + (0x25 - 0x1a) * t);
            const g = Math.floor(0x1a + (0x25 - 0x1a) * t);
            const b = Math.floor(0x2e + (0x40 - 0x2e) * t);
            uiBg.fillStyle((r << 16) | (g << 8) | b);
            uiBg.fillRect(0, uiY + i, GAME_WIDTH, 1);
        }
        // 頂部高亮線
        uiBg.lineStyle(1, 0x5a5a8a, 0.6);
        uiBg.lineBetween(0, uiY, GAME_WIDTH, uiY);
        uiBg.lineStyle(1, 0x3a3a5c, 0.3);
        uiBg.lineBetween(0, uiY + 1, GAME_WIDTH, uiY + 1);

        // ── 資源面板 ──
        const panelGfx = this.add.graphics().setDepth(10);
        panelGfx.fillStyle(0x1e1e36, 0.8);
        panelGfx.fillRoundedRect(8, uiY + 6, 200, 68, 6);
        panelGfx.lineStyle(1, 0x3a3a5c, 0.5);
        panelGfx.strokeRoundedRect(8, uiY + 6, 200, 68, 6);

        this.goldText = this.add.text(24, uiY + 12, '', {
            fontSize: '17px', fontFamily: 'Arial', color: COLORS.uiGold, fontStyle: 'bold',
        }).setDepth(11);
        this.livesText = this.add.text(24, uiY + 34, '', {
            fontSize: '17px', fontFamily: 'Arial', color: COLORS.uiLives, fontStyle: 'bold',
        }).setDepth(11);
        this.waveText = this.add.text(24, uiY + 55, '', {
            fontSize: '13px', fontFamily: 'Arial', color: COLORS.uiWave,
        }).setDepth(11);

        // ── 防禦塔選擇按鈕 ──
        this.towerButtons = [];
        this.towerBtnBgs = [];
        const types = ['arrow', 'cannon', 'ice'];
        const icons = ['🏹', '💣', '❄️'];
        let bx = 230;

        types.forEach((type, i) => {
            const cfg = TOWER_TYPES[type];

            // 按鈕背景
            const btnBg = this.add.graphics().setDepth(10);
            btnBg.fillStyle(0x2a2a4a, 0.9);
            btnBg.fillRoundedRect(bx, uiY + 6, 120, 68, 6);
            btnBg.lineStyle(1, 0x4a4a6a, 0.5);
            btnBg.strokeRoundedRect(bx, uiY + 6, 120, 68, 6);

            // 塔色彩小方塊
            const colorDot = this.add.graphics().setDepth(11);
            colorDot.fillStyle(cfg.color);
            colorDot.fillRoundedRect(bx + 8, uiY + 12, 8, 8, 2);

            const btn = this.add.text(bx + 60, uiY + 26, `${icons[i]} ${cfg.name}`, {
                fontSize: '16px', color: '#e0e0e0', fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(11);

            const costText = this.add.text(bx + 60, uiY + 50, `$ ${cfg.cost}`, {
                fontSize: '13px', color: '#aaaaaa',
            }).setOrigin(0.5).setDepth(11);

            // 互動區域
            const hitArea = this.add.rectangle(bx + 60, uiY + 40, 120, 68).setInteractive({ useHandCursor: true });
            hitArea.setAlpha(0.001).setDepth(12);
            hitArea.towerType = type;

            hitArea.on('pointerdown', (pointer) => {
                pointer.event.stopPropagation();
                this.selectTower(type);
            });

            this.towerButtons.push({ hitArea, btn, costText, type, bg: btnBg, colorDot });
            bx += 132;
        });

        // ── 下一波按鈕 ──
        this.nextWaveBg = this.add.graphics().setDepth(10);
        this.drawNextWaveBtn(0xc62828, 0xe53935);

        const nextWaveText = this.add.text(GAME_WIDTH - 95, uiY + 40, '下 一 波', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(11);

        const nextWaveHit = this.add.rectangle(GAME_WIDTH - 95, uiY + 40, 140, 60)
            .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(12);

        nextWaveHit.on('pointerdown', (pointer) => {
            pointer.event.stopPropagation();
            if (!this.waveActive) this.startWave();
        });
        this.nextWaveHit = nextWaveHit;
        this.nextWaveText = nextWaveText;

        // ── 訊息提示 ──
        this.msgText = this.add.text(GAME_WIDTH / 2, ROWS * TILE - 30, '', {
            fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
            backgroundColor: '#1a1a2ecc',
            padding: { x: 16, y: 6 },
        }).setOrigin(0.5).setDepth(15).setAlpha(0);

        this.updateUI();
    }

    drawNextWaveBtn(dark, light) {
        const uiY = ROWS * TILE;
        this.nextWaveBg.clear();
        this.nextWaveBg.fillStyle(dark);
        this.nextWaveBg.fillRoundedRect(GAME_WIDTH - 166, uiY + 10, 142, 60, 8);
        this.nextWaveBg.fillStyle(light);
        this.nextWaveBg.fillRoundedRect(GAME_WIDTH - 164, uiY + 10, 138, 54, 7);
    }

    showMessage(text, duration = 1500) {
        this.msgText.setText(text).setAlpha(1);
        this.tweens.add({
            targets: this.msgText, alpha: 0, duration: 400,
            delay: duration - 400,
        });
    }

    selectTower(type) {
        this.selectedTowerType = (this.selectedTowerType === type) ? null : type;
        this.updateTowerButtons();
    }

    updateTowerButtons() {
        this.towerButtons.forEach(({ bg, type, btn, costText, colorDot }) => {
            const cfg = TOWER_TYPES[type];
            const uiY = ROWS * TILE;
            const bx = bg.x || 0;
            bg.clear();

            if (type === this.selectedTowerType) {
                // 選中狀態
                bg.fillStyle(0x1b5e20, 0.9);
                bg.fillRoundedRect(btn.x - 60, uiY + 4, 120, 70, 6);
                bg.lineStyle(2, 0x4caf50, 0.8);
                bg.strokeRoundedRect(btn.x - 60, uiY + 4, 120, 70, 6);
                btn.setColor('#ffffff');
                costText.setColor('#a5d6a7');
            } else if (this.gold < cfg.cost) {
                // 不可用
                bg.fillStyle(0x1a1a2e, 0.6);
                bg.fillRoundedRect(btn.x - 60, uiY + 6, 120, 68, 6);
                bg.lineStyle(1, 0x333355, 0.3);
                bg.strokeRoundedRect(btn.x - 60, uiY + 6, 120, 68, 6);
                btn.setColor('#666666');
                costText.setColor('#664444');
            } else {
                // 一般狀態
                bg.fillStyle(0x2a2a4a, 0.9);
                bg.fillRoundedRect(btn.x - 60, uiY + 6, 120, 68, 6);
                bg.lineStyle(1, 0x4a4a6a, 0.5);
                bg.strokeRoundedRect(btn.x - 60, uiY + 6, 120, 68, 6);
                btn.setColor('#e0e0e0');
                costText.setColor('#aaaaaa');
            }
        });
    }

    updateUI() {
        this.goldText.setText(`💰 ${this.gold}`);
        this.livesText.setText(`❤️ ${this.lives}`);
        this.waveText.setText(`波數 ${this.waveNumber} / ${MAX_WAVES}`);

        if (this.waveActive) {
            this.drawNextWaveBtn(0x424242, 0x616161);
            this.nextWaveText.setColor('#999999');
        } else {
            this.drawNextWaveBtn(0xc62828, 0xe53935);
            this.nextWaveText.setColor('#ffffff');
        }

        this.updateTowerButtons();
    }

    // ── 輸入處理 ────────────────────────────

    setupInput() {
        this.input.on('pointerdown', (pointer) => {
            if (pointer.y >= ROWS * TILE) return;
            if (!this.selectedTowerType) return;
            const { col, row } = pixelToGrid(pointer.x, pointer.y);
            if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
            this.placeTower(col, row, this.selectedTowerType);
        });

        this.input.on('pointermove', (pointer) => {
            this.previewGfx.clear();
            if (!this.selectedTowerType || pointer.y >= ROWS * TILE) return;
            const { col, row } = pixelToGrid(pointer.x, pointer.y);
            if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

            const cfg = TOWER_TYPES[this.selectedTowerType];
            const pos = gridToPixel(col, row);
            const valid = this.grid[col][row] === 'buildable';
            const canAfford = this.gold >= cfg.cost;

            // 範圍圈
            if (valid) {
                this.previewGfx.lineStyle(2, canAfford ? 0x4caf50 : 0xef5350, 0.3);
                this.previewGfx.strokeCircle(pos.x, pos.y, cfg.range);
                this.previewGfx.fillStyle(canAfford ? 0x4caf50 : 0xef5350, 0.15);
                this.previewGfx.fillCircle(pos.x, pos.y, cfg.range);

                // 塔預覽
                this.previewGfx.fillStyle(cfg.color, canAfford ? 0.6 : 0.3);
                this.previewGfx.fillRoundedRect(col * TILE + 6, row * TILE + 6, TILE - 12, TILE - 12, 4);
                this.previewGfx.lineStyle(1, canAfford ? 0xffffff : 0xff0000, 0.5);
                this.previewGfx.strokeRoundedRect(col * TILE + 6, row * TILE + 6, TILE - 12, TILE - 12, 4);
            }
        });
    }

    // ── 建塔系統 ────────────────────────────

    placeTower(col, row, type) {
        if (this.grid[col][row] !== 'buildable') {
            this.showMessage('無法在此建造！', 800);
            return;
        }
        const cfg = TOWER_TYPES[type];
        if (this.gold < cfg.cost) {
            this.showMessage('金幣不足！', 800);
            return;
        }

        this.gold -= cfg.cost;
        this.grid[col][row] = 'tower';

        const pos = gridToPixel(col, row);
        const tower = {
            type, col, row, x: pos.x, y: pos.y,
            lastFired: 0,
            range: cfg.range, damage: cfg.damage, fireRate: cfg.fireRate,
        };

        // 繪製精緻塔身
        const gfx = this.add.graphics().setDepth(1);

        // 底座陰影
        gfx.fillStyle(0x000000, 0.2);
        gfx.fillEllipse(2, 12, TILE - 16, 14);

        // 底座平台
        gfx.fillStyle(cfg.colorDark);
        gfx.fillRoundedRect(-TILE / 2 + 8, -TILE / 2 + 10, TILE - 16, TILE - 16, 4);
        gfx.fillStyle(cfg.color);
        gfx.fillRoundedRect(-TILE / 2 + 8, -TILE / 2 + 8, TILE - 16, TILE - 18, 4);

        // 高光邊緣
        gfx.lineStyle(1, cfg.colorLight, 0.5);
        gfx.strokeRoundedRect(-TILE / 2 + 8, -TILE / 2 + 8, TILE - 16, TILE - 18, 4);

        // 塔的特色圖形
        if (type === 'arrow') {
            // 箭塔：弓形圖案
            gfx.fillStyle(0x81c784);
            gfx.fillCircle(0, -2, 12);
            gfx.fillStyle(0x66bb6a);
            gfx.fillCircle(0, -2, 8);
            gfx.lineStyle(2, 0xc8e6c9, 0.8);
            gfx.lineBetween(0, -10, 0, 6);
            gfx.lineBetween(-2, -8, 0, -12);
            gfx.lineBetween(2, -8, 0, -12);
        } else if (type === 'cannon') {
            // 砲塔：砲管
            gfx.fillStyle(0xbdbdbd);
            gfx.fillRect(-5, -14, 10, 12);
            gfx.fillStyle(0x9e9e9e);
            gfx.fillRect(-7, -4, 14, 8);
            gfx.fillStyle(0x757575);
            gfx.fillCircle(0, 0, 6);
            gfx.lineStyle(1, 0xe0e0e0, 0.5);
            gfx.strokeCircle(0, 0, 6);
        } else if (type === 'ice') {
            // 冰塔：冰晶
            gfx.fillStyle(0x90caf9, 0.8);
            gfx.fillTriangle(0, -14, -10, 4, 10, 4);
            gfx.fillStyle(0x64b5f6, 0.9);
            gfx.fillTriangle(0, 8, -8, -4, 8, -4);
            gfx.lineStyle(1, 0xe3f2fd, 0.6);
            gfx.lineBetween(0, -14, 0, 8);
            gfx.lineBetween(-10, -2, 10, -2);
        }

        gfx.setPosition(pos.x, pos.y);
        tower.graphics = gfx;
        this.towers.push(tower);
        this.updateUI();

        // 建造動畫（從小放大 + 閃光）
        gfx.setScale(0.3).setAlpha(0.5);
        this.tweens.add({
            targets: gfx, scaleX: 1, scaleY: 1, alpha: 1,
            duration: 250, ease: 'Back.easeOut',
        });

        // 光環特效
        const ring = this.add.graphics().setDepth(4).setPosition(pos.x, pos.y);
        ring.lineStyle(2, cfg.colorLight, 0.6);
        ring.strokeCircle(0, 0, 10);
        this.tweens.add({
            targets: ring, scaleX: 3, scaleY: 3, alpha: 0,
            duration: 400, onComplete: () => ring.destroy(),
        });
    }

    // ── 波次系統 ────────────────────────────

    startWave() {
        if (this.waveActive) return;
        this.waveNumber++;
        this.waveActive = true;
        this.updateUI();

        const isBossWave = this.waveNumber % 5 === 0;
        const count = isBossWave
            ? 3 + Math.floor(this.waveNumber / 5)
            : 5 + this.waveNumber * 2;

        this.spawnQueue = [];
        for (let i = 0; i < count; i++) {
            const hp = isBossWave ? (30 + this.waveNumber * 15) * 5 : 30 + this.waveNumber * 15;
            const speed = isBossWave
                ? Math.min(120, 60 + this.waveNumber * 3)
                : Math.min(160, 80 + this.waveNumber * 5);
            const reward = isBossWave ? (10 + this.waveNumber * 2) * 3 : 10 + this.waveNumber * 2;
            this.spawnQueue.push({ hp, maxHp: hp, speed, reward, isBoss: isBossWave });
        }

        this.spawnTimer = 0;
        this.showMessage(`— 第 ${this.waveNumber} 波 —${isBossWave ? '  ⚠️ BOSS 來襲！' : ''}`, 2000);
    }

    // ── 敵人系統 ────────────────────────────

    spawnEnemy(data) {
        const start = gridToPixel(PATH_WAYPOINTS[0].col, PATH_WAYPOINTS[0].row);
        const enemy = {
            ...data,
            x: start.x, y: start.y,
            waypointIndex: 1,
            slowTimer: 0,
            alive: true,
        };

        const container = this.add.container(start.x, start.y).setDepth(2);
        const radius = data.isBoss ? 20 : 13;

        // 陰影
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillEllipse(2, radius - 2, radius * 1.6, radius * 0.6);
        container.add(shadow);

        // 敵人本體
        const body = this.add.graphics();
        if (data.isBoss) {
            // BOSS：外發光 + 多層
            body.fillStyle(COLORS.enemyBossGlow, 0.15);
            body.fillCircle(0, 0, radius + 6);
            body.fillStyle(COLORS.enemyBossDark);
            body.fillCircle(0, 0, radius);
            body.fillStyle(COLORS.enemyBoss);
            body.fillCircle(0, -2, radius - 3);
            body.lineStyle(2, 0xff80ab, 0.8);
            body.strokeCircle(0, 0, radius);
            // BOSS 眼睛
            body.fillStyle(0xffffff);
            body.fillCircle(-5, -3, 3);
            body.fillCircle(5, -3, 3);
            body.fillStyle(0xff0000);
            body.fillCircle(-5, -3, 1.5);
            body.fillCircle(5, -3, 1.5);
        } else {
            // 一般敵人：漸層效果
            body.fillStyle(COLORS.enemyNormalDark);
            body.fillCircle(0, 0, radius);
            body.fillStyle(COLORS.enemyNormal);
            body.fillCircle(0, -1.5, radius - 2);
            // 高光
            body.fillStyle(0xef9a9a, 0.4);
            body.fillCircle(-3, -4, 4);
            // 小眼睛
            body.fillStyle(0xffffff);
            body.fillCircle(-3, -2, 2);
            body.fillCircle(3, -2, 2);
            body.fillStyle(0x333333);
            body.fillCircle(-3, -2, 1);
            body.fillCircle(3, -2, 1);
        }
        container.add(body);

        // 血量條背景（帶圓角）
        const hpBg = this.add.graphics();
        hpBg.fillStyle(0x000000, 0.5);
        hpBg.fillRoundedRect(-18, -radius - 12, 36, 6, 3);
        container.add(hpBg);

        // 血量條
        const hpBar = this.add.graphics();
        hpBar.fillStyle(0x4caf50);
        hpBar.fillRoundedRect(-17, -radius - 11, 34, 4, 2);
        container.add(hpBar);

        enemy.container = container;
        enemy.hpBar = hpBar;
        enemy.hpBarRadius = radius;

        // 出場動畫
        container.setScale(0.2).setAlpha(0);
        this.tweens.add({
            targets: container, scaleX: 1, scaleY: 1, alpha: 1,
            duration: 200, ease: 'Back.easeOut',
        });

        this.enemies.push(enemy);
        this.enemiesAlive++;
    }

    updateEnemy(enemy, delta) {
        if (!enemy.alive) return;

        if (enemy.waypointIndex >= PATH_WAYPOINTS.length) {
            this.enemyReachedEnd(enemy);
            return;
        }

        const target = PATH_WAYPOINTS[enemy.waypointIndex];
        const tx = target.col * TILE + TILE / 2;
        const ty = target.row * TILE + TILE / 2;
        const dx = tx - enemy.x, dy = ty - enemy.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        const effectiveSpeed = enemy.slowTimer > 0 ? enemy.speed * 0.4 : enemy.speed;
        const move = effectiveSpeed * (delta / 1000);

        if (d <= move) {
            enemy.x = tx;
            enemy.y = ty;
            enemy.waypointIndex++;
        } else {
            enemy.x += (dx / d) * move;
            enemy.y += (dy / d) * move;
        }

        if (enemy.slowTimer > 0) enemy.slowTimer -= delta;

        enemy.container.setPosition(enemy.x, enemy.y);
    }

    damageEnemy(enemy, damage, type) {
        enemy.hp -= damage;

        if (type === 'ice') {
            enemy.slowTimer = 2000;
            // 冰凍效果：變藍 + 冰花粒子
            const bodyGfx = enemy.container.list[1];
            bodyGfx.clear();
            const radius = enemy.isBoss ? 20 : 13;
            bodyGfx.fillStyle(0x4fc3f7, 0.3);
            bodyGfx.fillCircle(0, 0, radius + 4);
            bodyGfx.fillStyle(0x81d4fa);
            bodyGfx.fillCircle(0, 0, radius);
            bodyGfx.fillStyle(0xb3e5fc, 0.5);
            bodyGfx.fillCircle(-2, -3, radius * 0.4);
            bodyGfx.lineStyle(1, 0xe1f5fe, 0.6);
            bodyGfx.strokeCircle(0, 0, radius);

            this.time.delayedCall(400, () => {
                if (!enemy.alive) return;
                this.redrawEnemyBody(enemy);
            });
        }

        // 受擊閃爍
        enemy.container.setAlpha(0.6);
        this.time.delayedCall(80, () => {
            if (enemy.alive) enemy.container.setAlpha(1);
        });

        // 更新血量條
        enemy.hpBar.clear();
        const ratio = Math.max(0, enemy.hp / enemy.maxHp);
        const color = ratio > 0.6 ? 0x4caf50 : ratio > 0.3 ? 0xffa726 : 0xef5350;
        enemy.hpBar.fillStyle(color);
        enemy.hpBar.fillRoundedRect(-17, -enemy.hpBarRadius - 11, 34 * ratio, 4, 2);

        if (enemy.hp <= 0) this.killEnemy(enemy);
    }

    /** 重繪敵人外觀（解除冰凍後） */
    redrawEnemyBody(enemy) {
        const bodyGfx = enemy.container.list[1];
        bodyGfx.clear();
        const radius = enemy.isBoss ? 20 : 13;

        if (enemy.isBoss) {
            bodyGfx.fillStyle(COLORS.enemyBossGlow, 0.15);
            bodyGfx.fillCircle(0, 0, radius + 6);
            bodyGfx.fillStyle(COLORS.enemyBossDark);
            bodyGfx.fillCircle(0, 0, radius);
            bodyGfx.fillStyle(COLORS.enemyBoss);
            bodyGfx.fillCircle(0, -2, radius - 3);
            bodyGfx.lineStyle(2, 0xff80ab, 0.8);
            bodyGfx.strokeCircle(0, 0, radius);
            bodyGfx.fillStyle(0xffffff);
            bodyGfx.fillCircle(-5, -3, 3);
            bodyGfx.fillCircle(5, -3, 3);
            bodyGfx.fillStyle(0xff0000);
            bodyGfx.fillCircle(-5, -3, 1.5);
            bodyGfx.fillCircle(5, -3, 1.5);
        } else {
            bodyGfx.fillStyle(COLORS.enemyNormalDark);
            bodyGfx.fillCircle(0, 0, radius);
            bodyGfx.fillStyle(COLORS.enemyNormal);
            bodyGfx.fillCircle(0, -1.5, radius - 2);
            bodyGfx.fillStyle(0xef9a9a, 0.4);
            bodyGfx.fillCircle(-3, -4, 4);
            bodyGfx.fillStyle(0xffffff);
            bodyGfx.fillCircle(-3, -2, 2);
            bodyGfx.fillCircle(3, -2, 2);
            bodyGfx.fillStyle(0x333333);
            bodyGfx.fillCircle(-3, -2, 1);
            bodyGfx.fillCircle(3, -2, 1);
        }
    }

    killEnemy(enemy) {
        enemy.alive = false;
        this.gold += enemy.reward;
        this.enemiesAlive--;
        this.updateUI();

        // 多層爆炸特效
        const colors = enemy.isBoss
            ? [0xff4081, 0xff80ab, 0xffffff]
            : [0xffeb3b, 0xff9800, 0xffffff];
        colors.forEach((color, i) => {
            const fx = this.add.graphics().setDepth(3);
            fx.fillStyle(color, 0.6 - i * 0.15);
            fx.fillCircle(enemy.x, enemy.y, 12 + i * 6);
            this.tweens.add({
                targets: fx, alpha: 0, scaleX: 2.5, scaleY: 2.5,
                duration: 350 + i * 100, onComplete: () => fx.destroy(),
            });
        });

        // 碎片粒子
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const particle = this.add.graphics().setDepth(3);
            particle.fillStyle(enemy.isBoss ? 0xff4081 : 0xef5350, 0.8);
            particle.fillCircle(0, 0, 2 + Math.random() * 2);
            particle.setPosition(enemy.x, enemy.y);
            this.tweens.add({
                targets: particle,
                x: enemy.x + Math.cos(angle) * (30 + Math.random() * 20),
                y: enemy.y + Math.sin(angle) * (30 + Math.random() * 20),
                alpha: 0, duration: 400,
                onComplete: () => particle.destroy(),
            });
        }

        // 金幣獎勵文字
        const popup = this.add.text(enemy.x, enemy.y - 20, `+${enemy.reward}`, {
            fontSize: '16px', color: '#ffd54f', fontStyle: 'bold',
            stroke: '#5d4037', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(15);
        this.tweens.add({
            targets: popup, y: enemy.y - 55, alpha: 0, duration: 700,
            ease: 'Cubic.easeOut', onComplete: () => popup.destroy(),
        });

        enemy.container.destroy();
    }

    enemyReachedEnd(enemy) {
        enemy.alive = false;
        this.lives--;
        this.enemiesAlive--;
        this.updateUI();

        // 紅色警告閃爍
        const warning = this.add.graphics().setDepth(20);
        warning.fillStyle(0xff0000, 0.15);
        warning.fillRect(0, 0, GAME_WIDTH, ROWS * TILE);
        this.tweens.add({
            targets: warning, alpha: 0, duration: 500,
            onComplete: () => warning.destroy(),
        });

        enemy.container.destroy();
        this.showMessage(`敵人突破防線！ 剩餘生命: ${this.lives}`, 1200);

        if (this.lives <= 0) {
            this.time.delayedCall(500, () => {
                this.scene.start('GameOverScene', { won: false, wave: this.waveNumber });
            });
        }
    }

    // ── 防禦塔攻擊系統 ──────────────────────

    findTarget(tower) {
        let best = null, bestPriority = -1;
        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            const d = dist(tower.x, tower.y, enemy.x, enemy.y);
            if (d > tower.range) continue;
            const wp = PATH_WAYPOINTS[Math.min(enemy.waypointIndex, PATH_WAYPOINTS.length - 1)];
            const distToWp = dist(enemy.x, enemy.y, wp.col * TILE + TILE / 2, wp.row * TILE + TILE / 2);
            const priority = enemy.waypointIndex * 10000 - distToWp;
            if (priority > bestPriority) {
                bestPriority = priority;
                best = enemy;
            }
        }
        return best;
    }

    fireTower(tower, target, time) {
        tower.lastFired = time;
        const cfg = TOWER_TYPES[tower.type];

        // 投射物（帶發光效果）
        const gfx = this.add.graphics().setDepth(3);
        const projSize = tower.type === 'cannon' ? 6 : 4;
        gfx.fillStyle(cfg.projTrail, 0.3);
        gfx.fillCircle(0, 0, projSize + 4);
        gfx.fillStyle(cfg.projColor);
        gfx.fillCircle(0, 0, projSize);
        gfx.fillStyle(0xffffff, 0.6);
        gfx.fillCircle(-1, -1, projSize * 0.4);
        gfx.setPosition(tower.x, tower.y);

        this.projectiles.push({
            x: tower.x, y: tower.y,
            target, speed: 350,
            damage: tower.damage, type: tower.type,
            graphics: gfx, alive: true,
        });

        // 塔開火閃光
        const flash = this.add.graphics().setDepth(2).setPosition(tower.x, tower.y);
        flash.fillStyle(cfg.projColor, 0.4);
        flash.fillCircle(0, 0, 8);
        this.tweens.add({
            targets: flash, alpha: 0, scaleX: 2, scaleY: 2,
            duration: 150, onComplete: () => flash.destroy(),
        });
    }

    // ── 投射物系統 ──────────────────────────

    updateProjectile(proj, delta) {
        if (!proj.alive) return;
        if (!proj.target.alive) {
            proj.alive = false;
            proj.graphics.destroy();
            return;
        }

        const dx = proj.target.x - proj.x;
        const dy = proj.target.y - proj.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const move = proj.speed * (delta / 1000);

        if (d <= move) {
            this.damageEnemy(proj.target, proj.damage, proj.type);
            proj.alive = false;
            proj.graphics.destroy();

            // 命中特效
            const cfg = TOWER_TYPES[proj.type];
            const hit = this.add.graphics().setDepth(3);
            hit.fillStyle(cfg.projColor, 0.5);
            hit.fillCircle(proj.target.x, proj.target.y, 10);
            this.tweens.add({
                targets: hit, alpha: 0, scaleX: 2, scaleY: 2,
                duration: 200, onComplete: () => hit.destroy(),
            });
        } else {
            proj.x += (dx / d) * move;
            proj.y += (dy / d) * move;
            proj.graphics.setPosition(proj.x, proj.y);
        }
    }

    // ── 主迴圈 ──────────────────────────────

    update(time, delta) {
        // 生成敵人
        if (this.waveActive && this.spawnQueue.length > 0) {
            this.spawnTimer -= delta;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy(this.spawnQueue.shift());
                this.spawnTimer = Math.max(400, 1000 - this.waveNumber * 30);
            }
        }

        // 檢查波次結束
        if (this.waveActive && this.spawnQueue.length === 0 && this.enemiesAlive === 0) {
            this.waveActive = false;
            this.updateUI();
            if (this.waveNumber >= MAX_WAVES) {
                this.time.delayedCall(1000, () => {
                    this.scene.start('GameOverScene', { won: true, wave: this.waveNumber });
                });
            } else {
                this.showMessage(`第 ${this.waveNumber} 波完成！`, 2000);
            }
        }

        // 更新敵人
        for (const enemy of this.enemies) {
            if (enemy.alive) this.updateEnemy(enemy, delta);
        }

        // 塔攻擊
        for (const tower of this.towers) {
            if (time - tower.lastFired < tower.fireRate) continue;
            const target = this.findTarget(tower);
            if (target) this.fireTower(tower, target, time);
        }

        // 更新投射物
        for (const proj of this.projectiles) {
            if (proj.alive) this.updateProjectile(proj, delta);
        }

        // 清除已死亡實體
        this.enemies = this.enemies.filter(e => e.alive);
        this.projectiles = this.projectiles.filter(p => p.alive);
    }
}
