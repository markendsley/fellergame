// GameOverScene: Game over screen
class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data) {
    // Dark background
    this.add.rectangle(400, 300, 800, 600, 0x0a0a0a).setDepth(0);

    // Game Over text
    this.add.text(400, 200, 'GAME OVER', {
      fontSize: '72px',
      fontFamily: 'monospace',
      color: '#ff3333',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1);

    // Restart button
    const restartText = this.add.text(400, 380, 'CLICK TO PLAY AGAIN', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#4ecca3'
    }).setOrigin(0.5).setDepth(1);

    // Blinking effect
    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Click handler
    this.input.on('gameobjectdown', () => {
      this.scene.stop('GameScene');
      this.scene.restart();
    });

    // Make entire screen clickable
    const hitZone = this.add.rectangle(400, 300, 800, 600, 1, 0).setDepth(2);
    hitZone.setInteractive();
    hitZone.on('pointerdown', () => {
      this.scene.stop('GameScene');
      this.scene.restart();
    });
  }
}