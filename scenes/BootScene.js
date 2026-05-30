// BootScene: Initial boot/loading screen
class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Load the ship.png image from the FellerGame folder
        this.load.image('ship', 'images/ship.png');

        // Create a white pixel texture for stars
        const starGraphics = this.make.graphics({ x: 0, y: 0, size: 1 });
        starGraphics.fillStyle(0xffffff, 1);
        starGraphics.fillRect(0, 0, 1, 1);
        starGraphics.generateTexture('star', 1, 1);

        // Create a green health bar texture (4x8 pixels)
        const healthGraphics = this.make.graphics({ x: 0, y: 0, size: 4, height: 8 });
        healthGraphics.fillStyle(0x44ff44, 1);
        healthGraphics.fillRect(0, 0, 4, 8);
        healthGraphics.generateTexture('health', 4, 8);

        // Load enemy images
        this.load.image('enemy', 'enemy.png');
        this.load.image('enemy2', 'enemy2.png');

        // Load explosion image
        this.load.image('explosion', 'explosion.png');

        // Load audio files
        this.load.audio('music', 'music.wav');
        this.load.audio('laser', 'laser.wav');
        this.load.audio('explosionSound', 'explosion.wav');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Create the text "Press any key" centered on the screen
        const text = this.add.text(width / 2, height / 2, 'Press any key', {
            fontSize: '48px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Animate: move upwards then disappear
        this.tweens.add({
            targets: text,
            y: height / 2 - 150, // Move upwards by 150 pixels
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                // Then disappear (fade out)
                this.tweens.add({
                    targets: text,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        // Clean up the text after it disappears
                        text.destroy();
                        
                        // Listen for any key press to start the game
                        this.input.keyboard.on('keydown', () => this.scene.start('GameScene'));
                    }
                });
            }
        });

        // Allow the user to press a key immediately without waiting for the animation
        this.input.keyboard.on('keydown', () => this.scene.start('GameScene'));
    }
}
