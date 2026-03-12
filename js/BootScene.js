// ============================================
// 開始畫面場景 - 標題與遊戲說明
// ============================================

class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        this.load.image('tower_arrow', 'assets/箭塔.png');
        this.load.image('tower_cannon', 'assets/砲塔.png');
        this.load.image('tower_ice', 'assets/冰塔.png');
        this.load.image('tile_grass', 'assets/草地地磚.png');
        this.load.image('deco_tree', 'assets/樹.png');
        this.load.image('deco_flower', 'assets/花.png');
    }

    create() {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;

        // 深色漸層背景
        const bg = this.add.graphics();
        for (let i = 0; i < GAME_HEIGHT; i++) {
            const t = i / GAME_HEIGHT;
            const r = Math.floor(0x0a + (0x1a - 0x0a) * t);
            const g = Math.floor(0x0a + (0x1a - 0x0a) * t);
            const b = Math.floor(0x1a + (0x3e - 0x1a) * t);
            bg.fillStyle((r << 16) | (g << 8) | b);
            bg.fillRect(0, i, GAME_WIDTH, 1);
        }

        // 背景飄動粒子（星光效果）
        this.particles = [];
        for (let i = 0; i < 60; i++) {
            const star = this.add.graphics();
            const size = 1 + Math.random() * 2;
            const alpha = 0.2 + Math.random() * 0.5;
            star.fillStyle(0xffffff, alpha);
            star.fillCircle(0, 0, size);
            star.setPosition(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT);
            this.particles.push({
                gfx: star,
                speed: 0.2 + Math.random() * 0.5,
                baseAlpha: alpha,
                phase: Math.random() * Math.PI * 2,
            });
        }

        // 裝飾線條
        const deco = this.add.graphics();
        deco.lineStyle(1, 0x4a4a7a, 0.3);
        for (let x = 0; x < GAME_WIDTH; x += 80) {
            deco.lineBetween(x, 0, x, GAME_HEIGHT);
        }
        for (let y = 0; y < GAME_HEIGHT; y += 80) {
            deco.lineBetween(0, y, GAME_WIDTH, y);
        }

        // 裁切圖片透明區域（供主頁展示用）
        ['tower_arrow', 'tower_cannon', 'tower_ice'].forEach(key => {
            const tk = key + '_trimmed';
            if (this.textures.exists(key) && !this.textures.exists(tk)) {
                const src = this.textures.get(key).getSourceImage();
                const cv = document.createElement('canvas');
                cv.width = src.width; cv.height = src.height;
                const ctx = cv.getContext('2d');
                ctx.drawImage(src, 0, 0);
                const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
                let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
                for (let y = 0; y < cv.height; y++)
                    for (let x = 0; x < cv.width; x++)
                        if (d[(y * cv.width + x) * 4 + 3] > 10) {
                            if (x < x0) x0 = x; if (x > x1) x1 = x;
                            if (y < y0) y0 = y; if (y > y1) y1 = y;
                        }
                if (x1 > x0 && y1 > y0) {
                    const tw = x1 - x0 + 1, th = y1 - y0 + 1;
                    const t = document.createElement('canvas');
                    t.width = tw; t.height = th;
                    t.getContext('2d').drawImage(cv, x0, y0, tw, th, 0, 0, tw, th);
                    this.textures.addCanvas(tk, t);
                }
            }
        });

        // 城堡圖示（用圖形繪製）
        this.drawCastle(cx, cy - 140);

        // 遊戲標題（帶陰影）
        this.add.text(cx + 2, cy - 42, '守 塔 遊 戲', {
            fontSize: '52px', fontFamily: 'Arial, sans-serif', color: '#000000',
            padding: { top: 6, bottom: 2 },
        }).setOrigin(0.5).setAlpha(0.4);
        const title = this.add.text(cx, cy - 44, '守 塔 遊 戲', {
            fontSize: '52px', fontFamily: 'Arial, sans-serif', color: '#f0e6d0',
            fontStyle: 'bold', padding: { top: 6, bottom: 2 },
        }).setOrigin(0.5);

        // 標題緩慢浮動動畫
        this.tweens.add({
            targets: title, y: title.y - 6, duration: 2000,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // 副標題
        this.add.text(cx, cy + 10, 'TOWER DEFENSE', {
            fontSize: '16px', fontFamily: 'Arial', color: '#7a7aaa',
            letterSpacing: 8,
        }).setOrigin(0.5);

        // 分隔線
        const sep = this.add.graphics();
        sep.lineStyle(1, 0x5a5a8a, 0.5);
        sep.lineBetween(cx - 160, cy + 36, cx + 160, cy + 36);
        sep.fillStyle(0x8a8abf, 0.8);
        sep.fillCircle(cx, cy + 36, 3);

        // 開始按鈕（帶光暈）
        const btnY = cy + 80;
        const btnGlow = this.add.graphics();
        btnGlow.fillStyle(0xe74c3c, 0.15);
        btnGlow.fillRoundedRect(cx - 120, btnY - 26, 240, 56, 28);

        const btnBg = this.add.graphics();
        btnBg.fillStyle(0xc0392b);
        btnBg.fillRoundedRect(cx - 100, btnY - 20, 200, 44, 22);
        btnBg.fillStyle(0xe74c3c);
        btnBg.fillRoundedRect(cx - 98, btnY - 20, 196, 38, 20);

        const btnText = this.add.text(cx, btnY, '開 始 遊 戲', {
            fontSize: '24px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
            padding: { top: 4, bottom: 2 },
        }).setOrigin(0.5);

        // 按鈕互動區域
        const hitArea = this.add.rectangle(cx, btnY, 200, 44).setInteractive({ useHandCursor: true });
        hitArea.setAlpha(0.001);

        // 按鈕呼吸動畫
        this.tweens.add({
            targets: [btnGlow], alpha: 0.6, duration: 1200,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        hitArea.on('pointerover', () => {
            btnText.setScale(1.05);
        });
        hitArea.on('pointerout', () => {
            btnText.setScale(1);
        });
        hitArea.on('pointerdown', () => this.scene.start('GameScene'));
    }

    /** 繪製簡易城堡圖案 */
    drawCastle(x, y) {
        const g = this.add.graphics();
        // 城牆
        g.fillStyle(0x5a5a7a);
        g.fillRect(x - 30, y - 10, 60, 30);
        // 城垛
        g.fillRect(x - 34, y - 20, 12, 14);
        g.fillRect(x - 10, y - 20, 12, 14);
        g.fillRect(x + 14, y - 20, 12, 14);
        // 門
        g.fillStyle(0x3a3a5a);
        g.fillRect(x - 8, y + 2, 16, 18);
        // 旗幟
        g.fillStyle(0xe74c3c);
        g.fillTriangle(x + 2, y - 38, x + 2, y - 24, x + 16, y - 31);
        g.lineStyle(2, 0x8a8aaa);
        g.lineBetween(x + 2, y - 40, x + 2, y - 20);
    }

    update(time) {
        // 背景星光閃爍
        for (const p of this.particles) {
            p.gfx.y -= p.speed;
            if (p.gfx.y < -10) p.gfx.y = GAME_HEIGHT + 10;
            const flicker = 0.5 + 0.5 * Math.sin(time / 1000 + p.phase);
            p.gfx.setAlpha(p.baseAlpha * flicker);
        }
    }
}
