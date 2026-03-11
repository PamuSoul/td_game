// ============================================
// 主遊戲場景 - 2.5D 矩形方塊視角
// ============================================

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

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
        // 從草地圖片裁切出非透明區域，建立新紋理
        if (this.textures.exists('tile_grass') && !this.textures.exists('tile_grass_trimmed')) {
            const src = this.textures.get('tile_grass').getSourceImage();
            const cv = document.createElement('canvas');
            cv.width = src.width; cv.height = src.height;
            const ctx = cv.getContext('2d');
            ctx.drawImage(src, 0, 0);
            const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
            let minX = cv.width, minY = cv.height, maxX = 0, maxY = 0;
            for (let y = 0; y < cv.height; y++) {
                for (let x = 0; x < cv.width; x++) {
                    if (data[(y * cv.width + x) * 4 + 3] > 10) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX > minX && maxY > minY) {
                const tw = maxX - minX + 1, th = maxY - minY + 1;
                const trimmed = document.createElement('canvas');
                trimmed.width = tw; trimmed.height = th;
                trimmed.getContext('2d').drawImage(cv, minX, minY, tw, th, 0, 0, tw, th);
                this.textures.addCanvas('tile_grass_trimmed', trimmed);
            }
        }
        this.drawGrid();
        this.drawDecorations();
        this.drawEntryArrow();
        this.drawExitCastle();
        this.createUI();
        this.setupInput();
        this.previewGfx = this.add.graphics().setDepth(900);
        this.previewImg = null;
    }

    seededRandom() {
        this.decoSeed = (this.decoSeed * 16807) % 2147483647;
        return (this.decoSeed & 0x7fffffff) / 2147483647;
    }

    // ── 地圖 ──

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
                if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && this.grid[nc][nr] === 'empty')
                    this.grid[nc][nr] = 'buildable';
            }
        });
    }

    drawGrid() {
        const gpx = 4; // 背景像素格大小
        const hasGrassTile = this.textures.exists('tile_grass_trimmed');
        for (let r = 0; r < ROWS; r++) {
            const rowGfx = this.add.graphics().setDepth(r * 10);
            for (let c = 0; c < COLS; c++) {
                const type = this.grid[c][r];
                if (type === 'path') {
                    // 路徑底色
                    const x0 = c * TILE_W, y0 = r * TILE_H;
                    rowGfx.fillStyle(0xc4ad82);
                    rowGfx.fillRect(x0, y0, TILE_W, TILE_H);
                    // 沙土紋理
                    rowGfx.fillStyle(0x7d6f57, 0.3);
                    for (let i = 0; i < 6; i++) {
                        const dx = 4 + this.seededRandom() * (TILE_W - 8);
                        const dy = 4 + this.seededRandom() * (TILE_H - 8);
                        const s = 1 + this.seededRandom() * 2;
                        rowGfx.fillRect(x0 + dx, y0 + dy, s, s);
                    }
                    // 淡色高光點
                    rowGfx.fillStyle(0xddd0b0, 0.3);
                    for (let i = 0; i < 3; i++) {
                        const dx = 8 + this.seededRandom() * (TILE_W - 16);
                        const dy = 8 + this.seededRandom() * (TILE_H - 16);
                        rowGfx.fillCircle(x0 + dx, y0 + dy, 1);
                    }
                } else {
                    // 草地和可建造格都用草地圖片
                    if (hasGrassTile) {
                        this.add.image(c * TILE_W, r * TILE_H, 'tile_grass_trimmed')
                            .setOrigin(0, 0).setDepth(r * 10)
                            .setDisplaySize(TILE_W, TILE_H);
                    } else {
                        const ci = (c * 7 + r * 13) % COLORS.grassTop.length;
                        drawBlock(rowGfx, c, r, COLORS.grassTop[ci], COLORS.grassFront[ci]);
                    }
                    // 可建造格加十字標記
                    if (type === 'buildable') {
                        const cx = c * TILE_W + TILE_W / 2, cy = r * TILE_H + TILE_H / 2;
                        rowGfx.fillStyle(0xffffff, 0.25);
                        rowGfx.fillRect(cx - gpx, cy - gpx/2, gpx*2, gpx);
                        rowGfx.fillRect(cx - gpx/2, cy - gpx, gpx, gpx*2);
                    }
                }
            }
        }

        // 路徑邊緣加深線
        const edgeGfx = this.add.graphics().setDepth(1);
        this.pathTiles.forEach(key => {
            const [c, r] = key.split(',').map(Number);
            const x = c * TILE_W, y = r * TILE_H;
            edgeGfx.lineStyle(2, 0x6d5f47, 0.6);
            if (!this.pathTiles.has(`${c},${r - 1}`)) edgeGfx.lineBetween(x, y, x + TILE_W, y);
            if (!this.pathTiles.has(`${c},${r + 1}`)) edgeGfx.lineBetween(x, y + TILE_H, x + TILE_W, y + TILE_H);
            if (!this.pathTiles.has(`${c - 1},${r}`)) edgeGfx.lineBetween(x, y, x, y + TILE_H);
            if (!this.pathTiles.has(`${c + 1},${r}`)) edgeGfx.lineBetween(x + TILE_W, y, x + TILE_W, y + TILE_H);
        });
    }

    drawEntryArrow() {
        const wp0 = PATH_WAYPOINTS[0];
        const wp1 = PATH_WAYPOINTS[1];
        const from = gridCenterToScreen(wp0.col, wp0.row);
        const to = gridCenterToScreen(wp1.col, wp1.row);
        const depth = wp0.row * 10 + 5;

        const angle = Math.atan2(to.y - from.y, to.x - from.x);

        const g = this.add.graphics().setDepth(depth);
        g.fillStyle(0x4caf50, 0.9);
        g.fillTriangle(18, 0, -8, -14, -8, 14);
        g.fillStyle(0x66bb6a);
        g.fillTriangle(14, 0, -5, -10, -5, 10);
        g.fillStyle(0x388e3c);
        g.fillRect(-24, -4, 18, 8);
        g.fillStyle(0x4caf50);
        g.fillRect(-22, -3, 16, 6);

        g.setPosition(from.x, from.y);
        g.setRotation(angle);
    }

    drawExitCastle() {
        const wp = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
        const pos = gridCenterToScreen(wp.col, wp.row);
        const depth = wp.row * 10 + 6;

        const g = this.add.graphics().setDepth(depth);
        const cx = pos.x, cy = pos.y;

        g.fillStyle(0x8d6e63);
        g.fillRect(cx - 18, cy - 14, 36, 22);
        g.fillStyle(0xa1887f);
        g.fillRect(cx - 16, cy - 12, 32, 18);

        g.fillStyle(0x8d6e63);
        for (let i = 0; i < 5; i++) {
            g.fillRect(cx - 18 + i * 9, cy - 20, 5, 8);
        }

        g.fillStyle(0x4e342e);
        g.fillRect(cx - 6, cy - 2, 12, 14);
        g.fillStyle(0x3e2723);
        g.fillRect(cx - 4, cy, 8, 12);

        g.fillStyle(0x6d4c41);
        g.fillCircle(cx, cy - 2, 6);
        g.fillStyle(0x4e342e);
        g.fillCircle(cx, cy - 2, 4);

        g.fillStyle(0x795548);
        g.fillRect(cx - 22, cy - 18, 8, 26);
        g.fillRect(cx + 14, cy - 18, 8, 26);
        g.fillStyle(0xef5350);
        g.fillTriangle(cx - 22, cy - 18, cx - 14, cy - 18, cx - 18, cy - 26);
        g.fillTriangle(cx + 14, cy - 18, cx + 22, cy - 18, cx + 18, cy - 26);

        g.fillStyle(0x5d4037);
        g.fillRect(cx - 1, cy - 36, 2, 20);
        g.fillStyle(0xef5350);
        g.fillTriangle(cx + 1, cy - 36, cx + 14, cy - 31, cx + 1, cy - 26);
    }

    drawDecorations() {
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (this.grid[c][r] !== 'empty') continue;
                const rand = this.seededRandom();
                const cx = c * TILE_W + TILE_W / 2;
                const cy = r * TILE_H + TILE_H / 2;
                const depth = r * 10 + 1;
                const decoGfx = this.add.graphics().setDepth(depth);

                if (rand < 0.12) {
                    drawPixelSprite(decoGfx, cx, cy - 4, SPR_TREE, PAL_TREE, 3);
                } else if (rand < 0.20) {
                    drawPixelSprite(decoGfx, cx, cy + 4, SPR_ROCK, PAL_ROCK, 3);
                } else if (rand < 0.28) {
                    const ox = (this.seededRandom() - 0.5) * 12;
                    const oy = (this.seededRandom() - 0.5) * 6;
                    const fi = Math.floor(this.seededRandom() * FLOWER_PALS.length);
                    drawPixelSprite(decoGfx, cx + ox, cy + oy, SPR_FLOWER_R, FLOWER_PALS[fi], 3);
                }
            }
        }
    }

    // ── UI ──

    createUI() {
        const uiY = PLAYFIELD_H;

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

        const panelGfx = this.add.graphics().setDepth(200);
        panelGfx.fillStyle(0x1e1e36, 0.8);
        panelGfx.fillRoundedRect(8, uiY + 6, 200, 68, 6);
        panelGfx.lineStyle(1, 0x3a3a5c, 0.5);
        panelGfx.strokeRoundedRect(8, uiY + 6, 200, 68, 6);

        this.goldIconX = 24;
        this.goldIconY = uiY + 12;

        this.goldText = this.add.text(this.goldIconX, this.goldIconY, '', {
            fontSize: '17px', color: COLORS.uiGold, fontStyle: 'bold',
            padding: { top: 4, bottom: 2 },
        }).setDepth(201);
        this.livesText = this.add.text(24, uiY + 34, '', {
            fontSize: '17px', color: COLORS.uiLives, fontStyle: 'bold',
            padding: { top: 4, bottom: 2 },
        }).setDepth(201);
        this.waveText = this.add.text(24, uiY + 55, '', {
            fontSize: '13px', color: COLORS.uiWave,
            padding: { top: 2 },
        }).setDepth(201);

        this.towerButtons = [];
        const types = ['arrow', 'cannon', 'ice'];
        const icons = ['🏹', '💣', '❄️'];
        let bx = 230;

        types.forEach((type, i) => {
            const cfg = TOWER_TYPES[type];
            const btnBg = this.add.graphics().setDepth(200);
            const btn = this.add.text(bx + 60, uiY + 26, `${icons[i]} ${cfg.name}`, {
                fontSize: '16px', color: '#e0e0e0', fontStyle: 'bold',
                padding: { top: 4, bottom: 2 },
            }).setOrigin(0.5).setDepth(201);
            const costText = this.add.text(bx + 60, uiY + 50, `$ ${cfg.cost}`, {
                fontSize: '13px', color: '#aaaaaa',
                padding: { top: 2 },
            }).setOrigin(0.5).setDepth(201);

            const hitArea = this.add.rectangle(bx + 60, uiY + 40, 120, 68)
                .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(202);
            hitArea.on('pointerdown', (pointer) => {
                pointer.event.stopPropagation();
                this.selectTower(type);
            });

            this.towerButtons.push({ hitArea, btn, costText, type, bg: btnBg });
            bx += 132;
        });

        this.nextWaveBg = this.add.graphics().setDepth(200);
        this.drawNextWaveBtn(0xc62828, 0xe53935);
        this.nextWaveText = this.add.text(GAME_WIDTH - 95, uiY + 40, '下 一 波', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
            padding: { top: 4, bottom: 2 },
        }).setOrigin(0.5).setDepth(201);

        const nextWaveHit = this.add.rectangle(GAME_WIDTH - 95, uiY + 40, 140, 60)
            .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(202);
        nextWaveHit.on('pointerdown', (pointer) => {
            pointer.event.stopPropagation();
            if (!this.waveActive) this.startWave();
        });

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

    // ── 輸入 ──

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
            if (this.previewImg) { this.previewImg.setVisible(false); }
            if (!this.selectedTowerType || pointer.y >= PLAYFIELD_H) return;
            const { col, row } = screenToGrid(pointer.x, pointer.y);
            if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

            const valid = this.grid[col][row] === 'buildable';
            const cfg = TOWER_TYPES[this.selectedTowerType];
            const center = gridCenterToScreen(col, row);
            const canAfford = this.gold >= cfg.cost;

            if (valid) {
                const color = canAfford ? 0x4caf50 : 0xef5350;
                this.previewGfx.lineStyle(2, color, 0.3);
                this.previewGfx.strokeCircle(center.x, center.y, cfg.range);
                this.previewGfx.fillStyle(color, 0.08);
                this.previewGfx.fillCircle(center.x, center.y, cfg.range);

                // 預覽塔圖像
                const imgKeys = { arrow: 'tower_arrow', cannon: null, ice: null };
                const imgKey = imgKeys[this.selectedTowerType];
                if (imgKey && this.textures.exists(imgKey)) {
                    if (!this.previewImg || this.previewImg.texture.key !== imgKey) {
                        if (this.previewImg) this.previewImg.destroy();
                        this.previewImg = this.add.image(0, 0, imgKey).setDepth(901);
                    }
                    const s = (TILE_H * 2) / this.previewImg.height;
                    this.previewImg.setPosition(center.x, center.y);
                    this.previewImg.setScale(s);
                    this.previewImg.setOrigin(0.5, 0.85);
                    this.previewImg.setAlpha(canAfford ? 0.6 : 0.3);
                    this.previewImg.setVisible(true);
                } else {
                    const sprMap = { arrow: SPR_ARROW_TOWER, cannon: SPR_CANNON_TOWER, ice: SPR_ICE_TOWER };
                    const palMap = { arrow: PAL_ARROW, cannon: PAL_CANNON, ice: PAL_ICE };
                    this.previewGfx.setAlpha(canAfford ? 0.6 : 0.3);
                    drawPixelSprite(this.previewGfx, center.x, center.y, sprMap[this.selectedTowerType], palMap[this.selectedTowerType], PX);
                    this.previewGfx.setAlpha(1);
                }
            }
        });
    }

    // ── 建塔 ──

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
        const towerDepth = row * 10 + 5;

        const tower = {
            type, col, row,
            x: logicalPos.x, y: logicalPos.y,
            sx: screenPos.x, sy: screenPos.y,
            lastFired: 0,
            range: cfg.range, damage: cfg.damage, fireRate: cfg.fireRate,
        };

        // 塔圖像：有圖片用圖片，否則用像素圖
        const imgKeys = { arrow: 'tower_arrow', cannon: null, ice: null };
        let towerObj;
        let finalScale = 1;
        if (imgKeys[type] && this.textures.exists(imgKeys[type])) {
            const img = this.add.image(screenPos.x, screenPos.y, imgKeys[type]).setDepth(towerDepth);
            // 縮放圖片適配格子大小（高度對齊 TILE_H * 2）
            finalScale = (TILE_H * 2) / img.height;
            img.setScale(finalScale);
            // 圖片往上偏移讓塔立在格子上
            img.setOrigin(0.5, 0.85);
            towerObj = img;
        } else {
            const gfx = this.add.graphics().setDepth(towerDepth);
            const sprMap = { arrow: SPR_ARROW_TOWER, cannon: SPR_CANNON_TOWER, ice: SPR_ICE_TOWER };
            const palMap = { arrow: PAL_ARROW, cannon: PAL_CANNON, ice: PAL_ICE };
            drawPixelSprite(gfx, screenPos.x, screenPos.y, sprMap[type], palMap[type], PX);
            towerObj = gfx;
        }

        tower.graphics = towerObj;
        this.towers.push(tower);
        this.updateUI();

        towerObj.setScale(finalScale * 0.3).setAlpha(0.5);
        this.tweens.add({
            targets: towerObj, scaleX: finalScale, scaleY: finalScale, alpha: 1,
            duration: 250, ease: 'Back.easeOut',
        });

        const ring = this.add.graphics().setDepth(towerDepth + 1).setPosition(screenPos.x, screenPos.y);
        ring.lineStyle(2, cfg.colorLight, 0.6);
        ring.strokeCircle(0, 0, 20);
        this.tweens.add({
            targets: ring, scaleX: 3, scaleY: 3, alpha: 0,
            duration: 400, onComplete: () => ring.destroy(),
        });
    }

    // ── 波次 ──

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

    // ── 敵人 ──

    spawnEnemy(data) {
        const start = gridToPixel(PATH_WAYPOINTS[0].col, PATH_WAYPOINTS[0].row);
        const enemy = {
            ...data,
            x: start.x, y: start.y,
            waypointIndex: 1,
            slowTimer: 0,
            alive: true,
        };

        const container = this.add.container(start.x, start.y).setDepth(10);
        const epx = data.isBoss ? 3 : 3;
        const spr = data.isBoss ? SPR_BOSS : SPR_ENEMY;
        const pal = data.isBoss ? PAL_BOSS : PAL_ENEMY;
        const sprH = spr.length * epx;

        // 陰影
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.2);
        const sw = spr[0].length * epx * 0.7;
        shadow.fillEllipse(1, sprH / 2 - 2, sw, sw * 0.35);
        container.add(shadow);

        // 像素風本體
        const body = this.add.graphics();
        drawPixelSprite(body, 0, 0, spr, pal, epx);
        container.add(body);

        // 血量條
        const hpBg = this.add.graphics();
        hpBg.fillStyle(0x000000, 0.5);
        hpBg.fillRoundedRect(-16, -sprH / 2 - 8, 32, 6, 3);
        container.add(hpBg);

        const hpBar = this.add.graphics();
        hpBar.fillStyle(0x4caf50);
        hpBar.fillRoundedRect(-15, -sprH / 2 - 7, 30, 4, 2);
        container.add(hpBar);

        enemy.container = container;
        enemy.hpBar = hpBar;
        enemy.hpBarTop = -sprH / 2 - 7;

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
        const tx = target.col * TILE_W + TILE_W / 2;
        const ty = target.row * TILE_H + TILE_H / 2;
        const dx = tx - enemy.x, dy = ty - enemy.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        const effectiveSpeed = enemy.slowTimer > 0 ? enemy.speed * 0.4 : enemy.speed;
        const move = effectiveSpeed * (delta / 1000);

        if (d <= move) {
            enemy.x = tx; enemy.y = ty;
            enemy.waypointIndex++;
        } else {
            enemy.x += (dx / d) * move;
            enemy.y += (dy / d) * move;
        }

        if (enemy.slowTimer > 0) enemy.slowTimer -= delta;

        enemy.container.setPosition(enemy.x, enemy.y);
        enemy.container.setDepth(Math.floor(enemy.y) + 50);
    }

    damageEnemy(enemy, damage, type) {
        enemy.hp -= damage;

        if (type === 'ice') {
            enemy.slowTimer = 2000;
            const bodyGfx = enemy.container.list[1];
            bodyGfx.clear();
            // 冰凍像素效果
            const icePal = { a: 0x1565c0, b: 0x42a5f5, c: 0x90caf9, d: 0xbbdefb, e: 0xe3f2fd, f: 0xe3f2fd, W: 0xffffff, K: 0x546e7a, R: 0x90caf9, G: 0x90caf9 };
            const spr = enemy.isBoss ? SPR_BOSS : SPR_ENEMY;
            drawPixelSprite(bodyGfx, 0, 0, spr, icePal, 3);
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
        enemy.hpBar.fillRoundedRect(-15, enemy.hpBarTop, 30 * ratio, 4, 2);

        if (enemy.hp <= 0) this.killEnemy(enemy);
    }

    redrawEnemyBody(enemy) {
        const bodyGfx = enemy.container.list[1];
        bodyGfx.clear();
        const spr = enemy.isBoss ? SPR_BOSS : SPR_ENEMY;
        const pal = enemy.isBoss ? PAL_BOSS : PAL_ENEMY;
        drawPixelSprite(bodyGfx, 0, 0, spr, pal, 3);
    }

    killEnemy(enemy) {
        enemy.alive = false;
        this.gold += enemy.reward;
        this.enemiesAlive--;
        this.updateUI();

        const ex = enemy.x, ey = enemy.y;

        const colors = enemy.isBoss
            ? [0xff4081, 0xff80ab, 0xffffff]
            : [0xffeb3b, 0xff9800, 0xffffff];
        colors.forEach((color, i) => {
            const fx = this.add.graphics().setDepth(500);
            fx.fillStyle(color, 0.6 - i * 0.15);
            fx.fillCircle(ex, ey, 10 + i * 5);
            this.tweens.add({
                targets: fx, alpha: 0, scaleX: 2.5, scaleY: 2.5,
                duration: 350 + i * 100, onComplete: () => fx.destroy(),
            });
        });

        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const particle = this.add.graphics().setDepth(500);
            particle.fillStyle(enemy.isBoss ? 0xff4081 : 0xef5350, 0.8);
            particle.fillCircle(0, 0, 1.5 + Math.random() * 1.5);
            particle.setPosition(ex, ey);
            this.tweens.add({
                targets: particle,
                x: ex + Math.cos(angle) * (25 + Math.random() * 15),
                y: ey + Math.sin(angle) * (20 + Math.random() * 10),
                alpha: 0, duration: 350,
                onComplete: () => particle.destroy(),
            });
        }

        const popup = this.add.text(ex, ey - 10, `+${enemy.reward}`, {
            fontSize: '16px', color: '#ffd54f', fontStyle: 'bold',
            stroke: '#5d4037', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(500);

        this.tweens.add({
            targets: popup,
            x: this.goldIconX + 30, y: this.goldIconY,
            alpha: 0.3, scaleX: 0.6, scaleY: 0.6,
            duration: 700, ease: 'Cubic.easeIn',
            onComplete: () => {
                popup.destroy();
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

    // ── 攻擊 ──

    findTarget(tower) {
        let best = null, bestPriority = -1;
        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            const d = dist(tower.x, tower.y, enemy.x, enemy.y);
            if (d > tower.range) continue;
            const wp = PATH_WAYPOINTS[Math.min(enemy.waypointIndex, PATH_WAYPOINTS.length - 1)];
            const distToWp = dist(enemy.x, enemy.y, wp.col * TILE_W + TILE_W / 2, wp.row * TILE_H + TILE_H / 2);
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

        const flash = this.add.graphics().setDepth(500).setPosition(tower.sx, tower.sy);
        flash.fillStyle(cfg.projColor, 0.4);
        flash.fillCircle(0, -12, 6);
        this.tweens.add({
            targets: flash, alpha: 0, scaleX: 2, scaleY: 2,
            duration: 120, onComplete: () => flash.destroy(),
        });
    }

    // ── 投射物 ──

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
        } else {
            proj.x += (dx / d) * move;
            proj.y += (dy / d) * move;
            proj.graphics.setPosition(proj.x, proj.y);
        }
    }

    // ── 主迴圈 ──

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
