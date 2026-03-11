// ============================================
// 主遊戲場景 - 核心遊戲邏輯（等角視角）
// ============================================

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    // ── 場景初始化 ──────────────────────────
    create() {
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
        this.decoSeed = 12345;

        this.buildGrid();
        this.drawGrid();
        this.drawDecorations();
        this.createUI();
        this.setupInput();

        this.previewGfx = this.add.graphics().setDepth(100);
    }

    seededRandom() {
        this.decoSeed = (this.decoSeed * 16807) % 2147483647;
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
            for (const [dc, dr] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                const nc = c + dc, nr = r + dr;
                if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && this.grid[nc][nr] === 'empty') {
                    this.grid[nc][nr] = 'buildable';
                }
            }
        });
    }

    /** 繪製等角地圖（從後往前繪製確保正確遮擋） */
    drawGrid() {
        // 依 row 由小到大（後→前）繪製，確保前方格子蓋住後方
        for (let r = 0; r < ROWS; r++) {
            const rowGfx = this.add.graphics().setDepth(r * 2);
            for (let c = 0; c < COLS; c++) {
                const center = gridCenterToScreen(c, r);
                const type = this.grid[c][r];

                if (type === 'path') {
                    this.drawPathTile(rowGfx, center.x, center.y);
                } else if (type === 'buildable') {
                    this.drawBuildableTile(rowGfx, center.x, center.y, c, r);
                } else {
                    this.drawGrassTile(rowGfx, center.x, center.y, c, r);
                }
            }
        }

        // 路徑方向線（沿著路面中心）
        const pathLine = this.add.graphics().setDepth(ROWS * 2 + 1);
        pathLine.lineStyle(2, 0xd4c4a0, 0.3);
        for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
            const a = gridCenterToScreen(PATH_WAYPOINTS[i].col, PATH_WAYPOINTS[i].row);
            const b = gridCenterToScreen(PATH_WAYPOINTS[i + 1].col, PATH_WAYPOINTS[i + 1].row);
            pathLine.lineBetween(a.x, a.y, b.x, b.y);
        }

        // 入口出口標記
        this.drawPortal(PATH_WAYPOINTS[0].col, PATH_WAYPOINTS[0].row, '入口', 0x4caf50, '#2e7d32');
        this.drawPortal(PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].col, PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].row, '出口', 0xef5350, '#c62828');
    }

    drawGrassTile(gfx, cx, cy, c, r) {
        const ci = (c * 7 + r * 13) % COLORS.grassTop.length;
        drawIsoTile(gfx, cx, cy,
            COLORS.grassTop[ci], COLORS.grassLeft[ci], COLORS.grassRight[ci]);

        // 草地紋理
        const accent = COLORS.grassTop[(ci + 1) % COLORS.grassTop.length];
        for (let i = 0; i < 3; i++) {
            const ox = (this.seededRandom() - 0.5) * ISO_W * 0.5;
            const oy = (this.seededRandom() - 0.5) * ISO_H * 0.4;
            gfx.fillStyle(accent, 0.25);
            gfx.fillCircle(cx + ox, cy + oy, 1 + this.seededRandom());
        }
    }

    drawPathTile(gfx, cx, cy) {
        drawIsoTile(gfx, cx, cy, COLORS.pathTop, COLORS.pathLeft, COLORS.pathRight, ISO_DEPTH - 2);

        // 沙土紋理
        for (let i = 0; i < 5; i++) {
            const ox = (this.seededRandom() - 0.5) * ISO_W * 0.5;
            const oy = (this.seededRandom() - 0.5) * ISO_H * 0.35;
            gfx.fillStyle(COLORS.pathEdge, 0.3);
            const s = 1 + this.seededRandom();
            gfx.fillRect(cx + ox, cy + oy, s, s);
        }
        for (let i = 0; i < 2; i++) {
            const ox = (this.seededRandom() - 0.5) * ISO_W * 0.3;
            const oy = (this.seededRandom() - 0.5) * ISO_H * 0.2;
            gfx.fillStyle(0xd4c4a0, 0.2);
            gfx.fillCircle(cx + ox, cy + oy, 1);
        }
    }

    drawBuildableTile(gfx, cx, cy, c, r) {
        drawIsoTile(gfx, cx, cy, COLORS.buildTop, COLORS.buildLeft, COLORS.buildRight);

        // 角落可建造標記
        strokeDiamond(gfx, cx, cy, ISO_W - 10, ISO_H - 5, 0x81c784, 0.25, 1);

        // 小十字標記
        gfx.lineStyle(1, 0x81c784, 0.2);
        gfx.lineBetween(cx - 4, cy, cx + 4, cy);
        gfx.lineBetween(cx, cy - 2, cx, cy + 2);
    }

    drawPortal(col, row, label, color, bgColor) {
        const pos = gridCenterToScreen(col, row);
        const depth = (col + row + 1) * 2 + 1;

        const g = this.add.graphics().setDepth(depth);
        g.fillStyle(color, 0.15);
        g.fillCircle(pos.x, pos.y, 24);
        g.lineStyle(2, color, 0.6);
        g.strokeCircle(pos.x, pos.y, 18);

        const txt = this.add.text(pos.x, pos.y - 24, label, {
            fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
            backgroundColor: bgColor, padding: { x: 6, y: 2 },
        }).setOrigin(0.5).setDepth(depth + 1);

        this.tweens.add({
            targets: txt, y: txt.y - 4, duration: 1500,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    /** 繪製裝飾（小樹、石頭） */
    drawDecorations() {
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (this.grid[c][r] !== 'empty') continue;
                const rand = this.seededRandom();
                const center = gridCenterToScreen(c, r);
                const depth = (c + r + 1) * 2;
                const decoGfx = this.add.graphics().setDepth(depth);

                if (rand < 0.12) {
                    this.drawTree(decoGfx, center.x, center.y - 10);
                } else if (rand < 0.20) {
                    this.drawRock(decoGfx, center.x, center.y);
                } else if (rand < 0.28) {
                    const ox = (this.seededRandom() - 0.5) * 16;
                    const oy = (this.seededRandom() - 0.5) * 8;
                    this.drawFlower(decoGfx, center.x + ox, center.y + oy);
                }
            }
        }
    }

    drawTree(gfx, x, y) {
        gfx.fillStyle(0x5d4037);
        gfx.fillRect(x - 2, y + 2, 4, 12);
        gfx.fillStyle(0x2e7d32, 0.9);
        gfx.fillTriangle(x, y - 14, x - 12, y + 4, x + 12, y + 4);
        gfx.fillStyle(0x388e3c, 0.9);
        gfx.fillTriangle(x, y - 20, x - 9, y - 2, x + 9, y - 2);
        gfx.fillStyle(0x43a047, 0.8);
        gfx.fillTriangle(x, y - 24, x - 6, y - 10, x + 6, y - 10);
    }

    drawRock(gfx, x, y) {
        gfx.fillStyle(0x757575, 0.7);
        gfx.fillEllipse(x, y + 2, 14, 8);
        gfx.fillStyle(0x9e9e9e, 0.5);
        gfx.fillEllipse(x - 1, y + 1, 8, 5);
    }

    drawFlower(gfx, x, y) {
        const colors = [0xff8a80, 0xffff8d, 0x80d8ff, 0xb388ff];
        const fc = colors[Math.floor(this.seededRandom() * colors.length)];
        gfx.lineStyle(1, 0x558b2f, 0.6);
        gfx.lineBetween(x, y, x, y + 6);
        gfx.fillStyle(fc, 0.7);
        gfx.fillCircle(x, y, 2.5);
        gfx.fillStyle(0xffff00, 0.8);
        gfx.fillCircle(x, y, 1);
    }

    // ── 使用者介面 ──────────────────────────

    createUI() {
        const uiY = PLAYFIELD_H;

        // UI 漸層背景
        const uiBg = this.add.graphics().setDepth(200);
        for (let i = 0; i < UI_HEIGHT; i++) {
            const t = i / UI_HEIGHT;
            const rv = Math.floor(0x1a + (0x25 - 0x1a) * t);
            const gv = Math.floor(0x1a + (0x25 - 0x1a) * t);
            const bv = Math.floor(0x2e + (0x40 - 0x2e) * t);
            uiBg.fillStyle((rv << 16) | (gv << 8) | bv);
            uiBg.fillRect(0, uiY + i, GAME_WIDTH, 1);
        }
        uiBg.lineStyle(1, 0x5a5a8a, 0.6);
        uiBg.lineBetween(0, uiY, GAME_WIDTH, uiY);

        // 資源面板
        const panelGfx = this.add.graphics().setDepth(200);
        panelGfx.fillStyle(0x1e1e36, 0.8);
        panelGfx.fillRoundedRect(8, uiY + 6, 200, 68, 6);
        panelGfx.lineStyle(1, 0x3a3a5c, 0.5);
        panelGfx.strokeRoundedRect(8, uiY + 6, 200, 68, 6);

        // 金幣圖示位置（金幣飛向此處）
        this.goldIconX = 24;
        this.goldIconY = uiY + 12;

        this.goldText = this.add.text(this.goldIconX, this.goldIconY, '', {
            fontSize: '17px', color: COLORS.uiGold, fontStyle: 'bold',
        }).setDepth(201);
        this.livesText = this.add.text(24, uiY + 34, '', {
            fontSize: '17px', color: COLORS.uiLives, fontStyle: 'bold',
        }).setDepth(201);
        this.waveText = this.add.text(24, uiY + 55, '', {
            fontSize: '13px', color: COLORS.uiWave,
        }).setDepth(201);

        // 防禦塔按鈕
        this.towerButtons = [];
        const types = ['arrow', 'cannon', 'ice'];
        const icons = ['🏹', '💣', '❄️'];
        let bx = 230;

        types.forEach((type, i) => {
            const cfg = TOWER_TYPES[type];
            const btnBg = this.add.graphics().setDepth(200);
            const btn = this.add.text(bx + 60, uiY + 26, `${icons[i]} ${cfg.name}`, {
                fontSize: '16px', color: '#e0e0e0', fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(201);
            const costText = this.add.text(bx + 60, uiY + 50, `$ ${cfg.cost}`, {
                fontSize: '13px', color: '#aaaaaa',
            }).setOrigin(0.5).setDepth(201);

            const hitArea = this.add.rectangle(bx + 60, uiY + 40, 120, 68)
                .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(202);
            hitArea.towerType = type;
            hitArea.on('pointerdown', (pointer) => {
                pointer.event.stopPropagation();
                this.selectTower(type);
            });

            this.towerButtons.push({ hitArea, btn, costText, type, bg: btnBg });
            bx += 132;
        });

        // 下一波按鈕
        this.nextWaveBg = this.add.graphics().setDepth(200);
        this.drawNextWaveBtn(0xc62828, 0xe53935);
        this.nextWaveText = this.add.text(GAME_WIDTH - 95, uiY + 40, '下 一 波', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(201);

        const nextWaveHit = this.add.rectangle(GAME_WIDTH - 95, uiY + 40, 140, 60)
            .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(202);
        nextWaveHit.on('pointerdown', (pointer) => {
            pointer.event.stopPropagation();
            if (!this.waveActive) this.startWave();
        });

        // 訊息提示
        this.msgText = this.add.text(GAME_WIDTH / 2, PLAYFIELD_H - 30, '', {
            fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
            backgroundColor: '#1a1a2ecc', padding: { x: 16, y: 6 },
        }).setOrigin(0.5).setDepth(300).setAlpha(0);

        this.updateUI();
    }

    drawNextWaveBtn(dark, light) {
        const uiY = PLAYFIELD_H;
        this.nextWaveBg.clear();
        this.nextWaveBg.fillStyle(dark);
        this.nextWaveBg.fillRoundedRect(GAME_WIDTH - 166, uiY + 10, 142, 60, 8);
        this.nextWaveBg.fillStyle(light);
        this.nextWaveBg.fillRoundedRect(GAME_WIDTH - 164, uiY + 10, 138, 54, 7);
    }

    showMessage(text, duration = 1500) {
        this.msgText.setText(text).setAlpha(1);
        this.tweens.add({ targets: this.msgText, alpha: 0, duration: 400, delay: duration - 400 });
    }

    selectTower(type) {
        this.selectedTowerType = (this.selectedTowerType === type) ? null : type;
        this.updateTowerButtons();
    }

    updateTowerButtons() {
        this.towerButtons.forEach(({ bg, type, btn, costText }) => {
            const cfg = TOWER_TYPES[type];
            bg.clear();
            if (type === this.selectedTowerType) {
                bg.fillStyle(0x1b5e20, 0.9);
                bg.fillRoundedRect(btn.x - 60, PLAYFIELD_H + 4, 120, 70, 6);
                bg.lineStyle(2, 0x4caf50, 0.8);
                bg.strokeRoundedRect(btn.x - 60, PLAYFIELD_H + 4, 120, 70, 6);
                btn.setColor('#ffffff');
                costText.setColor('#a5d6a7');
            } else if (this.gold < cfg.cost) {
                bg.fillStyle(0x1a1a2e, 0.6);
                bg.fillRoundedRect(btn.x - 60, PLAYFIELD_H + 6, 120, 68, 6);
                btn.setColor('#666666');
                costText.setColor('#664444');
            } else {
                bg.fillStyle(0x2a2a4a, 0.9);
                bg.fillRoundedRect(btn.x - 60, PLAYFIELD_H + 6, 120, 68, 6);
                bg.lineStyle(1, 0x4a4a6a, 0.5);
                bg.strokeRoundedRect(btn.x - 60, PLAYFIELD_H + 6, 120, 68, 6);
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
            if (pointer.y >= PLAYFIELD_H) return;
            if (!this.selectedTowerType) return;

            const { col, row } = screenToGrid(pointer.x, pointer.y);
            if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
            this.placeTower(col, row, this.selectedTowerType);
        });

        this.input.on('pointermove', (pointer) => {
            this.previewGfx.clear();
            if (!this.selectedTowerType || pointer.y >= PLAYFIELD_H) return;

            const { col, row } = screenToGrid(pointer.x, pointer.y);
            if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

            const valid = this.grid[col][row] === 'buildable';
            const cfg = TOWER_TYPES[this.selectedTowerType];
            const center = gridCenterToScreen(col, row);
            const canAfford = this.gold >= cfg.cost;

            if (valid) {
                // 範圍橢圓（等角投影下圓變橢圓）
                const color = canAfford ? 0x4caf50 : 0xef5350;
                this.previewGfx.lineStyle(2, color, 0.3);
                this.previewGfx.strokeEllipse(center.x, center.y, cfg.range * 2.5, cfg.range * 1.25);
                this.previewGfx.fillStyle(color, 0.08);
                this.previewGfx.fillEllipse(center.x, center.y, cfg.range * 2.5, cfg.range * 1.25);

                // 塔預覽菱形
                drawDiamond(this.previewGfx, center.x, center.y, ISO_W - 8, ISO_H - 4,
                    cfg.color, canAfford ? 0.5 : 0.25);
                strokeDiamond(this.previewGfx, center.x, center.y, ISO_W - 8, ISO_H - 4,
                    canAfford ? 0xffffff : 0xff0000, 0.5, 1);
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

        const logicalPos = gridToPixel(col, row);
        const screenPos = gridCenterToScreen(col, row);
        const towerDepth = (col + row + 1) * 2 + 1;

        const tower = {
            type, col, row,
            x: logicalPos.x, y: logicalPos.y,     // 邏輯座標（射程計算用）
            sx: screenPos.x, sy: screenPos.y,       // 螢幕座標（渲染用）
            lastFired: 0,
            range: cfg.range, damage: cfg.damage, fireRate: cfg.fireRate,
        };

        // 繪製等角塔身
        const gfx = this.add.graphics().setDepth(towerDepth);

        // 底座（等角菱形）
        drawDiamondLeft(gfx, 0, 0, ISO_W - 8, ISO_H - 4, 16, cfg.colorDark);
        drawDiamondRight(gfx, 0, 0, ISO_W - 8, ISO_H - 4, 16, cfg.color);
        drawDiamond(gfx, 0, -8, ISO_W - 8, ISO_H - 4, cfg.colorLight);

        // 塔頂特色圖形
        if (type === 'arrow') {
            gfx.fillStyle(0x81c784);
            gfx.fillCircle(0, -14, 8);
            gfx.fillStyle(0x66bb6a);
            gfx.fillCircle(0, -14, 5);
            // 箭頭
            gfx.lineStyle(2, 0xc8e6c9, 0.9);
            gfx.lineBetween(0, -22, 0, -8);
            gfx.lineBetween(-2, -19, 0, -23);
            gfx.lineBetween(2, -19, 0, -23);
        } else if (type === 'cannon') {
            gfx.fillStyle(0xbdbdbd);
            gfx.fillRect(-4, -22, 8, 10);
            gfx.fillStyle(0x9e9e9e);
            gfx.fillRect(-6, -14, 12, 6);
            gfx.fillStyle(0x757575);
            gfx.fillCircle(0, -10, 5);
            gfx.lineStyle(1, 0xe0e0e0, 0.5);
            gfx.strokeCircle(0, -10, 5);
        } else if (type === 'ice') {
            gfx.fillStyle(0x90caf9, 0.8);
            gfx.fillTriangle(0, -24, -8, -8, 8, -8);
            gfx.fillStyle(0x64b5f6, 0.9);
            gfx.fillTriangle(0, -4, -6, -14, 6, -14);
            gfx.lineStyle(1, 0xe3f2fd, 0.6);
            gfx.lineBetween(0, -24, 0, -4);
            gfx.lineBetween(-8, -14, 8, -14);
        }

        gfx.setPosition(screenPos.x, screenPos.y);
        tower.graphics = gfx;
        this.towers.push(tower);
        this.updateUI();

        // 建造動畫
        gfx.setScale(0.3).setAlpha(0.5);
        this.tweens.add({
            targets: gfx, scaleX: 1, scaleY: 1, alpha: 1,
            duration: 250, ease: 'Back.easeOut',
        });

        // 光環
        const ring = this.add.graphics().setDepth(towerDepth + 1).setPosition(screenPos.x, screenPos.y);
        ring.lineStyle(2, cfg.colorLight, 0.6);
        ring.strokeEllipse(0, 0, 40, 20);
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
        const startScreen = logicalToScreen(start.x, start.y);
        const enemy = {
            ...data,
            x: start.x, y: start.y,
            waypointIndex: 1,
            slowTimer: 0,
            alive: true,
        };

        const container = this.add.container(startScreen.x, startScreen.y).setDepth(10);
        const radius = data.isBoss ? 18 : 11;

        // 陰影（等角橢圓）
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillEllipse(2, radius - 2, radius * 2, radius * 0.7);
        container.add(shadow);

        // 本體
        const body = this.add.graphics();
        if (data.isBoss) {
            body.fillStyle(COLORS.enemyBossGlow, 0.15);
            body.fillCircle(0, 0, radius + 5);
            body.fillStyle(COLORS.enemyBossDark);
            body.fillCircle(0, 0, radius);
            body.fillStyle(COLORS.enemyBoss);
            body.fillCircle(0, -2, radius - 3);
            body.lineStyle(2, 0xff80ab, 0.8);
            body.strokeCircle(0, 0, radius);
            body.fillStyle(0xffffff);
            body.fillCircle(-4, -3, 2.5);
            body.fillCircle(4, -3, 2.5);
            body.fillStyle(0xff0000);
            body.fillCircle(-4, -3, 1.2);
            body.fillCircle(4, -3, 1.2);
        } else {
            body.fillStyle(COLORS.enemyNormalDark);
            body.fillCircle(0, 0, radius);
            body.fillStyle(COLORS.enemyNormal);
            body.fillCircle(0, -1.5, radius - 2);
            body.fillStyle(0xef9a9a, 0.4);
            body.fillCircle(-2, -3, 3);
            body.fillStyle(0xffffff);
            body.fillCircle(-3, -2, 2);
            body.fillCircle(3, -2, 2);
            body.fillStyle(0x333333);
            body.fillCircle(-3, -2, 1);
            body.fillCircle(3, -2, 1);
        }
        container.add(body);

        // 血量條
        const hpBg = this.add.graphics();
        hpBg.fillStyle(0x000000, 0.5);
        hpBg.fillRoundedRect(-16, -radius - 12, 32, 6, 3);
        container.add(hpBg);

        const hpBar = this.add.graphics();
        hpBar.fillStyle(0x4caf50);
        hpBar.fillRoundedRect(-15, -radius - 11, 30, 4, 2);
        container.add(hpBar);

        enemy.container = container;
        enemy.hpBar = hpBar;
        enemy.hpBarRadius = radius;

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

        // 邏輯座標 → 螢幕座標
        const screen = logicalToScreen(enemy.x, enemy.y);
        enemy.container.setPosition(screen.x, screen.y);

        // 根據螢幕 Y 動態調整深度（前方的敵人蓋在後方之上）
        enemy.container.setDepth(Math.floor(screen.y) + 50);
    }

    damageEnemy(enemy, damage, type) {
        enemy.hp -= damage;

        if (type === 'ice') {
            enemy.slowTimer = 2000;
            const bodyGfx = enemy.container.list[1];
            bodyGfx.clear();
            const radius = enemy.isBoss ? 18 : 11;
            bodyGfx.fillStyle(0x4fc3f7, 0.3);
            bodyGfx.fillCircle(0, 0, radius + 4);
            bodyGfx.fillStyle(0x81d4fa);
            bodyGfx.fillCircle(0, 0, radius);
            bodyGfx.lineStyle(1, 0xe1f5fe, 0.6);
            bodyGfx.strokeCircle(0, 0, radius);
            this.time.delayedCall(400, () => {
                if (enemy.alive) this.redrawEnemyBody(enemy);
            });
        }

        enemy.container.setAlpha(0.6);
        this.time.delayedCall(80, () => { if (enemy.alive) enemy.container.setAlpha(1); });

        enemy.hpBar.clear();
        const ratio = Math.max(0, enemy.hp / enemy.maxHp);
        const color = ratio > 0.6 ? 0x4caf50 : ratio > 0.3 ? 0xffa726 : 0xef5350;
        enemy.hpBar.fillStyle(color);
        enemy.hpBar.fillRoundedRect(-15, -enemy.hpBarRadius - 11, 30 * ratio, 4, 2);

        if (enemy.hp <= 0) this.killEnemy(enemy);
    }

    redrawEnemyBody(enemy) {
        const bodyGfx = enemy.container.list[1];
        bodyGfx.clear();
        const radius = enemy.isBoss ? 18 : 11;
        if (enemy.isBoss) {
            bodyGfx.fillStyle(COLORS.enemyBossGlow, 0.15);
            bodyGfx.fillCircle(0, 0, radius + 5);
            bodyGfx.fillStyle(COLORS.enemyBossDark);
            bodyGfx.fillCircle(0, 0, radius);
            bodyGfx.fillStyle(COLORS.enemyBoss);
            bodyGfx.fillCircle(0, -2, radius - 3);
            bodyGfx.lineStyle(2, 0xff80ab, 0.8);
            bodyGfx.strokeCircle(0, 0, radius);
            bodyGfx.fillStyle(0xffffff);
            bodyGfx.fillCircle(-4, -3, 2.5);
            bodyGfx.fillCircle(4, -3, 2.5);
            bodyGfx.fillStyle(0xff0000);
            bodyGfx.fillCircle(-4, -3, 1.2);
            bodyGfx.fillCircle(4, -3, 1.2);
        } else {
            bodyGfx.fillStyle(COLORS.enemyNormalDark);
            bodyGfx.fillCircle(0, 0, radius);
            bodyGfx.fillStyle(COLORS.enemyNormal);
            bodyGfx.fillCircle(0, -1.5, radius - 2);
            bodyGfx.fillStyle(0xef9a9a, 0.4);
            bodyGfx.fillCircle(-2, -3, 3);
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

        const screen = logicalToScreen(enemy.x, enemy.y);

        // 爆炸特效
        const colors = enemy.isBoss
            ? [0xff4081, 0xff80ab, 0xffffff]
            : [0xffeb3b, 0xff9800, 0xffffff];
        colors.forEach((color, i) => {
            const fx = this.add.graphics().setDepth(500);
            fx.fillStyle(color, 0.6 - i * 0.15);
            fx.fillCircle(screen.x, screen.y, 10 + i * 5);
            this.tweens.add({
                targets: fx, alpha: 0, scaleX: 2.5, scaleY: 2.5,
                duration: 350 + i * 100, onComplete: () => fx.destroy(),
            });
        });

        // 碎片粒子
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const particle = this.add.graphics().setDepth(500);
            particle.fillStyle(enemy.isBoss ? 0xff4081 : 0xef5350, 0.8);
            particle.fillCircle(0, 0, 1.5 + Math.random() * 1.5);
            particle.setPosition(screen.x, screen.y);
            this.tweens.add({
                targets: particle,
                x: screen.x + Math.cos(angle) * (25 + Math.random() * 15),
                y: screen.y + Math.sin(angle) * (20 + Math.random() * 10),
                alpha: 0, duration: 350,
                onComplete: () => particle.destroy(),
            });
        }

        // 金幣飛向左下角的金幣 UI
        const popup = this.add.text(screen.x, screen.y - 10, `+${enemy.reward}`, {
            fontSize: '16px', color: '#ffd54f', fontStyle: 'bold',
            stroke: '#5d4037', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(500);

        this.tweens.add({
            targets: popup,
            x: this.goldIconX + 30,
            y: this.goldIconY,
            alpha: 0.3,
            scaleX: 0.6, scaleY: 0.6,
            duration: 700,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                popup.destroy();
                // 金幣到達時的閃光
                const flash = this.add.graphics().setDepth(300);
                flash.fillStyle(0xffd54f, 0.5);
                flash.fillCircle(this.goldIconX + 10, this.goldIconY + 10, 12);
                this.tweens.add({
                    targets: flash, alpha: 0, scaleX: 2, scaleY: 2,
                    duration: 200, onComplete: () => flash.destroy(),
                });
            },
        });

        enemy.container.destroy();
    }

    enemyReachedEnd(enemy) {
        enemy.alive = false;
        this.lives--;
        this.enemiesAlive--;
        this.updateUI();

        const warning = this.add.graphics().setDepth(400);
        warning.fillStyle(0xff0000, 0.12);
        warning.fillRect(0, 0, GAME_WIDTH, PLAYFIELD_H);
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

        const gfx = this.add.graphics().setDepth(500);
        const projSize = tower.type === 'cannon' ? 5 : 3;
        gfx.fillStyle(cfg.projTrail, 0.3);
        gfx.fillCircle(0, 0, projSize + 3);
        gfx.fillStyle(cfg.projColor);
        gfx.fillCircle(0, 0, projSize);
        gfx.fillStyle(0xffffff, 0.6);
        gfx.fillCircle(-1, -1, projSize * 0.4);
        gfx.setPosition(tower.sx, tower.sy);

        this.projectiles.push({
            x: tower.x, y: tower.y,
            target, speed: 350,
            damage: tower.damage, type: tower.type,
            graphics: gfx, alive: true,
        });

        // 開火閃光
        const flash = this.add.graphics().setDepth(500).setPosition(tower.sx, tower.sy);
        flash.fillStyle(cfg.projColor, 0.4);
        flash.fillCircle(0, -12, 6);
        this.tweens.add({
            targets: flash, alpha: 0, scaleX: 2, scaleY: 2,
            duration: 120, onComplete: () => flash.destroy(),
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

            const cfg = TOWER_TYPES[proj.type];
            const hitScreen = logicalToScreen(proj.target.x, proj.target.y);
            const hit = this.add.graphics().setDepth(500);
            hit.fillStyle(cfg.projColor, 0.5);
            hit.fillCircle(hitScreen.x, hitScreen.y, 8);
            this.tweens.add({
                targets: hit, alpha: 0, scaleX: 2, scaleY: 2,
                duration: 200, onComplete: () => hit.destroy(),
            });
        } else {
            proj.x += (dx / d) * move;
            proj.y += (dy / d) * move;
            const screen = logicalToScreen(proj.x, proj.y);
            proj.graphics.setPosition(screen.x, screen.y);
        }
    }

    // ── 主迴圈 ──────────────────────────────

    update(time, delta) {
        if (this.waveActive && this.spawnQueue.length > 0) {
            this.spawnTimer -= delta;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy(this.spawnQueue.shift());
                this.spawnTimer = Math.max(400, 1000 - this.waveNumber * 30);
            }
        }

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

        for (const enemy of this.enemies) {
            if (enemy.alive) this.updateEnemy(enemy, delta);
        }

        for (const tower of this.towers) {
            if (time - tower.lastFired < tower.fireRate) continue;
            const target = this.findTarget(tower);
            if (target) this.fireTower(tower, target, time);
        }

        for (const proj of this.projectiles) {
            if (proj.alive) this.updateProjectile(proj, delta);
        }

        this.enemies = this.enemies.filter(e => e.alive);
        this.projectiles = this.projectiles.filter(p => p.alive);
    }
}
