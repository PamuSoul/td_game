// ============================================
// 遊戲啟動 - Phaser 設定與初始化
// ============================================

const config = {
    type: Phaser.AUTO,              // 自動選擇 WebGL 或 Canvas
    width: GAME_WIDTH,              // 畫面寬度
    height: GAME_HEIGHT,            // 畫面高度
    backgroundColor: '#1a1a2e',     // 背景色
    scene: [BootScene, GameScene, GameOverScene], // 場景順序：開始→遊戲→結算
};

// 啟動遊戲
const game = new Phaser.Game(config);
