import React, { useEffect, useRef, useState } from 'react';

enum GameState {
    MENU,
    PLAYING
}

interface SpaceInvadersGameProps {
  width: number;
  height: number;
  isPreview?: boolean;
}

interface KeyControl {
  keys: Array<{
    key: string;
    alt?: string;
  }>;
  action: string;
}

// Game classes
class Laser {
  x: number;
  y: number;
  img: HTMLImageElement;
  width: number;
  height: number;

  constructor(x: number, y: number, img: HTMLImageElement) {
    this.x = x;
    this.y = y;
    this.img = img;
    this.width = 20;
    this.height = 20;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }

  move(vel: number) {
    this.y += vel;
  }

  offScreen(height: number): boolean {
    return !(height >= this.y && this.y >= 0);
  }

  collision(obj: Ship): boolean {
    return (
      this.x < obj.x + obj.width &&
      this.x + this.width > obj.x &&
      this.y < obj.y + obj.height &&
      this.y + this.height > obj.y
    );
  }
}

class Ship {
  static COOLDOWN = 30;

  x: number;
  y: number;
  health: number;
  shipImg: HTMLImageElement | null;
  laserImg: HTMLImageElement | null;
  lasers: Laser[];
  cooldown: number;
  width: number;
  height: number;
  velocity: number;

  constructor(x: number, y: number, health = 100) {
    this.x = x;
    this.y = y;
    this.health = health;
    this.shipImg = null;
    this.laserImg = null;
    this.lasers = [];
    this.cooldown = 0;
    this.width = 40;
    this.height = 40;
    this.velocity = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.shipImg) {
      ctx.drawImage(this.shipImg, this.x, this.y, this.width, this.height);
    }
    this.lasers.forEach(laser => laser.draw(ctx));
  }

  moveLasers(vel: number, objs: Ship[] | Ship) {
    this.coolDown();
    this.lasers = this.lasers.filter(laser => {
      laser.move(vel);
      if (laser.offScreen(600)) return false;
      
      if (Array.isArray(objs)) {
        for (const obj of objs) {
          if (laser.collision(obj)) {
            obj.health -= 10;
            return false;
          }
        }
      } else if (laser.collision(objs)) {
        objs.health -= 10;
        return false;
      }
      return true;
    });
  }

  coolDown() {
    if (this.cooldown >= Ship.COOLDOWN) {
      this.cooldown = 0;
    } else if (this.cooldown > 0) {
      this.cooldown += 1;
    }
  }

  shoot() {
    if (this.cooldown === 0 && this.laserImg) {
      const laser = new Laser(
        this.x + this.width / 2 - 10,
        this.y,
        this.laserImg
      );
      this.lasers.push(laser);
      this.cooldown = 1;
    }
  }
}

class Player extends Ship {
  score: number;
  maxHealth: number;
  velocity: number;
  shield_hits: number;
  max_shield_hits: number;
  num_lasers: number;

  constructor(x: number, y: number, health = 100) {
    super(x, y, health);
    this.score = 0;
    this.maxHealth = health;
    this.velocity = 5;
    this.shield_hits = 0;
    this.max_shield_hits = 3;
    this.num_lasers = 1;
  }

  take_damage(damage: number): boolean {
    if (this.shield_hits > 0) {
      this.shield_hits--;
      return false; // Damage blocked
    }
    this.health -= damage;
    this.num_lasers = 1; // Reset to single bullet when taking damage
    return true;
  }

