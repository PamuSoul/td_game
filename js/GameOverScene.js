// ============================================
// 遊戲結束場景 - 勝利或失敗畫面
// ============================================

class GameOverScene extends Phaser.Scene {
    constructor() {
        super('GameOverScene');
    }

    init(data) {
        this.won = data.won;
        this.finalWave = data.wave;
    }

    create() {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;

        // 背景漸層
        const bg = this.add.graphics();
        for (let i = 0; i < GAME_HEIGHT; i++) {
            const t = i / GAME_HEIGHT;
            if (this.won) {
                const r = Math.floor(0x05 + 0x10 * t);
                const g = Math.floor(0x15 + 0x10 * t);
                const b = Math.floor(0x05 + 0x10 * t);
                bg.fillStyle((r << 16) | (g << 8) | b);
            } else {
                const r = Math.floor(0x15 + 0x10 * t);
                const g = Math.floor(0x05 + 0x08 * t);
                const b = Math.floor(0x05 + 0x10 * t);
                bg.fillStyle((r << 16) | (g << 8) | b);
            }
            bg.fillRect(0, i, GAME_WIDTH, 1);
        }

        // 飄動粒子
        this.particles = [];
        const particleColor = this.won ? 0x4caf50 : 0xef5350;
        for (let i = 0; i < 40; i++) {
            const p = this.add.graphics();
            const size = 1 + Math.random() * 3;
            p.fillStyle(particleColor, 0.15 + Math.random() * 0.3);
            p.fillCircle(0, 0, size);
            p.setPosition(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT);
            this.particles.push({
                gfx: p,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -0.3 - Math.random() * 0.5,
                phase: Math.random() * Math.PI * 2,
            });
        }

        // 大型圖示
        const icon = this.won ? '🏆' : '💀';
        const iconText = this.add.text(cx, cy - 130, icon, {
            fontSize: '72px',
        }).setOrigin(0.5);
        this.tweens.add({
            targets: iconText, y: iconText.y - 8, duration: 2000,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // 結果標題（帶陰影）
        const titleText = this.won ? '勝 利' : '遊 戲 結 束';
        const titleColor = this.won ? '#66bb6a' : '#ef5350';

        this.add.text(cx + 2, cy - 52, titleText, {
            fontSize: '48px', fontStyle: 'bold', color: '#000000',
        }).setOrigin(0.5).setAlpha(0.4);
        this.add.text(cx, cy - 54, titleText, {
            fontSize: '48px', fontStyle: 'bold', color: titleColor,
        }).setOrigin(0.5);

        // 分隔線
        const sep = this.add.graphics();
        sep.lineStyle(1, this.won ? 0x4caf50 : 0xef5350, 0.4);
        sep.lineBetween(cx - 120, cy - 16, cx + 120, cy - 16);

        // 統計資訊
        this.add.text(cx, cy + 10, `最終波數`, {
            fontSize: '16px', color: '#888888',
        }).setOrigin(0.5);

        this.add.text(cx, cy + 42, `${this.finalWave} / ${MAX_WAVES}`, {
            fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);

        // 進度條
        const barWidth = 200;
        const barX = cx - barWidth / 2;
        const barY = cy + 72;
        const progress = this.finalWave / MAX_WAVES;

        const barBg = this.add.graphics();
        barBg.fillStyle(0x333333, 0.5);
        barBg.fillRoundedRect(barX, barY, barWidth, 8, 4);

        const barFill = this.add.graphics();
        barFill.fillStyle(this.won ? 0x4caf50 : 0xef5350);
        barFill.fillRoundedRect(barX, barY, barWidth * progress, 8, 4);

        // 重新開始按鈕
        const btnY = cy + 120;
        const btnGlow = this.add.graphics();
        btnGlow.fillStyle(0x1976d2, 0.15);
        btnGlow.fillRoundedRect(cx - 110, btnY - 4, 220, 52, 26);

        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x1565c0);
        btnBg.fillRoundedRect(cx - 95, btnY, 190, 44, 22);
        btnBg.fillStyle(0x1976d2);
        btnBg.fillRoundedRect(cx - 93, btnY, 186, 38, 20);

        const btnText = this.add.text(cx, btnY + 20, '再 玩 一 次', {
            fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);

        // 按鈕互動
        const hitArea = this.add.rectangle(cx, btnY + 22, 190, 44)
            .setInteractive({ useHandCursor: true }).setAlpha(0.001);

        this.tweens.add({
            targets: btnGlow, alpha: 0.6, duration: 1200,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        hitArea.on('pointerover', () => btnText.setScale(1.05));
        hitArea.on('pointerout', () => btnText.setScale(1));
        hitArea.on('pointerdown', () => this.scene.start('GameScene'));
    }

    update(time) {
        for (const p of this.particles) {
            p.gfx.x += p.vx;
            p.gfx.y += p.vy;
            if (p.gfx.y < -10) {
                p.gfx.y = GAME_HEIGHT + 10;
                p.gfx.x = Math.random() * GAME_WIDTH;
            }
            p.gfx.setAlpha(0.2 + 0.15 * Math.sin(time / 800 + p.phase));
        }
    }
}
