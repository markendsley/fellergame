// Game configuration constants
const GameConfig = {
  // Dimensions
  GAME_WIDTH: 800,
  GAME_HEIGHT: 600,

  // Player ship
  PLAYER_SPEED: 300,
  PLAYER_RAIL_SPEED: 120, // Auto-scroll speed along Y axis
  PLAYER_BOUNDS_X: 60,    // Min X margin
  PLAYER_BOUNDS_Y: 580,   // Max Y position (can't go above this)

  // Bullets
  BULLET_SPEED: 500,
  BULLET_COOLDOWN: 150, // milliseconds between shots

  // Enemies
  ENEMY_SPEED: 100,
  ENEMY2_SPEED: 130, // enemy2 base speed (30% faster)
  ENEMY2_HORIZONTAL_SLOWDOWN: 0.3, // horizontal movement factor (0.3 = 70% slower horizontally)
  ENEMY2_HEALTH: 2, // enemy2 takes 2 hits to kill
   ENEMY_SPAWN_INTERVAL: 3000, // ms between waves
  ENEMY_WAVE_SIZE: 3, // enemies per wave

  // Starfield layers
  STAR_LAYERS: 3,
  STAR_COUNT_PER_LAYER: 80,

  // Health (Star Fox style: 10 segments)
  MAX_HEALTH: 10,
  HEALTH_DAMAGE_PER_HIT: 1,

  // Rail path waypoints (the ship auto-drifts along this)
  RAIL_POINTS: [
    { x: 400, y: 500 },
    { x: 200, y: 350 },
    { x: 600, y: 200 },
    { x: 300, y: 80 },
    { x: 400, y: -50 } // off-screen
  ]
};