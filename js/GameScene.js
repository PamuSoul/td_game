// ============================================
// 主遊戲場景 - 2.5D 矩形方塊視角
// ============================================

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
        this.gold = 100;
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
        // 卡片系統：起始各一張（陣列，每張卡是一個 type 字串）
        this.cards = ['arrow', 'cannon', 'ice'];
        this.selectedCardIndex = -1;
        this.cardPickActive = false;
        this.cardObjects = []; // 底部 UI 的卡片物件

        this.buildGrid();
        // 自動裁切所有圖片的透明區域，建立 _trimmed 紋理
        const trimKeys = ['tile_grass', 'tower_arrow', 'tower_cannon', 'tower_ice', 'deco_tree', 'deco_flower'];
        trimKeys.forEach(key => {
            const trimKey = key + '_trimmed';
            if (this.textures.exists(key) && !this.textures.exists(trimKey)) {
                const src = this.textures.get(key).getSourceImage();
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
                    this.textures.addCanvas(trimKey, trimmed);
                }
            }
        });
        this.drawGrid();
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
                this.grid[c][r] = this.pathTiles.has(`${c},${r}`) ? 'path' : 'buildable';
            }
        }
        this.treeGraphics = {}; // 儲存樹木圖像 key: "col,row" → gameObject
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
                    // 草地（全部可建造）
                    if (hasGrassTile) {
                        this.add.image(c * TILE_W, r * TILE_H, 'tile_grass_trimmed')
                            .setOrigin(0, 0).setDepth(r * 10)
                            .setDisplaySize(TILE_W, TILE_H);
                    } else {
                        const ci = (c * 7 + r * 13) % COLORS.grassTop.length;
                        drawBlock(rowGfx, c, r, COLORS.grassTop[ci], COLORS.grassFront[ci]);
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

    growTrees(treeCount) {
        // 每回合隨機在可建造格長樹，不會長在已有塔或已有樹的位置
        const hasTree = this.textures.exists('deco_tree_trimmed');
        const candidates = [];
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (this.grid[c][r] === 'buildable') candidates.push({ c, r });
            }
        }
        const count = treeCount || (2 + Math.floor(Math.random() * 4));
        for (let i = 0; i < count && candidates.length > 0; i++) {
            const idx = Math.floor(Math.random() * candidates.length);
            const { c, r } = candidates.splice(idx, 1)[0];
            this.grid[c][r] = 'tree';

            const cx = c * TILE_W + TILE_W / 2;
            const cy = r * TILE_H + TILE_H / 2;
            const depth = r * 10 + 1;

            let treeObj;
            if (hasTree) {
                treeObj = this.add.image(cx, cy, 'deco_tree_trimmed').setDepth(depth);
                const s = (TILE_H * 1.2) / treeObj.height;
                treeObj.setScale(0).setOrigin(0.5, 0.8);
                this.tweens.add({
                    targets: treeObj, scaleX: s, scaleY: s,
                    duration: 400, ease: 'Back.easeOut',
                });
            } else {
                treeObj = this.add.graphics().setDepth(depth);
                drawPixelSprite(treeObj, cx, cy - 4, SPR_TREE, PAL_TREE, 3);
                treeObj.setScale(0);
                this.tweens.add({
                    targets: treeObj, scaleX: 1, scaleY: 1,
                    duration: 400, ease: 'Back.easeOut',
                });
            }
            this.treeGraphics[`${c},${r}`] = treeObj;
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

        this.renderCards();

        this.nextWaveBg = this.add.graphics().setDepth(200);
        this.drawNextWaveBtn(0xc62828, 0xe53935);
        this.nextWaveText = this.add.text(GAME_WIDTH - 95, uiY + 40, '遊戲開始', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
            padding: { top: 4, bottom: 2 },
        }).setOrigin(0.5).setDepth(201);

        this.nextWaveHit = this.add.rectangle(GAME_WIDTH - 95, uiY + 40, 140, 60)
            .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(202);
        this.nextWaveHit.on('pointerdown', (pointer) => {
            pointer.event.stopPropagation();
            if (this.cardPickActive || this.shopActive) return;
            if (this.waveNumber === 0) {
                this.startWave();
            } else {
                this.showShop();
            }
        });
        this.nextWaveCountdown = null;
        this.shopActive = false;

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

    // ── 卡片選擇 UI ──

    showCardPick() {
        this.cardPickActive = true;
        const allTypes = ['arrow', 'cannon', 'ice'];
        const shuffled = allTypes.sort(() => Math.random() - 0.5);
        const choices = [shuffled[0], shuffled[1]];
        const imgKeys = { arrow: 'tower_arrow_trimmed', cannon: 'tower_cannon_trimmed', ice: 'tower_ice_trimmed' };

        // 半透明遮罩
        const overlay = this.add.graphics().setDepth(1000);
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        const centerX = GAME_WIDTH / 2;
        const centerY = PLAYFIELD_H / 2;

        const title = this.add.text(centerX, centerY - 120, '選擇一張卡片', {
            fontSize: '28px', color: '#ffd54f', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(1001);

        const cardElements = [];
        cardElements.push(overlay, title);

        const PICK_W = 120, PICK_H = 160;

        choices.forEach((type, i) => {
            const cfg = TOWER_TYPES[type];
            const cx = centerX + (i === 0 ? -80 : 80);
            const cy = centerY + 10;

            // 卡片背景
            const cardBg = this.add.graphics().setDepth(1001);
            cardBg.fillStyle(0x2a2a4a, 0.95);
            cardBg.fillRoundedRect(cx - PICK_W / 2, cy - PICK_H / 2, PICK_W, PICK_H, 10);
            cardBg.lineStyle(2, cfg.colorLight, 0.8);
            cardBg.strokeRoundedRect(cx - PICK_W / 2, cy - PICK_H / 2, PICK_W, PICK_H, 10);

            // 塔圖像
            const imgKey = imgKeys[type];
            if (imgKey && this.textures.exists(imgKey)) {
                const img = this.add.image(cx, cy, imgKey).setDepth(1002);
                const s = (PICK_H - 24) / img.height;
                img.setScale(s);
                cardElements.push(img);
            }

            // 點擊區域
            const hitArea = this.add.rectangle(cx, cy, PICK_W, PICK_H)
                .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(1003);

            hitArea.on('pointerover', () => {
                cardBg.clear();
                cardBg.fillStyle(0x1b5e20, 0.95);
                cardBg.fillRoundedRect(cx - PICK_W / 2, cy - PICK_H / 2, PICK_W, PICK_H, 10);
                cardBg.lineStyle(3, 0x4caf50, 1);
                cardBg.strokeRoundedRect(cx - PICK_W / 2, cy - PICK_H / 2, PICK_W, PICK_H, 10);
            });
            hitArea.on('pointerout', () => {
                cardBg.clear();
                cardBg.fillStyle(0x2a2a4a, 0.95);
                cardBg.fillRoundedRect(cx - PICK_W / 2, cy - PICK_H / 2, PICK_W, PICK_H, 10);
                cardBg.lineStyle(2, cfg.colorLight, 0.8);
                cardBg.strokeRoundedRect(cx - PICK_W / 2, cy - PICK_H / 2, PICK_W, PICK_H, 10);
            });

            hitArea.on('pointerdown', (pointer) => {
                pointer.event.stopPropagation();
                this.cards.push(type);
                this.cardPickActive = false;
                cardElements.forEach(el => el.destroy());
                this.nextWaveCountdown = 5000;
                this.updateUI();
                this.renderCards();
            });

            cardElements.push(cardBg, hitArea);
        });
    }

    // ── 商店 UI ──

    showShop() {
        this.shopActive = true;
        const shopElements = [];

        // 遮罩
        const overlay = this.add.graphics().setDepth(1000);
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        shopElements.push(overlay);

        const centerX = GAME_WIDTH / 2;
        const centerY = PLAYFIELD_H / 2;

        const title = this.add.text(centerX, centerY - 140, '商店', {
            fontSize: '30px', color: '#ffd54f', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(1001);
        shopElements.push(title);

        // 金幣顯示
        const goldLabel = this.add.text(centerX, centerY - 105, `💰 ${this.gold}`, {
            fontSize: '18px', color: '#ffd54f', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1001);
        shopElements.push(goldLabel);

        const closeShop = () => {
            this.shopActive = false;
            shopElements.forEach(el => el.destroy());
        };

        // ── 購買卡片按鈕 ──
        const buyBtnY = centerY - 40;
        const buyBg = this.add.graphics().setDepth(1001);
        buyBg.fillStyle(0x2a2a4a, 0.95);
        buyBg.fillRoundedRect(centerX - 140, buyBtnY - 30, 280, 60, 10);
        buyBg.lineStyle(2, 0x4caf50, 0.8);
        buyBg.strokeRoundedRect(centerX - 140, buyBtnY - 30, 280, 60, 10);
        shopElements.push(buyBg);

        const buyText = this.add.text(centerX, buyBtnY, '購買卡片', {
            fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1002);
        shopElements.push(buyText);

        const buyHit = this.add.rectangle(centerX, buyBtnY, 280, 60)
            .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(1003);
        buyHit.on('pointerover', () => {
            buyBg.clear();
            buyBg.fillStyle(0x1b5e20, 0.95);
            buyBg.fillRoundedRect(centerX - 140, buyBtnY - 30, 280, 60, 10);
            buyBg.lineStyle(2, 0x4caf50, 1);
            buyBg.strokeRoundedRect(centerX - 140, buyBtnY - 30, 280, 60, 10);
        });
        buyHit.on('pointerout', () => {
            buyBg.clear();
            buyBg.fillStyle(0x2a2a4a, 0.95);
            buyBg.fillRoundedRect(centerX - 140, buyBtnY - 30, 280, 60, 10);
            buyBg.lineStyle(2, 0x4caf50, 0.8);
            buyBg.strokeRoundedRect(centerX - 140, buyBtnY - 30, 280, 60, 10);
        });
        buyHit.on('pointerdown', (pointer) => {
            pointer.event.stopPropagation();
            closeShop();
            this.showBuyCards();
        });
        shopElements.push(buyHit);

        // ── 抽取卡包按鈕 ──
        const drawBtnY = centerY + 40;
        const drawBg = this.add.graphics().setDepth(1001);
        drawBg.fillStyle(0x2a2a4a, 0.95);
        drawBg.fillRoundedRect(centerX - 140, drawBtnY - 30, 280, 60, 10);
        drawBg.lineStyle(2, 0xffa726, 0.8);
        drawBg.strokeRoundedRect(centerX - 140, drawBtnY - 30, 280, 60, 10);
        shopElements.push(drawBg);

        const packCost = 80;
        const drawText = this.add.text(centerX, drawBtnY, `抽取卡包  💰${packCost}`, {
            fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1002);
        shopElements.push(drawText);

        const drawHit = this.add.rectangle(centerX, drawBtnY, 280, 60)
            .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(1003);
        drawHit.on('pointerover', () => {
            drawBg.clear();
            drawBg.fillStyle(0x4e342e, 0.95);
            drawBg.fillRoundedRect(centerX - 140, drawBtnY - 30, 280, 60, 10);
            drawBg.lineStyle(2, 0xffa726, 1);
            drawBg.strokeRoundedRect(centerX - 140, drawBtnY - 30, 280, 60, 10);
        });
        drawHit.on('pointerout', () => {
            drawBg.clear();
            drawBg.fillStyle(0x2a2a4a, 0.95);
            drawBg.fillRoundedRect(centerX - 140, drawBtnY - 30, 280, 60, 10);
            drawBg.lineStyle(2, 0xffa726, 0.8);
            drawBg.strokeRoundedRect(centerX - 140, drawBtnY - 30, 280, 60, 10);
        });
        drawHit.on('pointerdown', (pointer) => {
            pointer.event.stopPropagation();
            if (this.gold < packCost) {
                this.showMessage('金幣不足！', 800);
                return;
            }
            this.gold -= packCost;
            const allTypes = ['arrow', 'cannon', 'ice'];
            const count = 1 + Math.floor(Math.random() * 5);
            for (let i = 0; i < count; i++) {
                this.cards.push(allTypes[Math.floor(Math.random() * 3)]);
            }
            closeShop();
            this.showMessage(`抽到 ${count} 張卡片！`, 1500);
            this.updateUI();
            this.renderCards();
        });
        shopElements.push(drawHit);

        // ── 關閉按鈕 ──
        const closeBtnY = centerY + 110;
        const closeBg = this.add.graphics().setDepth(1001);
        closeBg.fillStyle(0x424242, 0.9);
        closeBg.fillRoundedRect(centerX - 60, closeBtnY - 20, 120, 40, 8);
        shopElements.push(closeBg);

        const closeText = this.add.text(centerX, closeBtnY, '關閉', {
            fontSize: '18px', color: '#cccccc', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1002);
        shopElements.push(closeText);

        const closeHit = this.add.rectangle(centerX, closeBtnY, 120, 40)
            .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(1003);
        closeHit.on('pointerdown', (pointer) => {
            pointer.event.stopPropagation();
            closeShop();
        });
        shopElements.push(closeHit);
    }

    showBuyCards() {
        this.shopActive = true;
        const buyElements = [];

        const overlay = this.add.graphics().setDepth(1000);
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        buyElements.push(overlay);

        const centerX = GAME_WIDTH / 2;
        const centerY = PLAYFIELD_H / 2;

        const title = this.add.text(centerX, centerY - 130, '購買卡片', {
            fontSize: '28px', color: '#ffd54f', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(1001);
        buyElements.push(title);

        const goldLabel = this.add.text(centerX, centerY - 95, `💰 ${this.gold}`, {
            fontSize: '18px', color: '#ffd54f', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1001);
        buyElements.push(goldLabel);

        const closeBuy = () => {
            this.shopActive = false;
            buyElements.forEach(el => el.destroy());
            this.updateUI();
            this.renderCards();
        };

        const types = ['arrow', 'cannon', 'ice'];
        const imgKeys = { arrow: 'tower_arrow_trimmed', cannon: 'tower_cannon_trimmed', ice: 'tower_ice_trimmed' };
        const CARD_W = 120, CARD_H = 160;

        types.forEach((type, i) => {
            const cfg = TOWER_TYPES[type];
            const cx = centerX + (i - 1) * 140;
            const cy = centerY + 20;

            const cardBg = this.add.graphics().setDepth(1001);
            const canBuy = this.gold >= cfg.cost;
            cardBg.fillStyle(canBuy ? 0x2a2a4a : 0x1a1a2e, 0.95);
            cardBg.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 10);
            cardBg.lineStyle(2, canBuy ? cfg.colorLight : 0x444444, 0.8);
            cardBg.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 10);
            buyElements.push(cardBg);

            // 塔圖像
            const imgKey = imgKeys[type];
            if (imgKey && this.textures.exists(imgKey)) {
                const img = this.add.image(cx, cy - 15, imgKey).setDepth(1002);
                const s = (CARD_H - 60) / img.height;
                img.setScale(s);
                if (!canBuy) img.setAlpha(0.4);
                buyElements.push(img);
            }

            // 價格
            const priceText = this.add.text(cx, cy + CARD_H / 2 - 25, `💰 ${cfg.cost}`, {
                fontSize: '16px', color: canBuy ? '#ffd54f' : '#666666', fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(1002);
            buyElements.push(priceText);

            // 點擊
            const hitArea = this.add.rectangle(cx, cy, CARD_W, CARD_H)
                .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(1003);
            hitArea.on('pointerover', () => {
                if (this.gold >= cfg.cost) {
                    cardBg.clear();
                    cardBg.fillStyle(0x1b5e20, 0.95);
                    cardBg.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 10);
                    cardBg.lineStyle(3, 0x4caf50, 1);
                    cardBg.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 10);
                }
            });
            hitArea.on('pointerout', () => {
                const cb = this.gold >= cfg.cost;
                cardBg.clear();
                cardBg.fillStyle(cb ? 0x2a2a4a : 0x1a1a2e, 0.95);
                cardBg.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 10);
                cardBg.lineStyle(2, cb ? cfg.colorLight : 0x444444, 0.8);
                cardBg.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 10);
            });
            hitArea.on('pointerdown', (pointer) => {
                pointer.event.stopPropagation();
                if (this.gold < cfg.cost) {
                    this.showMessage('金幣不足！', 800);
                    return;
                }
                this.gold -= cfg.cost;
                this.cards.push(type);
                closeBuy();
                this.showMessage(`購買了 ${cfg.name}！`, 1000);
            });
            buyElements.push(hitArea);
        });

        // 返回按鈕
        const backY = centerY + CARD_H / 2 + 40;
        const backBg = this.add.graphics().setDepth(1001);
        backBg.fillStyle(0x424242, 0.9);
        backBg.fillRoundedRect(centerX - 60, backY - 20, 120, 40, 8);
        buyElements.push(backBg);

        const backText = this.add.text(centerX, backY, '返回', {
            fontSize: '18px', color: '#cccccc', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1002);
        buyElements.push(backText);

        const backHit = this.add.rectangle(centerX, backY, 120, 40)
            .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(1003);
        backHit.on('pointerdown', (pointer) => {
            pointer.event.stopPropagation();
            closeBuy();
            this.showShop();
        });
        buyElements.push(backHit);
    }

    showMessage(text, duration = 1500) {
        this.msgText.setText(text).setAlpha(1);
        this.tweens.add({ targets: this.msgText, alpha: 0, duration: 400, delay: duration - 400 });
    }

    selectCard(index) {
        if (this.selectedCardIndex === index) {
            this.selectedCardIndex = -1;
            this.selectedTowerType = null;
        } else {
            this.selectedCardIndex = index;
            this.selectedTowerType = this.cards[index];
        }
        this.renderCards();
    }

    renderCards() {
        // 清除舊卡片
        this.cardObjects.forEach(obj => obj.destroy());
        this.cardObjects = [];

        const CARD_W = 48, CARD_H = 66, GAP = 6;
        const uiY = PLAYFIELD_H;
        const startX = 220;
        const cardY = uiY + UI_HEIGHT / 2;
        const imgKeys = { arrow: 'tower_arrow_trimmed', cannon: 'tower_cannon_trimmed', ice: 'tower_ice_trimmed' };

        this.cards.forEach((type, i) => {
            const cx = startX + i * (CARD_W + GAP) + CARD_W / 2;
            const cy = cardY;
            const selected = (i === this.selectedCardIndex);
            const cfg = TOWER_TYPES[type];

            // 卡片背景
            const bg = this.add.graphics().setDepth(200);
            if (selected) {
                bg.fillStyle(0x1b5e20, 0.95);
                bg.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2 - 2, CARD_W, CARD_H, 6);
                bg.lineStyle(2, 0x4caf50, 1);
                bg.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2 - 2, CARD_W, CARD_H, 6);
            } else {
                bg.fillStyle(0x2a2a4a, 0.9);
                bg.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 6);
                bg.lineStyle(1, cfg.colorLight, 0.5);
                bg.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 6);
            }
            this.cardObjects.push(bg);

            // 塔圖像
            const imgKey = imgKeys[type];
            if (imgKey && this.textures.exists(imgKey)) {
                const img = this.add.image(cx, cy - 2, imgKey).setDepth(201);
                const s = (CARD_H - 14) / img.height;
                img.setScale(s);
                this.cardObjects.push(img);
            }

            // 點擊區域
            const hitArea = this.add.rectangle(cx, cy, CARD_W, CARD_H)
                .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(202);
            const idx = i;
            hitArea.on('pointerdown', (pointer) => {
                pointer.event.stopPropagation();
                this.selectCard(idx);
            });
            this.cardObjects.push(hitArea);
        });
    }

    updateUI() {
        this.goldText.setText(`💰 ${this.gold}`);
        this.livesText.setText(`❤️ ${this.lives}`);
        this.waveText.setText(`波數 ${this.waveNumber} / ${MAX_WAVES}`);

        if (this.waveNumber === 0) {
            // 遊戲開始按鈕
            this.nextWaveBg.setVisible(true);
            this.nextWaveText.setVisible(true);
            this.nextWaveHit.setVisible(true);
            this.drawNextWaveBtn(0xc62828, 0xe53935);
            this.nextWaveText.setText('遊戲開始');
            this.nextWaveText.setColor('#ffffff');
        } else {
            // 遊戲開始後，商店按鈕常駐（戰鬥中也能用）
            this.nextWaveBg.setVisible(true);
            this.nextWaveText.setVisible(true);
            this.nextWaveHit.setVisible(true);
            this.drawNextWaveBtn(0x1565c0, 0x1e88e5);
            this.nextWaveText.setText('商店');
            this.nextWaveText.setColor('#ffffff');
        }
    }

    // ── 輸入 ──

    setupInput() {
        this.input.on('pointerdown', (pointer) => {
            if (this.cardPickActive || this.shopActive) return;
            if (pointer.y >= PLAYFIELD_H) return;
            const { col, row } = screenToGrid(pointer.x, pointer.y);
            if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

            // 點擊已有的塔 → 升級
            if (this.grid[col][row] === 'tower') {
                const tower = this.towers.find(t => t.col === col && t.row === row);
                if (tower) this.upgradeTower(tower);
                return;
            }

            if (!this.selectedTowerType) return;
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
            const canAfford = this.selectedCardIndex >= 0;

            if (valid) {
                const color = canAfford ? 0x4caf50 : 0xef5350;
                this.previewGfx.lineStyle(2, color, 0.3);
                this.previewGfx.strokeCircle(center.x, center.y, cfg.range);
                this.previewGfx.fillStyle(color, 0.08);
                this.previewGfx.fillCircle(center.x, center.y, cfg.range);

                // 預覽塔圖像
                const imgKeys = { arrow: 'tower_arrow_trimmed', cannon: 'tower_cannon_trimmed', ice: 'tower_ice_trimmed' };
                const imgKey = imgKeys[this.selectedTowerType];
                if (imgKey && this.textures.exists(imgKey)) {
                    if (!this.previewImg || this.previewImg.texture.key !== imgKey) {
                        if (this.previewImg) this.previewImg.destroy();
                        this.previewImg = this.add.image(0, 0, imgKey).setDepth(901);
                    }
                    let s = (TILE_H * 2) / this.previewImg.height * 0.7;
                    if (this.selectedTowerType === 'cannon') s *= 0.85;
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
        if (this.selectedCardIndex < 0 || this.selectedCardIndex >= this.cards.length) {
            return;
        }

        this.cards.splice(this.selectedCardIndex, 1);
        this.selectedCardIndex = -1;
        this.selectedTowerType = null;
        this.grid[col][row] = 'tower';

        const cfg = TOWER_TYPES[type];
        const logicalPos = gridToPixel(col, row);
        const screenPos = gridCenterToScreen(col, row);
        const towerDepth = row * 10 + 5;

        const tower = {
            type, col, row,
            x: logicalPos.x, y: logicalPos.y,
            sx: screenPos.x, sy: screenPos.y,
            lastFired: 0,
            level: 1,
            range: cfg.range, damage: cfg.damage, fireRate: cfg.fireRate,
        };

        // 塔圖像：有圖片用圖片，否則用像素圖
        const imgKeys = { arrow: 'tower_arrow_trimmed', cannon: 'tower_cannon_trimmed', ice: 'tower_ice_trimmed' };
        let towerObj;
        let baseScale = this.textures.exists(imgKeys[type])
            ? (TILE_H * 2) / this.textures.get(imgKeys[type]).getSourceImage().height : 1;
        if (type === 'cannon') baseScale *= 0.85; // 砲塔原圖較大，縮小一些
        const levelScales = [0.7, 0.85, 1.0]; // 三階段大小
        const finalScale = baseScale * levelScales[0];

        if (imgKeys[type] && this.textures.exists(imgKeys[type])) {
            const img = this.add.image(screenPos.x, screenPos.y, imgKeys[type]).setDepth(towerDepth);
            img.setScale(finalScale);
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
        tower.baseScale = baseScale;
        this.towers.push(tower);
        this.updateUI();
        this.renderCards();

        towerObj.setScale(finalScale * 0.3).setAlpha(0.5);
        this.tweens.add({
            targets: towerObj, scaleX: finalScale, scaleY: finalScale, alpha: 1,
            duration: 250, ease: 'Back.easeOut',
        });
    }

    upgradeTower(tower) {
        if (tower.level >= 3) return;
        // 必須選擇與塔相同類型的卡片才能升級
        if (this.selectedCardIndex < 0 || this.selectedCardIndex >= this.cards.length) {
            this.showMessage('請先選擇卡片！', 800);
            return;
        }
        if (this.cards[this.selectedCardIndex] !== tower.type) {
            this.showMessage('卡片類型不符！', 800);
            return;
        }
        this.cards.splice(this.selectedCardIndex, 1);
        this.selectedCardIndex = -1;
        this.selectedTowerType = null;
        tower.level++;
        // 提升攻擊力（每級 +50%）
        const cfg = TOWER_TYPES[tower.type];
        tower.damage = Math.floor(cfg.damage * (1 + (tower.level - 1) * 0.5));
        tower.range = cfg.range + (tower.level - 1) * 15;
        tower.fireRate = Math.max(cfg.fireRate * 0.7, cfg.fireRate - (tower.level - 1) * 100);

        // 放大圖片到對應階段
        const levelScales = [0.7, 0.85, 1.0];
        const newScale = tower.baseScale * levelScales[tower.level - 1];
        this.tweens.add({
            targets: tower.graphics,
            scaleX: newScale, scaleY: newScale,
            duration: 300, ease: 'Back.easeOut',
        });

        this.showMessage(`升級到 Lv${tower.level}！`, 1000);
        this.updateUI();
        this.renderCards();
    }

    // ── 波次 ──

    startWave() {
        if (this.waveActive) return;
        this.waveNumber++;
        this.waveActive = true;
        this.growTrees(this.waveNumber === 1 ? 15 + Math.floor(Math.random() * 6) : undefined);
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

        // 金幣飛向左下角
        const popup = this.add.text(ex, ey - 10, `+${enemy.reward}`, {
            fontSize: '16px', color: '#ffd54f', fontStyle: 'bold',
            stroke: '#5d4037', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(500);
        this.tweens.add({
            targets: popup,
            x: this.goldIconX + 30, y: this.goldIconY,
            alpha: 0.3, scaleX: 0.6, scaleY: 0.6,
            duration: 700, ease: 'Cubic.easeIn',
            onComplete: () => popup.destroy(),
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

        // 子彈從塔圖的中間偏上方射出
        const fireOffsetY = -TILE_H * 0.6;
        const fireX = tower.sx;
        const fireY = tower.sy + fireOffsetY;

        const gfx = this.add.graphics().setDepth(500);
        const projSize = tower.type === 'cannon' ? 5 : 3;
        gfx.fillStyle(cfg.projTrail, 0.3);
        gfx.fillCircle(0, 0, projSize + 3);
        gfx.fillStyle(cfg.projColor);
        gfx.fillCircle(0, 0, projSize);
        gfx.fillStyle(0xffffff, 0.6);
        gfx.fillCircle(-1, -1, projSize * 0.4);
        gfx.setPosition(fireX, fireY);

        this.projectiles.push({
            x: fireX, y: fireY,
            target, speed: 350,
            damage: tower.damage, type: tower.type,
            graphics: gfx, alive: true,
        });

        const flash = this.add.graphics().setDepth(500).setPosition(fireX, fireY);
        flash.fillStyle(cfg.projColor, 0.4);
        flash.fillCircle(0, 0, 6);
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
            if (this.waveNumber >= MAX_WAVES) {
                this.updateUI();
                this.time.delayedCall(1000, () => {
                    this.scene.start('GameOverScene', { won: true, wave: this.waveNumber });
                });
            } else {
                // 波次完成，顯示卡片選擇，選完後 5 秒自動出波
                this.showMessage(`第 ${this.waveNumber} 波完成！`, 2000);
                this.time.delayedCall(800, () => {
                    this.showCardPick();
                });
                this.updateUI();
            }
        }

        // 倒數計時自動出波（不顯示倒數）
        if (this.nextWaveCountdown !== null) {
            this.nextWaveCountdown -= delta;
            if (this.nextWaveCountdown <= 0) {
                this.nextWaveCountdown = null;
                this.startWave();
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
