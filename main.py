import pygame
import os
import random
import time
import json

pygame.font.init()

w, h = 1000, 1000
window = pygame.display.set_mode((w, h))
pygame.display.set_caption('Space Invaders')

# LOAD IMAGES
redSpaceship = pygame.image.load(os.path.join('assets', 'pixel_ship_red_small.png'))
greenSpaceship = pygame.image.load(os.path.join('assets', 'pixel_ship_green_small.png'))
blueSpaceship = pygame.image.load(os.path.join('assets', 'pixel_ship_blue_small.png'))

# PLAYERS SHIP
yellowSpaceship = pygame.image.load(os.path.join('assets', 'pixel_ship_yellow.png'))

# LASERS
redLasers = pygame.image.load(os.path.join('assets', 'pixel_laser_red.png'))
yellowLasers = pygame.image.load(os.path.join('assets', 'pixel_laser_yellow.png'))
greenLasers = pygame.image.load(os.path.join('assets', 'pixel_laser_green.png'))
blueLasers = pygame.image.load(os.path.join('assets', 'pixel_laser_blue.png'))

# BACKGROUND IMAGE
background = pygame.transform.scale(pygame.image.load(os.path.join('assets', 'background-black.png')), (w, h))


class Laser:
    def __init__(self, x, y, img):
        self.x = x
        self.y = y
        self.img = img
        self.mask = pygame.mask.from_surface(self.img)

    def draw(self, win):
        win.blit(self.img, (self.x, self.y))

    def move(self, vel):
        self.y += vel

    def off_screen(self, height):
        return not (height >= self.y >= 0)

    def collision(self, object):
        return collide(self, object)


class Ship:
    coolDownTime = 30

    def __init__(self, x, y, health=100):
        self.x = x
        self.y = y
        self.health = health
        self.shipImg = None
        self.laserImg = None
        self.lasers = []
        self.coolDown = 0

    def draw(self, window):
        window.blit(self.shipImg, (self.x, self.y))
        for laser in self.lasers:
            laser.draw(window)

    def move_lasers(self, vel, pl):
        self.cool_down()
        for las in self.lasers[:]:
            las.move(vel)
            if las.off_screen(h):
                self.lasers.remove(las)
            elif las.collision(pl):
                damage_taken = pl.take_damage(10)  # Check if damage was taken
                if damage_taken:  # Only remove laser if damage was actually taken
                    self.lasers.remove(las)
                else:  # Shield blocked the damage, still remove the laser
                    self.lasers.remove(las)

    def cool_down(self):
        if self.coolDown >= self.coolDownTime:
            self.coolDown = 0
        elif self.coolDown > 0:
            self.coolDown += 1

    def shoot(self):
        if self.coolDown == 0:
            laser = Laser(self.x, self.y, self.laserImg)
            self.lasers.append(laser)
            self.coolDown = 1

    def get_width(self):
        return self.shipImg.get_width()

    def get_height(self):
        return self.shipImg.get_height()


