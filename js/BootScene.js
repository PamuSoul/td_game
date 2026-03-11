// ============================================
// 開始畫面場景 - 標題與遊戲說明
// ============================================

class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        this.load.image('tower_arrow', 'assets/Arrow_Tower.png');
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

        // 城堡圖示（用圖形繪製）
        this.drawCastle(cx, cy - 180);

        // 遊戲標題（帶陰影）
        this.add.text(cx + 2, cy - 82, '守 塔 遊 戲', {
            fontSize: '52px', fontFamily: 'Arial, sans-serif', color: '#000000',
            padding: { top: 6, bottom: 2 },
        }).setOrigin(0.5).setAlpha(0.4);
        const title = this.add.text(cx, cy - 84, '守 塔 遊 戲', {
            fontSize: '52px', fontFamily: 'Arial, sans-serif', color: '#f0e6d0',
            fontStyle: 'bold', padding: { top: 6, bottom: 2 },
        }).setOrigin(0.5);

        // 標題緩慢浮動動畫
        this.tweens.add({
            targets: title, y: title.y - 6, duration: 2000,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // 副標題
        this.add.text(cx, cy - 30, 'TOWER DEFENSE', {
            fontSize: '16px', fontFamily: 'Arial', color: '#7a7aaa',
            letterSpacing: 8,
        }).setOrigin(0.5);

        // 分隔線
        const sep = this.add.graphics();
        sep.lineStyle(1, 0x5a5a8a, 0.5);
        sep.lineBetween(cx - 160, cy, cx + 160, cy);
        sep.fillStyle(0x8a8abf, 0.8);
        sep.fillCircle(cx, cy, 3);

        // 遊戲說明
        this.add.text(cx, cy + 30, '敵人會沿著路徑前進\n在路徑旁建造防禦塔來消滅他們！', {
            fontSize: '18px', fontFamily: 'Arial', color: '#b0b0cc',
            align: 'center', lineSpacing: 8, padding: { top: 4, bottom: 2 },
        }).setOrigin(0.5);

        // 塔的介紹卡片
        const cardY = cy + 100;
        const cards = [
            { icon: '🏹', name: '箭塔', desc: '攻速快', color: '#4caf50' },
            { icon: '💣', name: '砲塔', desc: '高傷害', color: '#ff9800' },
            { icon: '❄️', name: '冰塔', desc: '可減速', color: '#42a5f5' },
        ];
        cards.forEach((card, i) => {
            const cardX = cx - 180 + i * 180;
            const cg = this.add.graphics();
            cg.fillStyle(0x2a2a4a, 0.8);
            cg.fillRoundedRect(cardX - 60, cardY - 20, 120, 50, 8);
            cg.lineStyle(1, 0x4a4a7a, 0.6);
            cg.strokeRoundedRect(cardX - 60, cardY - 20, 120, 50, 8);

            this.add.text(cardX, cardY - 2, `${card.icon} ${card.name}`, {
                fontSize: '16px', color: card.color, fontStyle: 'bold',
                padding: { top: 4, bottom: 2 },
            }).setOrigin(0.5);
            this.add.text(cardX, cardY + 18, card.desc, {
                fontSize: '12px', color: '#999999',
                padding: { top: 2 },
            }).setOrigin(0.5);
        });

        // 開始按鈕（帶光暈）
        const btnGlow = this.add.graphics();
        btnGlow.fillStyle(0xe74c3c, 0.15);
        btnGlow.fillRoundedRect(cx - 120, cy + 168, 240, 56, 28);

        const btnBg = this.add.graphics();
        btnBg.fillStyle(0xc0392b);
        btnBg.fillRoundedRect(cx - 100, cy + 174, 200, 44, 22);
        btnBg.fillStyle(0xe74c3c);
        btnBg.fillRoundedRect(cx - 98, cy + 174, 196, 38, 20);

        const btnText = this.add.text(cx, cy + 192, '開 始 遊 戲', {
            fontSize: '24px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
            padding: { top: 4, bottom: 2 },
        }).setOrigin(0.5);

        // 按鈕互動區域
        const hitArea = this.add.rectangle(cx, cy + 194, 200, 44).setInteractive({ useHandCursor: true });
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
