// GameScene: Main gameplay scene
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // ===== PLAYER STATE =====
    this.playerHealth = GameConfig.MAX_HEALTH;
    this.lastShotTime = 0;

    // ===== AUDIO =====
    this.music = this.sound.add('music', { loop: true, volume: 0.5 });
    this.music.play();
    this.laserSound = this.sound.add('laser', { volume: 0.125 });
     this.explosionSound = this.sound.add('explosionSound', { volume: 0.3 });
    this.railT = 0; // Progress along rail path (0 to 1)
    this.railSpeed = 0.00015; // How fast the rail progresses
    this.freeMoveX = 0; // Lateral offset from rail (WASD controls this)
    this.gameActive = true;

    // ===== LASER CANVAS TEXTURE =====
    const laserCanvas = document.createElement('canvas');
    laserCanvas.width = 4;
    laserCanvas.height = 24;
    const ctx = laserCanvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 4, 24);
    this.textures.addCanvas('laser', laserCanvas);

    // ===== STARFIELD BACKGROUND =====
    this.starLayers = [];
    for (let layer = 0; layer < GameConfig.STAR_LAYERS; layer++) {
      const speed = 0.3 + layer * 0.35;
      const count = GameConfig.STAR_COUNT_PER_LAYER;
      const size = 1 + layer;
      const alpha = 0.4 + layer * 0.2;
      const stars = this.add.group();
      stars.setDepth(-1);

      for (let i = 0; i < count; i++) {
        const star = this.add.image(
          Phaser.Math.Between(0, GameConfig.GAME_WIDTH),
          Phaser.Math.Between(0, GameConfig.GAME_HEIGHT),
          'star'
        );
        star.setAlpha(alpha);
        star.setScale(size / 2);
        star.setScrollFactor(0);
        star.layer = layer;
        stars.add(star);
      }
      this.starLayers.push({ group: stars, speed });
    }

    // ===== PLAYER SHIP =====
    this.player = this.add.image(
      GameConfig.RAIL_POINTS[0].x,
      GameConfig.RAIL_POINTS[0].y,
      'ship'
    );
    this.player.setScale(0.32);
    this.player.setDepth(10);
    this.player.setOrigin(0.5, 0.5);

    // Point player ship upward (flip vertically so ship points up)
    this.player.setRotation(Math.PI);
    this.player.setFlipY(true);

    // ===== PLAYER GROUP (for bullet parent) =====
    this.playerGroup = this.add.group();
    this.playerGroup.add(this.player);

    // ===== BULLET GROUP (non-physics, manual movement) =====
    this.bullets = this.add.group();
    this.bullets.setDepth(5);

    // ===== ENEMY GROUP (non-physics for homing control) =====
    this.enemies = this.add.group();
    this.enemies.setDepth(8);

    // ===== ENEMY SPAWNING COUNTER =====
    this.enemySpawnCounter = 0; // Track which type to spawn next (alternating)

    // ===== EXPLOSION PARTICLES =====
    this.explosions = this.add.group();

    // ===== INPUT =====
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE
    });

    // ===== RAIL PATH SYSTEM =====
    // Use plain objects since Phaser 3 doesn't have Phaser.Point constructor
    this.railPoints = [...GameConfig.RAIL_POINTS];

    // ===== ENEMY SPAWNING =====
    // Track spawn rate difficulty over time
    this.gameStartTime = this.time.now;
    this.spawnRateDecreaseRate = 100; // ms decrease every 30 seconds
    this._lastAppliedDelay = 2000; // Start delay is always 2000ms
    this._updateTime = 0; // Throttle timer updates to every 5 seconds

    this.enemySpawnTimer = this.time.addEvent({
      delay: 2000,
      callback: this.spawnEnemyWave,
      callbackScope: this,
      repeat: -1
    });

    // ===== COLLISION (manual since we use regular groups) =====
    this.bulletList = []; // Track active bullets for overlap
    this.enemyList = [];   // Track active enemies for overlap

    // ===== UI: HEALTH BAR =====
    this.createHealthBar();

    // ===== UI: Game Over overlay =====
    this.createGameOverUI();

    // ===== CAMERA =====
    this.cameras.main.setBounds(0, -200, 800, 800);
  }

  update(time, delta) {
    if (!this.gameActive) return;

    // ===== STARFIELD ANIMATION =====
    this.starLayers.forEach(layer => {
      layer.group.getChildren().forEach(star => {
        star.setY(star.y + layer.speed * (delta / 16));
        if (star.y > GameConfig.GAME_HEIGHT + 10) {
          star.setY(-10);
          star.setX(Phaser.Math.Between(0, GameConfig.GAME_WIDTH));
        }
      });
    });

    // ===== RAIL PATH MOVEMENT =====
    // Advance along the rail path
    this.railT += this.railSpeed * (delta / 16);
    this.railT = Math.min(this.railT, 1);

    // Get rail position from waypoints
    const railPos = this.getPointOnRail(this.railT);

    // ===== FREE MOVEMENT (WASD) =====
    // WASD controls absolute position on screen (continuous movement)
    const moveSpeed = GameConfig.PLAYER_SPEED * (delta / 1000);
    let moved = false;
    let lastMoveX = 0;

    if (this.wasd.left.isDown) { this.player.x -= moveSpeed; lastMoveX = -1; moved = true; }
    if (this.wasd.right.isDown) { this.player.x += moveSpeed; lastMoveX = 1; moved = true; }
    if (this.wasd.up.isDown) { this.player.y -= moveSpeed; moved = true; }
    if (this.wasd.down.isDown) { this.player.y += moveSpeed; moved = true; }

    // Clamp to bounds
    this.player.x = Phaser.Math.Clamp(this.player.x, GameConfig.PLAYER_BOUNDS_X, GameConfig.GAME_WIDTH - GameConfig.PLAYER_BOUNDS_X);
    this.player.y = Phaser.Math.Clamp(this.player.y, 50, GameConfig.PLAYER_BOUNDS_Y);

    // ===== AUTO SCROLL (camera follows rail) =====
    const cameraTargetY = Phaser.Math.Linear(
      this.cameras.main.y,
      railPos.y - 200,
      0.05
    );
    this.cameras.main.scrollY = cameraTargetY;

    // ===== SHOOTING =====
    if (this.wasd.space.isDown && time > this.lastShotTime + GameConfig.BULLET_COOLDOWN) {
      this.shoot(time);
      this.lastShotTime = time;
    }

    // ===== BULLET UPDATE =====
    this.bulletList = [];
    this.bullets.getChildren().forEach(bullet => {
      if (bullet.getData('alive')) {
        bullet.y -= GameConfig.BULLET_SPEED * (delta / 1000);
        this.bulletList.push(bullet);
        if (bullet.y < -20) {
          bullet.setData('alive', false);
          bullet.setVisible(false);
        }
      }
    });
    
    // ===== SPAWN RATE UPDATE (throttled to every 5 seconds) =====
    this._updateTime += delta;
    if (this._updateTime >= 5000) {
      this._updateTime = 0;
      const currentDelay = this.getCurrentSpawnDelay();
      if (currentDelay !== this._lastAppliedDelay) {
        this.enemySpawnTimer.destroy();
        this.enemySpawnTimer = this.time.addEvent({
          delay: currentDelay,
          callback: this.spawnEnemyWave,
          callbackScope: this,
          repeat: -1
        });
        this._lastAppliedDelay = currentDelay;
      }
    }

    // ===== ENEMY UPDATE =====
    this.enemyList = [];
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.active && enemy.getData('alive')) {
        // Get enemy type (1 or 2)
        const enemyType = enemy.getData('type') || 1;
        const health = enemy.getData('health') || 1;
        
        // Move toward player (homing with type-specific behavior)
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        
        if (enemyType === 2) {
          // enemy2: faster vertical speed but very slow horizontal movement
          // Move down at full ENEMY2_SPEED
          enemy.y += GameConfig.ENEMY2_SPEED * (delta / 1000);
          
          // Move horizontally toward player at reduced speed (only if player is not directly above)
          if (Math.abs(dx) > 5) { // Small threshold to prevent jitter when aligned
            const horizontalSpeed = GameConfig.ENEMY2_SPEED * GameConfig.ENEMY2_HORIZONTAL_SLOWDOWN;
            enemy.x += Math.sign(dx) * horizontalSpeed * (delta / 1000);
          }
        } else {
          // enemy1: standard homing (moves equally in all directions)
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const normalizedDx = dx / dist;
            const normalizedDy = dy / dist;
            enemy.x += normalizedDx * GameConfig.ENEMY_SPEED * (delta / 1000);
            enemy.y += normalizedDy * GameConfig.ENEMY_SPEED * (delta / 1000);
          }
        }

        // Remove if off screen
        if (enemy.x < -50 || enemy.x > GameConfig.GAME_WIDTH + 50 || enemy.y > GameConfig.GAME_HEIGHT + 50) {
          enemy.setData('alive', false);
          enemy.setVisible(false);
        } else {
          this.enemyList.push(enemy);
        }
      }
    });

    // ===== COLLISION CHECKS (manual overlap) =====
    // Bullet vs Enemy
    for (const bullet of this.bulletList) {
      for (const enemy of this.enemyList) {
        if (bullet.getData('alive') && enemy.getData('alive')) {
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 18) { // 8 (bullet radius) + 14 (enemy radius)
            this.hitEnemy(bullet, enemy);
          }
        }
      }
    }

    // Player vs Enemy
    for (const enemy of this.enemyList) {
      if (enemy.getData('alive')) {
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 30) { // Approximate ship radius
          this.hitPlayer(this.player, enemy);
        }
      }
    }

    // ===== CHECK RAIL END (respawn at start for endless) =====
    if (this.railT >= 1) {
      this.railT = 0;
      this.cameras.main.scrollY = GameConfig.RAIL_POINTS[0].y - 200;
    }

    // ===== INCREASE SPAWN RATE OVER TIME =====
    // (handled dynamically in spawnEnemyWave via getcurrentSpawnDelay)
  }

  // ===== GET CURRENT SPAWN DELAY (decrease 100ms every 30 seconds) =====
  getCurrentSpawnDelay() {
    const gameTime = this.time.now - this.gameStartTime;
    const intervals = Math.floor(gameTime / 30000); // One decrease every 30 seconds
    const delay = 2000 - (intervals * this.spawnRateDecreaseRate);
    return Math.max(delay, 100); // Minimum 100ms delay to prevent browser freeze
  }

  // ===== INTERPOLATE ALONG RAIL PATH =====
  getPointOnRail(t) {
    const points = this.railPoints;
    const segmentCount = points.length - 1;
    const segmentFloat = t * segmentCount;
    const segmentIndex = Math.min(Math.floor(segmentFloat), segmentCount - 1);
    const segmentT = segmentFloat - segmentIndex;

    const p1 = points[segmentIndex];
    const p2 = points[segmentIndex + 1];

    return {
      x: Phaser.Math.Linear(p1.x, p2.x, segmentT),
      y: Phaser.Math.Linear(p1.y, p2.y, segmentT)
    };
  }

  // ===== SHOOT =====
  shoot(time) {
    this.laserSound.play();
    const laser = this.bullets.create(
      this.player.x,
      this.player.y - 20 - 12,
      'laser'
    );
    laser.setOrigin(0.5, 0.5);
    laser.setDepth(5);
    laser.setScrollFactor(0);
    laser.setData('alive', true);
    laser.setVisible(true);
    console.log('Laser created:', laser.x, laser.y);
  }

  // ===== SPAWN ENEMY WAVE =====
  spawnEnemyWave() {
    if (!this.gameActive) return;

    const waveSize = GameConfig.ENEMY_WAVE_SIZE;
    const spawnY = this.cameras.main.scrollY - 100; // Spawn above screen

    for (let i = 0; i < waveSize; i++) {
      const x = Phaser.Math.Between(80, GameConfig.GAME_WIDTH - 80);
      const y = spawnY;
      
      // Alternate between enemy types: even spawns = enemy1, odd spawns = enemy2
      const enemyType = (this.enemySpawnCounter % 2 === 0) ? 1 : 2;
      const textureKey = (enemyType === 1) ? 'enemy' : 'enemy2';
      
      const enemy = this.enemies.create(x, y, textureKey);
      if (enemy) {
        enemy.setOrigin(0.5, 0.5);
        enemy.setDepth(8);
        enemy.setScale(0.192);
        enemy.setData('alive', true);
        enemy.setData('type', enemyType);
        enemy.setData('health', (enemyType === 2) ? GameConfig.ENEMY2_HEALTH : 1);
        enemy.setVisible(true);
        
        // Rotate enemy2 180 degrees so it faces down
        if (enemyType === 2) {
          enemy.setRotation(Math.PI);
        }
      }
      
      this.enemySpawnCounter++;
    }
  }

  // ===== HIT ENEMY (bullet collides with enemy) =====
  hitEnemy(bullet, enemy) {
    if (!bullet.getData('alive') || !enemy.getData('alive')) return;

    bullet.setData('alive', false);
    bullet.setVisible(false);

    const enemyType = enemy.getData('type') || 1;
    let health = enemy.getData('health') || 1;
    
    // Reduce health by 1
    health -= 1;
    enemy.setData('health', health);
    
    if (health <= 0) {
      // Enemy destroyed - create explosion effect
      this.createExplosion(enemy.x, enemy.y);
      this.explosionSound.play();
      enemy.setData('alive', false);
      enemy.setVisible(false);
    } else {
      // Enemy damaged but still alive - flash red to show damage (same method as player red flash)
      enemy.setTint(0xff0000);
      this.time.delayedCall(200, () => {
        if (enemy && enemy.getData('alive')) {
          enemy.clearTint();
        }
      });
    }
  }

  // ===== HIT PLAYER (enemy collides with player) =====
  hitPlayer(player, enemy) {
    if (!this.gameActive || !enemy.getData('alive')) return;

    enemy.setData('alive', false);
    enemy.setVisible(false);

    this.explosionSound.play();
    this.playerHealth -= GameConfig.HEALTH_DAMAGE_PER_HIT;

    // Flash player red
    this.player.setTint(0xff0000);
    this.time.delayedCall(200, () => {
      if (this.player) this.player.clearTint();
    });

    // Update health bar
    this.updateHealthBar();

    // Screen shake
    this.cameras.main.shake(150, 0.01);

    // Check death
    if (this.playerHealth <= 0) {
      this.gameActive = false;

      // Show explosion at player position
      this.createExplosion(this.player.x, this.player.y);
      this.explosionSound.play();

      // Hide player
      this.player.setVisible(false);

      this.createGameOverUI();

      // Destroy remaining enemies
      this.enemies.getChildren().forEach(e => {
        if (e.getData('alive')) {
          e.setData('alive', false);
          e.setVisible(false);
        }
      });

      // Stop spawning
      this.enemySpawnTimer.destroy();

      // Stop music before scene transition
      this.music.stop();

      // Show game over after delay
      this.time.delayedCall(1500, () => {
        this.scene.start('GameOverScene', { survived: true });
      });
    }
  }

  // ===== EXPLOSION EFFECT =====
  createExplosion(x, y) {
    // Create explosion image with random rotation
    const explosion = this.add.image(x, y, 'explosion');
    explosion.setOrigin(0.5, 0.5);
    explosion.setDepth(15);
    explosion.setScale(0.5);
    explosion.setAlpha(1);
    explosion.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));

    // Animate explosion: scale up and fade out
    this.tweens.add({
      targets: explosion,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => explosion.destroy()
    });

    // Add particle sparks around the explosion
    const particles = [
      { color: 0xff4400, size: 4, speed: 80 },
      { color: 0xff8800, size: 3, speed: 60 },
      { color: 0xffcc00, size: 2, speed: 40 }
    ];

    particles.forEach(p => {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 / 6) * i;
        const spark = this.add.image(x, y, 'star');
        spark.setScale(p.size / 4);
        spark.setTint(p.color);
        spark.setAlpha(1);
        spark.setDepth(20);
        this.tweens.add({
          targets: spark,
          alpha: 0,
          scaleX: 0,
          scaleY: 0,
          x: x + Math.cos(angle) * p.speed,
          y: y + Math.sin(angle) * p.speed,
          duration: 400,
          onComplete: () => spark.destroy()
        });
      }
    });
  }

  // ===== HEALTH BAR (Star Fox style) =====
  createHealthBar() {
    const barX = 10;
    const barY = 10;

    // Background
    this.add.rectangle(barX - 2, barY - 2, 204, 34, 0x000000).setDepth(100);

    // Label
    const label = this.add.text(barX, barY - 16, 'HP', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffffff'
    }).setDepth(100);

    // Health segments
    this.healthSegments = [];
    for (let i = 0; i < GameConfig.MAX_HEALTH; i++) {
      const segment = this.add.image(
        barX + 4 + i * 20,
        barY + 12,
        'health'
      ).setDepth(100);
      segment.setTint(0x444444);
      this.healthSegments.push(segment);
    }
  }

  updateHealthBar() {
    for (let i = 0; i < GameConfig.MAX_HEALTH; i++) {
      if (i < this.playerHealth) {
        this.healthSegments[i].clearTint();
      } else {
        this.healthSegments[i].setTint(0x222222);
      }
    }
  }

  // ===== GAME OVER UI =====
  createGameOverUI() {
    // Dark overlay
    const overlay = this.add.rectangle(
      GameConfig.GAME_WIDTH / 2,
      GameConfig.GAME_HEIGHT / 2,
      GameConfig.GAME_WIDTH,
      GameConfig.GAME_HEIGHT,
      0x000000,
      0.7
    ).setDepth(200).setVisible(false);
    overlay.key = 'overlay';

    // Game Over text
    const goText = this.add.text(
      GameConfig.GAME_WIDTH / 2,
      GameConfig.GAME_HEIGHT / 2 - 60,
      'GAME OVER',
      {
        fontSize: '64px',
        fontFamily: 'monospace',
        color: '#ff3333',
        fontStyle: 'bold'
      }
    ).setDepth(201).setOrigin(0.5).setVisible(false);
    goText.key = 'goText';

    // Restart prompt
    const restartText = this.add.text(
      GameConfig.GAME_WIDTH / 2,
      GameConfig.GAME_HEIGHT / 2 + 40,
      'CLICK TO RESTART',
      {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#ffffff'
      }
    ).setDepth(201).setOrigin(0.5).setVisible(false);
    restartText.key = 'restartText';

    // Click to restart
    this.input.on('gameobjectdown', (pointer, gameObject) => {
      if (gameObject.key === 'overlay') {
        this.scene.restart();
        this.scene.start('BootScene');
      }
    });

    // Store references for showing
    this.gameOverOverlay = overlay;
    this.gameOverText = goText;
    this.restartText = restartText;

    // Show after delay (called from hitPlayer)
    this.time.delayedCall(500, () => {
      if (!this.gameActive) {
        overlay.setVisible(true);
        goText.setVisible(true);
        restartText.setVisible(true);
      }
    });
  }
}