  shoot() {
    if (this.cooldown === 0 && this.laserImg) {
      const spread = 20; // Space between lasers
      if (this.num_lasers === 1) {
        const laser = new Laser(this.x + this.width / 2 - 10, this.y, this.laserImg);
        this.lasers.push(laser);
      } else {
        // Calculate positions for multiple lasers
        const start_x = this.x - (spread * (this.num_lasers - 1) / 2);
        for (let i = 0; i < this.num_lasers; i++) {
          const laser = new Laser(start_x + (spread * i), this.y, this.laserImg);
          this.lasers.push(laser);
        }
      }
      this.cooldown = 1;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    super.draw(ctx);
    
    // Only draw shield if shield_hits is greater than 0
    if (this.shield_hits > 0) {
      const shield_color = '#00bfff'; // Deep Sky Blue
      const shield_radius = Math.max(this.width, this.height) + 10;
      
      // Draw outer shield glow
      ctx.beginPath();
      ctx.strokeStyle = shield_color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.3;
      ctx.arc(this.x + this.width/2, this.y + this.height/2, shield_radius + 5, 0, Math.PI * 2);
      ctx.stroke();

      // Draw main shield
      ctx.beginPath();
      ctx.strokeStyle = shield_color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.arc(this.x + this.width/2, this.y + this.height/2, shield_radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Reset opacity for text
      ctx.globalAlpha = 1;
      
      // Draw shield hit counter only if shield is active
      ctx.font = '20px Arial';
      ctx.fillStyle = shield_color;
      ctx.fillText(`Shield: ${this.shield_hits}`, this.x, this.y - 20);
    }
  }

  moveLasers(vel: number, enemies: Enemy[]) {
    this.coolDown();
    this.lasers = this.lasers.filter(laser => {
      laser.move(vel);
      if (laser.offScreen(600)) return false;

      for (const enemy of enemies) {
        if (laser.collision(enemy)) {
          enemies.splice(enemies.indexOf(enemy), 1);
          this.score += enemy.score_value; // Use the enemy's score value
          return false;
        }
      }
      return true;
    });
  }
}

class Enemy extends Ship {
  type: 'red' | 'blue' | 'green';
  score_value: number;

  constructor(x: number, y: number, type: 'red' | 'blue' | 'green') {
    super(x, y);
    this.type = type;
    
    // Set properties based on type
    switch (type) {
      case 'red':
        this.velocity = 2;
        this.score_value = 10;
        this.width = 40;
        this.height = 40;
        break;
      case 'blue':
        this.velocity = 1;
        this.score_value = 20;
        this.width = 50;
        this.height = 50;
        break;
      case 'green':
        this.velocity = 0.5;
        this.score_value = 30;
        this.width = 60;
        this.height = 60;
        break;
    }
  }

  move() {
    this.y += this.velocity;
  }

  moveLasers(vel: number, player: Player) {
    this.coolDown();
    this.lasers = this.lasers.filter(laser => {
      laser.move(vel);
      if (laser.offScreen(600)) return false;

      if (laser.collision(player)) {
        // Check if player has shield first
        if (player.shield_hits > 0) {
          player.shield_hits--; // Reduce shield hits
          return false; // Remove laser
        } else {
          player.take_damage(10); // Only do damage if no shield
          return false;
        }
      }
      return true;
    });
  }
}

class PowerUp {
  x: number;
  y: number;
  type: 'shield' | 'multi_shot' | 'health';
  width: number;
  height: number;
  velocity: number;

  constructor(x: number, y: number, type: 'shield' | 'multi_shot' | 'health') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = 20;
    this.height = 20;
    this.velocity = 2;
  }

  move() {
    this.y += this.velocity;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Green for health, Blue for shield, Yellow for multi_shot
    ctx.fillStyle = this.type === 'health' ? '#00ff00' : 
                   this.type === 'shield' ? '#0000ff' : '#ffff00';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

const SpaceInvadersGame: React.FC<SpaceInvadersGameProps> = ({ width, height, isPreview = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const gameRef = useRef<{
    player: Player;
    enemies: Enemy[];
    powerUps: PowerUp[];
    isGameOver: boolean;
    animationFrameId?: number;
    enemyShips: {
      red: HTMLImageElement;
      blue: HTMLImageElement;
      green: HTMLImageElement;
    };
    enemyLasers: {
      red: HTMLImageElement;
      blue: HTMLImageElement;
      green: HTMLImageElement;
    };
    background: HTMLImageElement;
  }>();
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
      });
    };

    const drawMenu = () => {
      if (!ctx || !gameRef.current?.background) return;
      
      // Draw background
      ctx.drawImage(gameRef.current.background, 0, 0, width, height);
      
      // Draw semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, width, height);
      
      // Draw title
      ctx.fillStyle = '#fff';
      ctx.font = '64px Arial';
      const titleText = 'SPACE INVADERS';
      const titleWidth = ctx.measureText(titleText).width;
      ctx.fillText(titleText, width / 2 - titleWidth / 2, height / 4);

      // Animate button
      const time = Date.now() * 0.001;
      const pulseScale = 1 + Math.sin(time * 2) * 0.05;

      // Calculate button dimensions
      ctx.font = '48px Arial';
      const text = 'Click to Play!';
      const textWidth = ctx.measureText(text).width;
      const textHeight = 48; // Approximate height of the font

      const padding = 20;
      const baseButtonWidth = textWidth + padding * 2;
      const baseButtonHeight = 70;

      const buttonWidth = baseButtonWidth * pulseScale;
      const buttonHeight = baseButtonHeight * pulseScale;
      const buttonX = width / 2 - buttonWidth / 2;
      const buttonY = height * 0.385 - buttonHeight / 2;

      // Check if mouse is over button
      const isHovered = mousePos.current.x >= buttonX && 
                       mousePos.current.x <= buttonX + buttonWidth &&
                       mousePos.current.y >= buttonY && 
                       mousePos.current.y <= buttonY + buttonHeight;

      // Replace the roundRect call with a custom rounded rectangle function
      const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
        if (!ctx) return;
        
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      };

      // Replace the existing button drawing code with:
      ctx.shadowColor = 'rgba(37, 99, 235, 0.5)';
      ctx.shadowBlur = 15 + Math.sin(time * 2) * 5;
      ctx.shadowOffsetY = isHovered ? 5 : 0;
      ctx.fillStyle = isHovered ? 'rgba(59, 130, 246, 0.8)' : 'rgba(37, 99, 235, 0.8)';
      drawRoundedRect(buttonX, buttonY - (isHovered ? 5 : 0), buttonWidth, buttonHeight, 10);

      // Reset shadow for text
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Draw button text (centered both horizontally and vertically)
      ctx.fillStyle = '#fff';
      const textY = buttonY + (buttonHeight / 2) + (textHeight / 3) - (isHovered ? 5 : 0);
      ctx.fillText(text, width / 2 - textWidth / 2, textY);

      // Draw controls with aligned text
      ctx.font = '24px Arial';
      ctx.fillStyle = '#fff';
      
      const drawKeyLogo = (key: string, x: number, y: number) => {
        const boxSize = 30;
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y - 20, boxSize, boxSize);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x, y - 20, boxSize, boxSize);
        