class Player(Ship):
    def __init__(self, x, y, sound_manager, health=100):
        super().__init__(x, y, health)
        self.shipImg = yellowSpaceship
        self.laserImg = yellowLasers
        self.mask = pygame.mask.from_surface(self.shipImg)
        self.maxHealth = health
        self.power_ups = []
        self.speed = 7
        self.shield_hits = 0  # Number of hits shield can take
        self.max_shield_hits = 3  # Shield breaks after 3 hits
        self.num_lasers = 1  # Number of lasers to shoot
        self.sound_manager = sound_manager
    
    def take_damage(self, damage):
        if self.shield_hits > 0:
            self.shield_hits -= 1
            return False  # Damage blocked
        else:
            self.health -= damage
            self.num_lasers = 1  # Reset lasers when taking damage
            return True  # Damage taken

    def shoot(self):
        if self.coolDown == 0:
            spread = 20  # Space between lasers
            if self.num_lasers == 1:
                laser = Laser(self.x, self.y, self.laserImg)
                self.lasers.append(laser)
            else:
                # Calculate positions for multiple lasers
                start_x = self.x - (spread * (self.num_lasers - 1) / 2)
                for i in range(self.num_lasers):
                    laser = Laser(start_x + (spread * i), self.y, self.laserImg)
                    self.lasers.append(laser)
            self.coolDown = 1
            self.sound_manager.play_sound('laser')

    def move_lasers(self, vel, enemies, score_manager):
        self.cool_down()
        for laser in self.lasers[:]:
            laser.move(vel)
            if laser.off_screen(h):
                self.lasers.remove(laser)
            else:
                for enemy in enemies[:]:
                    if laser.collision(enemy):
                        enemies.remove(enemy)
                        if laser in self.lasers:
                            self.lasers.remove(laser)
                        score_manager.add_score(10)

    def draw(self, window):
        super().draw(window)
        self.health_bar(window)
        
        # Draw shield indicator if active
        if self.shield_hits > 0:
            shield_color = (0, 191, 255)  # Deep Sky Blue
            shield_radius = max(self.get_width(), self.get_height()) + 10
            shield_surface = pygame.Surface((shield_radius * 2, shield_radius * 2), pygame.SRCALPHA)
            pygame.draw.circle(shield_surface, (*shield_color, 128), (shield_radius, shield_radius), shield_radius, 2)
            
            # Draw shield hit counter
            shield_font = pygame.font.SysFont('comicsans', 20)
            shield_text = shield_font.render(f"Shield: {self.shield_hits}", 1, shield_color)
            window.blit(shield_text, (self.x, self.y - 20))
            
            # Position shield around ship
            window.blit(shield_surface, 
                       (self.x + self.get_width()//2 - shield_radius,
                        self.y + self.get_height()//2 - shield_radius))

    def health_bar(self, window):
        pygame.draw.rect(window, (255, 0, 0),
                         (self.x, self.y + self.shipImg.get_height() + 10, self.shipImg.get_width(), 10))
        pygame.draw.rect(window, (0, 255, 0),
                         (self.x, self.y + self.shipImg.get_height() + 10,
                          self.shipImg.get_width() * (self.health / self.maxHealth), 10))


class Enemy(Ship):
    colorMap = {
        'red': (redSpaceship, redLasers),
        'green': (greenSpaceship, greenLasers),
        'blue': (blueSpaceship, blueLasers)
    }

    def __init__(self, x, y, color, health=100):
        super().__init__(x, y, health)
        self.shipImg, self.laserImg = self.colorMap[color]
        self.mask = pygame.mask.from_surface(self.shipImg)

    def move(self, velocity):
        self.y += velocity

    def shoot(self):
        if self.coolDown == 0:
            laser = Laser(self.x + self.get_width()//2 - 20, self.y, self.laserImg)
            self.lasers.append(laser)
            self.coolDown = 1


def collide(obj1, obj2):
    offset_x = obj2.x - obj1.x
    offset_y = obj2.y - obj1.y
    return obj1.mask.overlap(obj2.mask, (offset_x, offset_y)) is not None


class GameState:
    MENU = "menu"
    PLAYING = "playing"
    PAUSED = "paused"
    GAME_OVER = "game_over"


class SoundManager:
    def __init__(self):
        pygame.mixer.init()
        self.sounds = {}
        sound_files = {
            'laser': 'laser.wav',
            'explosion': 'explosion.wav',
            'game_over': 'game_over.wav'
        }
        
        # Try to load each sound file
        for sound_name, file_name in sound_files.items():
            try:
                self.sounds[sound_name] = pygame.mixer.Sound(os.path.join('assets', file_name))
            except FileNotFoundError:
                print(f"Warning: Sound file '{file_name}' not found")
        
        # Try to load background music
        self.music = os.path.join('assets', 'background_music.mp3')
        if not os.path.exists(self.music):
            print("Warning: Background music file not found")
            self.music = None
    
    def play_sound(self, sound_name):
        if sound_name in self.sounds:
            self.sounds[sound_name].play()
    
    def play_music(self):
        if self.music and os.path.exists(self.music):
            pygame.mixer.music.load(self.music)
            pygame.mixer.music.play(-1)
    
    def stop_music(self):
        pygame.mixer.music.stop()


class ScoreManager:
    def __init__(self):
        self.score = 0
        self.high_scores = self.load_high_scores()
    
    def add_score(self, points):
        self.score += points
    
    def load_high_scores(self):
        try:
            with open('high_scores.json', 'r') as f:
                return json.load(f)
        except:
            return []
    
    def save_high_score(self):
        self.high_scores.append(self.score)
        self.high_scores.sort(reverse=True)
        self.high_scores = self.high_scores[:5]  # Keep top 5
        
        with open('high_scores.json', 'w') as f:
            json.dump(self.high_scores, f)


class PowerUp(pygame.sprite.Sprite):
    TYPES = {
        'shield': (255, 0, 0),    # Red
        'multi_shot': (255, 255, 0),  # Yellow
        'health': (0, 255, 0)     # Green
    }
    
    def __init__(self, x, y, power_type):
        super().__init__()
        self.type = power_type
        self.x = x
        self.y = y
        self.velocity = 3
        
        # Create a simple colored square for the power-up
        self.image = pygame.Surface((20, 20))
        self.image.fill(self.TYPES[power_type])
        self.mask = pygame.mask.from_surface(self.image)
    
    def move(self):
        self.y += self.velocity
    
    def draw(self, window):
        window.blit(self.image, (self.x, self.y))


def main():
    pygame.init()
    sound_manager = SoundManager()
    score_manager = ScoreManager()
    current_state = GameState.MENU
    
    while True:
        if current_state == GameState.MENU:
            # Reset game objects when entering menu state
            player = Player(500, 480, sound_manager)
            enemies = []
            power_ups = []
            score_manager.score = 0
            
        FPS = 60
        clock = pygame.time.Clock()
        clock.tick(FPS)
        
        if current_state == GameState.MENU:
            current_state = handle_menu()
        elif current_state == GameState.PLAYING:
            current_state = handle_game_state(player, power_ups, score_manager, enemies)
        elif current_state == GameState.PAUSED:
            current_state = handle_pause_menu()
        elif current_state == GameState.GAME_OVER:
            current_state = handle_game_over(score_manager)
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    if current_state == GameState.PLAYING:
                        current_state = GameState.PAUSED
                    elif current_state == GameState.PAUSED:
                        current_state = GameState.PLAYING


def main_menu():
    menuFont = pygame.font.SysFont('comicsans', 70)
    run = True
    while run:
        window.blit(background, (0, 0))
        menuTitle = menuFont.render('Press the mouse to begin...', 1, (255, 255, 255))
        window.blit(menuTitle, (w / 2 - menuTitle.get_width() / 2, 350))
        pygame.display.update()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                run = False
            if event.type == pygame.MOUSEBUTTONDOWN:
                main()

    quit()


def handle_menu():
    window.blit(background, (0, 0))
    title_font = pygame.font.SysFont('comicsans', 70)
    controls_font = pygame.font.SysFont('comicsans', 40)
    
    # Title
    title_text = title_font.render('SPACE INVADERS', 1, (255, 255, 255))
    window.blit(title_text, (w/2 - title_text.get_width()/2, 200))
    
    # Controls
    controls = [
        "Controls:",
        "W - Move Up",
        "S - Move Down",
        "A - Move Left",
        "D - Move Right",
        "SPACE - Shoot",
        "ESC - Pause Game",
        "Note: Game gets harder as your score increases!"
    ]
    
    for i, control in enumerate(controls):
        control_text = controls_font.render(control, 1, (255, 255, 255))
        window.blit(control_text, (w/2 - control_text.get_width()/2, 300 + i * 45))
    
    # Start button
    start_text = title_font.render('Click here to Start', 1, (255, 255, 0))
    start_text_rect = start_text.get_rect(center=(w/2, h - 150))
    window.blit(start_text, start_text_rect)
    
    pygame.display.update()
    
    # Handle input
    for event in pygame.event.get():
        if event.type == pygame.MOUSEBUTTONDOWN:
            mouse_pos = pygame.mouse.get_pos()
            if start_text_rect.collidepoint(mouse_pos):
                return GameState.PLAYING
    return GameState.MENU


def handle_game_state(player, power_ups, score_manager, enemies):
    # Calculate current level and difficulty modifiers
    level = score_manager.score // 100 + 1
    enemy_speed = 1 + (level * 0.2)  # Enemies move faster with each level
    enemy_shoot_chance = max(140 - (level * 10), 60)  # Enemies shoot more frequently (120 -> 60)
    max_enemies = min(5 + (level // 2), 12)  # More enemies spawn (max 12)
    
    # Get keyboard input
    keys = pygame.key.get_pressed()
    
    # Player movement
    if keys[pygame.K_a] and player.x - player.speed > 0:  # A key for left
        player.x -= player.speed
    if keys[pygame.K_d] and player.x + player.speed + player.get_width() < w:  # D key for right
        player.x += player.speed
    if keys[pygame.K_w] and player.y - player.speed > 0:  # W key for up
        player.y -= player.speed
    if keys[pygame.K_s] and player.y + player.speed + player.get_height() < h:  # S key for down
        player.y += player.speed
    
    # Shooting
    if keys[pygame.K_SPACE]:
        player.shoot()
    
    # Enemy spawning and management
    if len(enemies) < max_enemies:
        x = random.randrange(50, w-100)
        y = random.randrange(-150, -50)
        color = random.choice(['red', 'blue', 'green'])
        enemy = Enemy(x, y, color)
        enemies.append(enemy)
    
    # Move enemies
    for enemy in enemies[:]:
        enemy.move(enemy_speed)  # Use dynamic speed
        enemy.move_lasers(5 + level, player)  # Faster enemy lasers
        
        if random.randrange(0, enemy_shoot_chance) == 1:
            enemy.shoot()
            
        # Check for collision with player
        if collide(enemy, player):
            if player.take_damage(25):  # Returns True if damage was taken
                enemies.remove(enemy)
                score_manager.add_score(-15)  # Penalty only if damage taken
            else:
                enemies.remove(enemy)  # Remove enemy even if shield blocks damage
            
        elif enemy.y + enemy.get_height() > h:
            enemies.remove(enemy)
            player.health -= 20  # Penalty for letting enemy pass
            score_manager.add_score(-20)  # Score penalty
    
    # Move player lasers
    player.move_lasers(-6, enemies, score_manager)
    
    # Power-up spawning
    if random.randrange(0, 180) == 1:  # Random chance to spawn power-up
        x = random.randrange(50, w-100)
        y = random.randrange(-150, -50)
        power_type = random.choice(['shield', 'multi_shot', 'health'])
        power_up = PowerUp(x, y, power_type)
        power_ups.append(power_up)
    
    # Move and check power-ups
    for power_up in power_ups[:]:
        power_up.move()
        if power_up.y + 20 > h:  # Remove if off screen
            power_ups.remove(power_up)
        elif collide(power_up, player):
            if power_up.type == 'shield':
                player.shield_hits = player.max_shield_hits
            elif power_up.type == 'multi_shot':
                player.num_lasers += 1
            elif power_up.type == 'health':
                player.health = min(player.health + 30, player.maxHealth)
            power_ups.remove(power_up)
    
    # Draw everything
    window.blit(background, (0, 0))
    
    # Draw enemies
    for enemy in enemies:
        enemy.draw(window)
    
    # Draw player and power-ups
    player.draw(window)
    for power_up in power_ups:
        power_up.draw(window)
    
    # Draw score
    score_label = pygame.font.SysFont('comicsans', 40).render(f"Score: {score_manager.score}", 1, (255, 255, 255))
    window.blit(score_label, (10, 10))
    
    # Draw health
    health_label = pygame.font.SysFont('comicsans', 40).render(f"Health: {player.health}", 1, (255, 255, 255))
    window.blit(health_label, (10, 50))
    
    # Calculate and display level (based on score)
    level = score_manager.score // 100 + 1
    level_label = pygame.font.SysFont('comicsans', 40).render(f"Level: {level}", 1, (255, 255, 255))
    window.blit(level_label, (10, 90))
    
    pygame.display.update()
    
    # Check game over condition
    if player.health <= 0:
        return GameState.GAME_OVER
        
    return GameState.PLAYING


def handle_pause_menu():
    pause_font = pygame.font.SysFont('comicsans', 70)
    pause_text = pause_font.render('GAME PAUSED', 1, (255, 255, 255))
    window.blit(pause_text, (w/2 - pause_text.get_width()/2, h/2))
    pygame.display.update()
    return GameState.PAUSED


def handle_game_over(score_manager):
    score_manager.save_high_score()
    window.blit(background, (0, 0))
    game_over_font = pygame.font.SysFont('comicsans', 70)
    score_text = game_over_font.render(f'Final Score: {score_manager.score}', 1, (255, 255, 255))
    restart_text = game_over_font.render('Press R to Restart', 1, (255, 255, 255))
    
    window.blit(score_text, (w/2 - score_text.get_width()/2, h/2 - 50))
    window.blit(restart_text, (w/2 - restart_text.get_width()/2, h/2 + 50))
    pygame.display.update()
    
    for event in pygame.event.get():
        if event.type == pygame.KEYDOWN and event.key == pygame.K_r:
            # Reset game state
            score_manager.score = 0
            return GameState.MENU
    return GameState.GAME_OVER


main_menu()