        // Set font and measure text
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        const metrics = ctx.measureText(key);
        
        // Calculate center position
        const textX = x + (boxSize - metrics.width) / 2;
        const textY = y - 20 + (boxSize + metrics.actualBoundingBoxAscent) / 2;
        
        ctx.fillText(key, textX, textY);
      };

      const controls: KeyControl[] = [
        { keys: [{ key: 'W', alt: '↑' }], action: 'Up' },
        { keys: [{ key: 'A', alt: '←' }], action: 'Left' },
        { keys: [{ key: 'S', alt: '↓' }], action: 'Down' },
        { keys: [{ key: 'D', alt: '→' }], action: 'Right' },
        { keys: [{ key: 'P' }], action: 'Pause' },
        { keys: [{ key: 'R' }], action: 'Restart' }
      ];

      const startX = width * 0.3;
      const startY = height * 0.55;
      const lineHeight = 40;
      const keySpacing = 45;
      const colonPosition = startX + 150;
      const actionPosition = colonPosition + 30;

      controls.forEach((control, index) => {
        let currentX = startX;
        
        // Draw key logos
        control.keys.forEach((keyInfo) => {
          drawKeyLogo(keyInfo.key, currentX, startY + index * lineHeight);
          if (keyInfo.alt) {
            ctx.fillText('or', currentX + 35, startY + index * lineHeight);
            drawKeyLogo(keyInfo.alt, currentX + 65, startY + index * lineHeight);
            currentX += keySpacing * 2;
          }
        });

        // Draw colon
        ctx.fillText(':', colonPosition, startY + index * lineHeight);
        
        // Draw action
        ctx.fillText(control.action, actionPosition, startY + index * lineHeight);
      });

      if (!isPreview) {
        requestAnimationFrame(drawMenu);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (gameState === GameState.MENU) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if click is within button bounds
        const buttonWidth = 300;
        const buttonHeight = 70;
        const buttonX = width / 2 - buttonWidth / 2;
        const buttonY = height / 2 - buttonHeight / 2;
        
        if (x >= buttonX && x <= buttonX + buttonWidth &&
            y >= buttonY && y <= buttonY + buttonHeight) {
          setGameState(GameState.PLAYING);
          canvas.focus();
          initGame();
        }
      }
    };

    canvas.addEventListener('click', handleClick);

    const initGame = async () => {
      // Load all game images
      const [
        playerShip, 
        redEnemyShip, 
        blueEnemyShip, 
        greenEnemyShip,
        playerLaser, 
        redLaser,
        blueLaser,
        greenLaser,
        background
      ] = await Promise.all([
        loadImage('/assets/space_invaders/pixel_ship_yellow.png'),
        loadImage('/assets/space_invaders/pixel_ship_red_small.png'),
        loadImage('/assets/space_invaders/pixel_ship_blue_small.png'),
        loadImage('/assets/space_invaders/pixel_ship_green_small.png'),
        loadImage('/assets/space_invaders/pixel_laser_yellow.png'),
        loadImage('/assets/space_invaders/pixel_laser_red.png'),
        loadImage('/assets/space_invaders/pixel_laser_blue.png'),
        loadImage('/assets/space_invaders/pixel_laser_green.png'),
        loadImage('/assets/space_invaders/background-black.png')
      ]);

      // Initialize player
      const player = new Player(width / 2 - 20, height - 100);
      player.shipImg = playerShip;
      player.laserImg = playerLaser;

      // Initialize game state
      gameRef.current = {
        player,
        enemies: [],
        powerUps: [],
        isGameOver: false,
        enemyShips: {
          red: redEnemyShip,
          blue: blueEnemyShip,
          green: greenEnemyShip
        },
        enemyLasers: {
          red: redLaser,
          blue: blueLaser,
          green: greenLaser
        },
        background
      };

      // Start game loop
      if (gameState === GameState.PLAYING) {
        gameLoop();
      } else {
        drawMenu();
      }
    };

    const handleMovement = () => {
      if (!gameRef.current) return;
      const { player } = gameRef.current;
      
      // Horizontal movement
      if ((keysPressed.current['ArrowLeft'] || keysPressed.current['a']) && 
          player.x - player.velocity > 0) {
        player.x -= player.velocity;
      }
      if ((keysPressed.current['ArrowRight'] || keysPressed.current['d']) && 
          player.x + player.velocity + player.width < width) {
        player.x += player.velocity;
      }
      
      // Vertical movement
      if ((keysPressed.current['ArrowUp'] || keysPressed.current['w']) && 
          player.y - player.velocity > height/2) {
        player.y -= player.velocity;
      }
      if ((keysPressed.current['ArrowDown'] || keysPressed.current['s']) && 
          player.y + player.velocity + player.height < height) {
        player.y += player.velocity;
      }
    };

    // const drawPauseMenu = () => {
    //   if (!ctx || !gameRef.current?.background) return;
      
    //   // Draw current game state in background
    //   ctx.drawImage(gameRef.current.background, 0, 0, width, height);
    //   gameRef.current.player.draw(ctx);
    //   gameRef.current.enemies.forEach(enemy => enemy.draw(ctx));
      
    //   // Draw semi-transparent overlay
    //   ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    //   ctx.fillRect(0, 0, width, height);
      
    //   // Draw pause text
    //   ctx.fillStyle = '#fff';
    //   ctx.font = '64px Arial';
    //   const pauseText = 'GAME PAUSED';
    //   const textWidth = ctx.measureText(pauseText).width;
    //   ctx.fillText(pauseText, width / 2 - textWidth / 2, height * 0.3);

    //   // Draw instructions
    //   ctx.font = '32px Arial';
    //   const instructions = [
    //     'Press P to Resume',
    //     'Press R to Return to Menu'
    //   ];
      
    //   instructions.forEach((text, index) => {
    //     const instrWidth = ctx.measureText(text).width;
    //     ctx.fillText(text, width / 2 - instrWidth / 2, height * 0.45 + index * 45);
    //   });
    // };


    const gameLoop = () => {
      if (!gameRef.current || !ctx) return;
      
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);

      if (gameState === GameState.MENU) {
        drawMenu();
        return; // Don't continue game logic while paused
      }

      const { player, enemies, powerUps } = gameRef.current;

      // Check game over condition
      if (player.health <= 0) {
        gameRef.current.isGameOver = true;
        setGameState(GameState.MENU);
        return;
      }

      // Draw background
      if (gameRef.current.background) {
        ctx.drawImage(gameRef.current.background, 0, 0, width, height);
      }

      // Handle movement and game logic only if not paused
      if (gameState === GameState.PLAYING) {
        handleMovement();
        player.draw(ctx);
        player.moveLasers(-5, enemies);

        // Update and draw enemies
        if (enemies.length < 5 && Math.random() < 0.02) {
          const rand = Math.random();
          let type: 'red' | 'blue' | 'green';
          
          if (rand < 0.5) {
            type = 'red';  // 50% chance for red (most common)
          } else if (rand < 0.8) {
            type = 'blue'; // 30% chance for blue
          } else {
            type = 'green'; // 20% chance for green
          }

          const enemy = new Enemy(
            Math.random() * (width - 40),
            -50,
            type
          );
          
          enemy.shipImg = gameRef.current.enemyShips[type];
          enemy.laserImg = gameRef.current.enemyLasers[type];
          enemies.push(enemy);
        }

        enemies.forEach((enemy, index) => {
          enemy.move();
          enemy.draw(ctx);
          enemy.moveLasers(5, player);

          if (Math.random() < 0.005) {
            enemy.shoot();
          }

          if (enemy.y + enemy.height > height) {
            enemies.splice(index, 1);
            player.health -= 20; // Shield doesn't protect against enemies reaching bottom
            player.num_lasers = 1; // Reset to single bullet since health damage was taken
          }

          // Check collision with player
          if (enemy.y + enemy.height > player.y && 
              enemy.y < player.y + player.height &&
              enemy.x + enemy.width > player.x && 
              enemy.x < player.x + player.width) {
            if (player.shield_hits > 0) {
              player.shield_hits = 0; // Shield is completely destroyed on collision
              enemies.splice(index, 1);
            } else {
              player.take_damage(25); // This will reset num_lasers to 1
              enemies.splice(index, 1);
            }
          }
        });

        // Spawn power-ups
        if (Math.random() < 0.003) { // Changed from 0.001 to 0.003 (3x more frequent)
          const x = Math.random() * (width - 20);
          const y = -20;
          const type = Math.random() < 0.33 ? 'shield' : 
                      Math.random() < 0.66 ? 'multi_shot' : 'health';
          powerUps.push(new PowerUp(x, y, type));
        }

        // Update and draw power-ups
        powerUps.forEach((powerUp, index) => {
          powerUp.move();
          powerUp.draw(ctx);

          // Check collision with player
          if (powerUp.y + powerUp.height > player.y && 
              powerUp.y < player.y + player.height &&
              powerUp.x + powerUp.width > player.x && 
              powerUp.x < player.x + player.width) {
            
            switch (powerUp.type) {
              case 'health':
                player.health = Math.min(player.health + 30, 100); // Green powerup: +30 health, cap at 100
                break;
              case 'shield':
                player.shield_hits = 3; // Blue powerup: Shield with 3 hits
                break;
              case 'multi_shot':
                player.num_lasers = Math.min(player.num_lasers + 1, 3); // Yellow powerup: +1 bullet
                break;
            }
            
            powerUps.splice(index, 1);
          }

          // Remove if off screen
          if (powerUp.y > height) {
            powerUps.splice(index, 1);
          }
        });

        // Draw UI
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.fillText(`Score: ${player.score}`, 10, 30);
        ctx.fillText(`Health: ${player.health}`, 10, 60);

        gameRef.current.animationFrameId = requestAnimationFrame(gameLoop);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameRef.current || document.activeElement !== canvasRef.current) return;
      
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 
           'a', 'd', 'w', 's', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      
      if (gameState !== GameState.PLAYING) return;
      
      keysPressed.current[e.key] = true;
      
      if (e.key === ' ') {
        gameRef.current.player.shoot();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    // Add event listeners for keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Initialize game
    initGame();

    // If in preview mode, only show the menu and don't allow starting the game
    if (isPreview) {
      drawMenu();
      return () => {};
    }

    // Cleanup
    return () => {
      canvas.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (gameRef.current?.animationFrameId) {
        cancelAnimationFrame(gameRef.current.animationFrameId);
      }
    };
  }, [width, height, gameState, isPreview]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ border: '1px solid #333' }}
      tabIndex={isPreview ? -1 : 0} // Prevent focus in preview mode
      onMouseMove={(e) => {
        if (isPreview) return; // Disable mouse interaction in preview
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          mousePos.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
        }
      }}
      onClick={(e) => {
        if (isPreview) return; // Disable click interaction in preview
        if (gameState === GameState.MENU) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Check if click is within button bounds
            const buttonWidth = 300;
            const buttonHeight = 70;
            const buttonX = width / 2 - buttonWidth / 2;
            const buttonY = height * 0.35 - buttonHeight / 2;
            
            if (x >= buttonX && x <= buttonX + buttonWidth &&
                y >= buttonY && y <= buttonY + buttonHeight) {
              setGameState(GameState.PLAYING);
              canvasRef.current?.focus();
            }
          }
        }
      }}
      onFocus={(e) => !isPreview && (e.currentTarget.style.outline = 'none')}
      autoFocus={!isPreview && gameState === GameState.PLAYING}
    />
  );
};

export default SpaceInvadersGame; 
