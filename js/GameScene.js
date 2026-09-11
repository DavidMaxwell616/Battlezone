import { createTankModel, createPyramidModel, createBoxModel, createUfoModel } from "./WireModels.js";
import { drawWirePath, strokeVector } from "./VectorRenderer.js";
import { Combat, missileHit } from "./Combat.js";

export class GameScene extends Phaser.Scene {
    constructor() {
        super("Game");
        this.level = 1;
    }

    create() {
        const options = this.registry.get("options");
        this.level = options?.level || 1;
        this.sound.mute = options ? !options.sound : false;
        this.cameras.main.setScroll(-(options?.screenOffset || 0), 0);
        this.heading = 0;
        this.moonHeading = 0;
        this.moonParallax = 0.85;
        this.skyPixelsPerRadian = 960 / (Math.PI / 2);
        this.alertElapsed = 0;
        this.turnSpeed = Math.PI / 3;
        this.playerPosition = { x: 0, z: 0 };
        this.moveSpeed = 3;
        this.enemyPosition = { x: (417 - 480) / 480 * 18, z: 18 };
        this.radarRange = 42;
        this.cursors = options?.keys ? this.input.keyboard.addKeys(options.keys) : this.input.keyboard.createCursorKeys();
        this.combat = new Combat();
        this.lives = 3;
        this.hitTimer = 0;
        this.invulnerable = 2;
        this.playerCollider = {
            model: createBoxModel(0.55, 1.6, 0.55),
            position: { x: 0, y: 0, z: 0 }, heading: 0
        };
        this.cameraHeight = 1.1;
        this.createWorldObjects();
        for (const object of this.worldObjects) {
            if (object.turnSpeed) object.turnSpeed *= 1 + (this.level - 1) * 0.25;
        }
        this.worldGraphics = this.add.graphics();
        const pink = 0xf56aef;
        const white = 0xf5fff6;
        const lines = this.add.graphics();

        // Draw in the reference image's 960 by 540 coordinate space.
        // A faint outer stroke gives the vectors a little phosphor bloom.
        const path = (points, color, width = 2, close = false, graphics = lines) => {
            for (const [weight, alpha] of [[width + 4, 0.07], [width + 2, 0.16], [width, 1]]) {
                graphics.lineStyle(weight, color, alpha);
                graphics.beginPath();
                graphics.moveTo(...points[0]);
                points.slice(1).forEach(([x, y]) => graphics.lineTo(x, y));
                if (close) graphics.closePath();
                graphics.strokePath();
            }
        };

        this.generateMountains();

        // Fixed aiming reticle.
        this.reticleBounds = { left: 421, right: 538, top: 257, bottom: 340 };
        this.normalReticle = this.add.graphics();
        this.targetReticle = this.add.graphics().setVisible(false);
        path([[421, 272], [421, 255], [538, 255], [538, 272]], white, 2.2, false, this.normalReticle);
        path([[481, 211], [481, 255]], white, 2.2, false, this.normalReticle);
        path([[421, 325], [421, 342], [538, 342], [538, 325]], white, 2.2, false, this.normalReticle);
        path([[481, 342], [481, 385]], white, 2.2, false, this.normalReticle);
        path([[440, 274], [421, 257], [538, 257], [520, 274]], white, 3, false, this.targetReticle);
        path([[481, 211], [481, 257]], white, 8, false, this.targetReticle);
        path([[440, 322], [421, 340], [538, 340], [520, 322]], white, 3, false, this.targetReticle);
        path([[481, 340], [481, 385]], white, 8, false, this.targetReticle);

        // Radar has the wide oval proportions of the reference capture.
        const radar = Array.from({ length: 65 }, (_, i) => {
            const angle = i * Math.PI * 2 / 64;
            return [481 + Math.cos(angle) * 97, 88 + Math.sin(angle) * 74];
        });
        path(radar, pink, 2.2, true);
        path([[415, 39], [481, 88], [546, 39]], pink, 1.8);
        for (const tick of [[[481, 6], [481, 14]], [[481, 162], [481, 170]],
        [[375, 88], [384, 88]], [[578, 88], [587, 88]]]) path(tick, pink);
        this.radarBlip = this.add.rectangle(475.5, 55.5, 3, 3, white);

        const label = (x, y, text, size = 29) => this.add.text(x, y, text, {
            fontFamily: '"Courier New", monospace', fontSize: `${size}px`,
            fontStyle: 'bold', color: '#f56aef',
            shadow: { color: '#ed5ce8', blur: 4, fill: true },
        });
        this.enemyAlert = label(0, 60, "", 25).setLineSpacing(-3);
        label(645, -6, 'HIGH');
        label(645, 27, 'PL 1');
        this.highScoreLabel = label(935, -6, String(this.registry.get("highScore") || 0)).setOrigin(1, 0);
        this.scoreLabel = label(935, 27, '0').setOrigin(1, 0);
        this.lifeIcons = [];
        for (let i = 0; i < 3; i++) {
            const x = 799 + i * 48;
            const icon = this.add.graphics();
            this.lifeIcons.push(icon);
            icon.fillStyle(pink);
            icon.fillPoints([
                { x, y: 57 }, { x: x + 8, y: 57 }, { x: x + 8, y: 60 },
                { x: x + 32, y: 60 }, { x: x + 32, y: 63 }, { x: x + 13, y: 63 },
                { x: x + 17, y: 67 }, { x: x + 25, y: 67 }, { x: x + 28, y: 71 },
                { x: x + 35, y: 71 }, { x: x + 35, y: 73 }, { x, y: 73 },
            ], true);
        }
        this.hitOverlay = this.add.graphics().setDepth(100).setScrollFactor(0).setVisible(false);
        this.hitLabel = this.add.text(480, 480, "", {
            fontFamily: '"Courier New", monospace',
            fontSize: "24px", fontStyle: "bold", color: "#f56aef", backgroundColor: "#000000"
        })
            .setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false);
        const restart = () => { if (this.lives === 0) this.scene.restart(); };
        this.input.keyboard.on("keydown-ENTER", restart);
        this.events.once("shutdown", () => this.input.keyboard.off("keydown-ENTER", restart));
        this.drawWorld();
        this.updateRadar();
    }

    createWorldObjects() {
        // Objects have world positions and independently controlled headings.
        this.enemyPosition.y = 0.85;
        this.worldObjects = [
            { model: createPyramidModel(), position: { x: -2.8, y: 0, z: 8 }, heading: 0.2, color: 0x55ffff },
            { model: createBoxModel(), position: { x: -1.5, y: 0, z: 24 }, heading: 0.25, color: 0x55ffff },
            { model: createTankModel(), position: this.enemyPosition, heading: -0.35, color: 0xf5fff6, destructible: true, points: 500, turnSpeed: Math.PI / 16 },
            { model: createUfoModel(), position: { x: 8, y: 1.25, z: 22 }, heading: 0.2, color: 0xf5fff6, destructible: true, points: 1000, roaming: true },
        ];
        this.generateObstacles(24);
    }

    generateObstacles(count) {
        let placed = 0;
        // Scatter once per game, around the full horizon, with room to drive between models.
        for (let attempt = 0; attempt < count * 80 && placed < count; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(14 * 14 + Math.random() * (65 * 65 - 14 * 14));
            const position = { x: this.playerPosition.x + Math.sin(angle) * radius, y: 0,
                z: this.playerPosition.z + Math.cos(angle) * radius };
            if (this.worldObjects.some(object =>
                Math.hypot(object.position.x - position.x, object.position.z - position.z) < 8)) continue;

            const halfWidth = 0.9 + Math.random() * 1.1;
            const height = 1.2 + Math.random() * 2;
            const model = Math.random() < 0.5
                ? createPyramidModel(halfWidth, height)
                : createBoxModel(halfWidth, height, 0.9 + Math.random() * 1.1);
            this.worldObjects.push({ model, position, heading: Math.random() * Math.PI * 2, color: 0x55ffff });
            placed++;
        }
    }

    update(_time, delta) {
        if (this.lives === 0) return;
        if (this.hitTimer > 0) {
            this.hitTimer -= delta / 1000;
            if (this.hitTimer <= 0) this.respawnPlayer();
            return;
        }
        this.alertElapsed += delta;
        this.updateEnemyAlert();
        const direction = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const movement = Number(this.cursors.up.isDown) - Number(this.cursors.down.isDown);
        const seconds = delta / 1000;
        this.invulnerable = Math.max(0, this.invulnerable - seconds);
        const previousHeading = this.heading;
        const turn = direction * this.turnSpeed * seconds;
        // Integrate separately so wrapping the player heading cannot make the moon jump.
        this.moonHeading = Phaser.Math.Angle.Wrap(this.moonHeading + turn * this.moonParallax);
        const nextHeading = previousHeading + turn;
        const speed = movement * this.moveSpeed;
        if (direction) {
            // Integrate the turning arc so combined steering and movement is frame-rate independent.
            const radius = speed / (direction * this.turnSpeed);
            this.playerPosition.x += radius * (Math.cos(previousHeading) - Math.cos(nextHeading));
            this.playerPosition.z += radius * (Math.sin(nextHeading) - Math.sin(previousHeading));
        } else {
            this.playerPosition.x += Math.sin(previousHeading) * speed * seconds;
            this.playerPosition.z += Math.cos(previousHeading) * speed * seconds;
        }
        this.heading = Phaser.Math.Angle.Wrap(nextHeading);
        this.respawnEnemies(seconds);
        this.turnTanksTowardsPlayer(seconds);
        this.updateTankAttacks(seconds);
        this.updateUfos(seconds);
        this.playerCollider.position = { ...this.playerPosition, y: 0 };
        this.playerCollider.heading = -this.heading;
        const hit = this.combat.update(seconds, this.worldObjects, this.invulnerable > 0 ? null : this.playerCollider);
        this.scoreLabel.setText(String(this.combat.score));
        if (this.combat.score > (this.registry.get("highScore") || 0)) {
            this.registry.set("highScore", this.combat.score);
            this.highScoreLabel.setText(String(this.combat.score));
        }
        if (hit) { this.onPlayerHit(); return; }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
            this.combat.fire(this.playerPosition, this.heading, this.cameraHeight);
        }
        this.drawWorld();
        this.updateRadar();
    }

    respawnEnemies(seconds) {
        for (let i = 0; i < this.worldObjects.length; i++) {
            const enemy = this.worldObjects[i];
            if (!enemy.destructible || !enemy.destroyed) continue;
            enemy.respawnDelay = Math.max(0, (enemy.respawnDelay ?? 2.5) - seconds);
            if (enemy.respawnDelay > 0) continue;

            // Spawn away from the player and existing objects; retry next frame if crowded.
            for (let attempt = 0; attempt < 32; attempt++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 24 + Math.random() * 10;
                const position = {
                    x: this.playerPosition.x + Math.sin(angle) * distance,
                    y: enemy.position.y,
                    z: this.playerPosition.z + Math.cos(angle) * distance,
                };
                if (this.worldObjects.some(object => !object.destroyed &&
                    Math.hypot(object.position.x - position.x, object.position.z - position.z) < 8)) continue;

                // Replace the object rather than reviving its old hit/cooldown state.
                this.worldObjects[i] = {
                    model: enemy.model, position, color: enemy.color,
                    heading: Math.atan2(this.playerPosition.x - position.x, position.z - this.playerPosition.z),
                    destructible: true, points: enemy.points, turnSpeed: enemy.turnSpeed,
                    roaming: enemy.roaming,
                    fireCooldown: 2.5,
                };
                break;
            }
        }
    }

    updateUfos(seconds) {
        for (const ufo of this.worldObjects) {
            if (!ufo.roaming || ufo.destroyed) continue;
            ufo.roamTimer = (ufo.roamTimer || 0) - seconds;
            const targetDrift = ufo.destination ? Math.hypot(
                ufo.destination.x - this.playerPosition.x, ufo.destination.z - this.playerPosition.z) : Infinity;
            if (!ufo.destination || ufo.roamTimer <= 0 || targetDrift > 36) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 12 + Math.random() * 18;
                ufo.destination = { x: this.playerPosition.x + Math.sin(angle) * distance,
                    z: this.playerPosition.z + Math.cos(angle) * distance };
                ufo.roamTimer = 3 + Math.random() * 3;
            }
            const dx = ufo.destination.x - ufo.position.x, dz = ufo.destination.z - ufo.position.z;
            const distance = Math.hypot(dx, dz);
            if (distance < 0.1) { ufo.roamTimer = 0; continue; }
            const step = Math.min(2.2 * seconds, distance);
            const next = { x: ufo.position.x + dx / distance * step,
                y: ufo.position.y, z: ufo.position.z + dz / distance * step };
            const blocked = this.worldObjects.some(object => object !== ufo && !object.destroyed &&
                Math.hypot(object.position.x - next.x, object.position.z - next.z) < 4);
            const playerDistance = Math.hypot(next.x - this.playerPosition.x, next.z - this.playerPosition.z);
            if (blocked || playerDistance < 6) { ufo.roamTimer = 0; continue; }
            ufo.position = next;
            ufo.heading = Phaser.Math.Angle.Wrap(ufo.heading + seconds * 0.35);
        }
    }

    turnTanksTowardsPlayer(seconds) {
        for (const tank of this.worldObjects) {
            if (!tank.turnSpeed || tank.destroyed) continue;
            const dx = this.playerPosition.x - tank.position.x;
            const dz = this.playerPosition.z - tank.position.z;
            if (Math.hypot(dx, dz) < 0.001) continue;
            // The model's barrel points along local -Z: forward is (sin heading, -cos heading).
            const desiredHeading = Math.atan2(dx, -dz);
            const difference = Phaser.Math.Angle.Wrap(desiredHeading - tank.heading);
            const maxTurn = tank.turnSpeed * seconds;
            tank.heading = Phaser.Math.Angle.Wrap(tank.heading + Math.max(-maxTurn, Math.min(maxTurn, difference)));
        }
    }

    updateTankAttacks(seconds) {
        for (const tank of this.worldObjects) {
            if (!tank.turnSpeed || tank.destroyed) continue;
            tank.fireCooldown = Math.max(0, (tank.fireCooldown ?? 2.5) - seconds);
            const dx = this.playerPosition.x - tank.position.x, dz = this.playerPosition.z - tank.position.z;
            const distance = Math.hypot(dx, dz);
            const error = Phaser.Math.Angle.Wrap(Math.atan2(dx, -dz) - tank.heading);
            if (distance > 7 && Math.abs(error) < Math.PI / 3) {
                const step = Math.min(1.4 * seconds, distance - 7);
                const blocked = angle => {
                    const start = { ...tank.position, y: 0.8 };
                    const end = {
                        x: start.x + Math.sin(angle) * (step + 3), y: 0.8,
                        z: start.z - Math.cos(angle) * (step + 3)
                    };
                    return this.worldObjects.some(o => o !== tank && !o.destroyed && missileHit(start, end, o) !== null);
                };
                if (!blocked(tank.heading)) {
                    tank.position.x += Math.sin(tank.heading) * step;
                    tank.position.z -= Math.cos(tank.heading) * step;
                } else {
                    tank.avoidDirection ??= blocked(tank.heading + 0.8) ? -1 : 1;
                    tank.heading = Phaser.Math.Angle.Wrap(tank.heading + tank.avoidDirection * tank.turnSpeed * seconds * 2);
                }
            }
            const aimError = Phaser.Math.Angle.Wrap(Math.atan2(
                this.playerPosition.x - tank.position.x, tank.position.z - this.playerPosition.z) - tank.heading);
            if (distance <= this.radarRange && distance > 4 && Math.abs(aimError) < 0.08 && tank.fireCooldown === 0) {
                this.combat.fireEnemy(tank, this.playerPosition, this.cameraHeight);
                tank.fireCooldown = 2.5;
            }
        }
    }

    onPlayerHit() {
        if (this.hitTimer > 0 || this.lives === 0) return;
        this.lives--;
        this.lifeIcons.forEach((icon, i) => icon.setVisible(i < this.lives));
        this.combat.missiles = [];
        this.drawWorld();
        this.normalReticle.setVisible(false);
        this.targetReticle.setVisible(false);
        this.enemyAlert.setVisible(false);
        this.hitOverlay.clear().setVisible(true);
        const cracks = [
            [[5, 259], [154, 185], [301, 218], [401, 274], [562, 187], [729, 278], [884, 209]],
            [[301, 218], [344, 187]], [[401, 274], [361, 326], [435, 349], [470, 420], [451, 450], [391, 540]],
            [[451, 450], [504, 536]], [[401, 274], [498, 291], [565, 300], [566, 315], [659, 315], [793, 447]],
            [[729, 278], [813, 326], [808, 340], [951, 486]], [[813, 326], [898, 304]],
            [[808, 340], [955, 312]], [[659, 315], [647, 350], [581, 376]],
            [[3, 270], [68, 270], [112, 334], [159, 348], [186, 368], [193, 418], [321, 475]],
            [[68, 270], [159, 348], [256, 391], [324, 418], [310, 477], [4, 479]],
            [[3, 319], [59, 354], [3, 393]], [[82, 249], [224, 300], [219, 327], [159, 348]],
        ];
        for (const points of cracks) for (let i = 1; i < points.length; i++) {
            strokeVector(this.hitOverlay, points[i - 1], points[i], 0xf5fff6, 1.6);
        }
        this.hitLabel.setText(this.lives ? "TANK DESTROYED" : "GAME OVER — ENTER TO RESTART").setVisible(true);
        this.hitTimer = 2.5;
    }

    respawnPlayer() {
        this.playerPosition = { x: 0, z: 0 };
        this.heading = 0;
        this.moonHeading = 0;
        this.invulnerable = 2;
        this.hitOverlay.setVisible(false);
        this.hitLabel.setVisible(false);
        for (const tank of this.worldObjects) {
            if (!tank.turnSpeed || tank.destroyed) continue;
            const distance = Math.hypot(tank.position.x, tank.position.z);
            if (distance < 12) {
                const angle = Math.atan2(tank.position.x, tank.position.z);
                tank.position.x = Math.sin(angle) * 12;
                tank.position.z = Math.cos(angle) * 12;
            }
            tank.fireCooldown = 2.5;
        }
        this.drawWorld();
        this.updateRadar();
    }

    updateRadar() {
        const target = this.worldObjects.filter(o => o.destructible && !o.destroyed)
            .sort((a, b) => Math.hypot(a.position.x - this.playerPosition.x, a.position.z - this.playerPosition.z)
                - Math.hypot(b.position.x - this.playerPosition.x, b.position.z - this.playerPosition.z))[0];
        if (!target) {
            this.radarBlip.setVisible(false);
            this.updateEnemyAlert();
            return;
        }
        this.enemyPosition = target.position;
        const dx = this.enemyPosition.x - this.playerPosition.x;
        const dz = this.enemyPosition.z - this.playerPosition.z;
        const bearing = Math.atan2(dx, dz) - this.heading;
        const distance = Math.hypot(dx, dz) / this.radarRange;
        this.radarBlip.setVisible(distance <= 1);
        this.radarBlip.setPosition(
            481 + Math.sin(bearing) * distance * 97,
            88 - Math.cos(bearing) * distance * 74,
        );
        this.updateEnemyAlert();
    }

    isEnemyInCrosshairs(enemy) {
        if (!enemy.destructible || enemy.destroyed) return false;
        const dx = enemy.position.x - this.playerPosition.x;
        const dz = enemy.position.z - this.playerPosition.z;
        if (Math.hypot(dx, dz) > this.radarRange) return false;
        const depth = dx * Math.sin(this.heading) + dz * Math.cos(this.heading);
        if (depth <= 0.05) return false;
        const x = 480 + (dx * Math.cos(this.heading) - dz * Math.sin(this.heading)) / depth * 480;
        const y = 299 - (enemy.position.y - this.cameraHeight) / depth * 480;
        const { left, right, top, bottom } = this.reticleBounds;
        return x >= left && x <= right && y >= top && y <= bottom;
    }

    updateEnemyAlert() {
        const enemies = this.worldObjects.filter(o => o.destructible && !o.destroyed);
        const aimedEnemy = enemies.find(enemy => this.isEnemyInCrosshairs(enemy));
        this.normalReticle.setVisible(!aimedEnemy);
        this.targetReticle.setVisible(Boolean(aimedEnemy));
        if (!enemies.length) {
            this.enemyAlert.setVisible(false);
            return;
        }
        // An aligned UFO must count even when an off-center tank is nearer on radar.
        const target = aimedEnemy || enemies.reduce((nearest, enemy) =>
            Math.hypot(enemy.position.x - this.playerPosition.x, enemy.position.z - this.playerPosition.z)
                < Math.hypot(nearest.position.x - this.playerPosition.x, nearest.position.z - this.playerPosition.z)
                ? enemy : nearest);
        const dx = target.position.x - this.playerPosition.x;
        const dz = target.position.z - this.playerPosition.z;
        const bearing = Phaser.Math.Angle.Wrap(Math.atan2(dx, dz) - this.heading);
        let direction = "ENEMY AHEAD";
        if (Math.abs(bearing) > Math.PI * 0.75) direction = "ENEMY TO REAR";
        else if (bearing < -0.1) direction = "ENEMY TO LEFT";
        else if (bearing > 0.1) direction = "ENEMY TO RIGHT";
        this.enemyAlert.setText(`${aimedEnemy ? "ENEMY IN RANGE" : ""}\n${direction}`);
        this.enemyAlert.setVisible(Math.hypot(dx, dz) <= this.radarRange && this.alertElapsed % 1000 < 600);
    }

    drawMoon() {
        const bearing = Phaser.Math.Angle.Wrap(-150 / this.skyPixelsPerRadian - this.moonHeading);
        if (Math.abs(bearing) > 520 / this.skyPixelsPerRadian) return;
        const centerX = 480 + bearing * this.skyPixelsPerRadian;
        // Angular crescent outline from screenshot 2, kept above the distant ridge.
        const points = [[13, -20], [21, -14], [21, 0], [17, 7], [8, 13], [0, 16],
        [-15, 16], [-24, 11], [-11, 11], [-3, 8], [6, 0], [12, -7], [12, -20], [13, -20]];
        for (let i = 1; i < points.length; i++) {
            const screenPoint = ([x, y]) => [centerX + x, 210 + y];
            strokeVector(this.worldGraphics, screenPoint(points[i - 1]), screenPoint(points[i]), 0xf56aef, 2);
        }
    }

    generateMountains() {
        // Generate once per scene: the last valley joins the first at 360 degrees.
        const count = 32;
        const step = Math.PI * 2 / count;
        this.mountains = [];
        for (let i = 0; i < count; i++) {
            this.mountains.push({ angle: i * step, height: 3 + Math.random() * 9 });
            this.mountains.push({
                angle: (i + 0.3 + Math.random() * 0.4) * step,
                height: 20 + Math.random() * 34,
            });
        }
        this.mountains.push({ angle: Math.PI * 2, height: this.mountains[0].height });
    }

    drawMountains() {
        const fullTurn = Math.PI * 2;
        const halfView = Math.PI / 4;
        const heading = ((this.heading % fullTurn) + fullTurn) % fullTurn;
        const left = heading - halfView;
        const right = heading + halfView;
        const graphics = this.worldGraphics;
        // Adjacent copies let the view cross north without a gap or a new range.
        for (const offset of [-fullTurn, 0, fullTurn]) {
            for (let i = 1; i < this.mountains.length; i++) {
                const a = this.mountains[i - 1];
                const b = this.mountains[i];
                const start = Math.max(left, a.angle + offset);
                const end = Math.min(right, b.angle + offset);
                if (start >= end) continue;
                const project = angle => {
                    const t = (angle - offset - a.angle) / (b.angle - a.angle);
                    const height = a.height + (b.height - a.height) * t;
                    const bearing = angle - heading;
                    return [480 + bearing * this.skyPixelsPerRadian, 299 - height];
                };
                for (const [width, alpha] of [[6, 0.07], [4, 0.16], [2, 1]]) {
                    graphics.lineStyle(width, 0x55ffff, alpha);
                    graphics.lineBetween(...project(start), ...project(end));
                }
            }
        }
    }

    drawWorld() {
        const graphics = this.worldGraphics;
        graphics.clear();
        this.drawMoon();
        graphics.lineStyle(2, 0x55ffff, 1);
        graphics.lineBetween(0, 299, 960, 299);
        this.drawMountains();
        const sin = Math.sin(this.heading);
        const cos = Math.cos(this.heading);
        const project = ({ x, y, z }) => {
            const dx = x - this.playerPosition.x;
            const dz = z - this.playerPosition.z;
            return { x: dx * cos - dz * sin, y: y - this.cameraHeight, z: dx * sin + dz * cos };
        };
        for (const object of [...this.worldObjects, ...this.combat.missiles, ...this.combat.shards]) {
            if (object.destroyed) continue;
            const objectSin = Math.sin(object.heading);
            const objectCos = Math.cos(object.heading);
            const transform = ({ x, y, z }) => {
                const pitch = object.pitch || 0;
                const tiltedY = y * Math.cos(pitch) - z * Math.sin(pitch);
                z = y * Math.sin(pitch) + z * Math.cos(pitch);
                return project({
                    x: object.position.x + x * objectCos - z * objectSin,
                    y: object.position.y + tiltedY,
                    z: object.position.z + x * objectSin + z * objectCos,
                });
            };
            for (const { points, close } of object.model) {
                drawWirePath(graphics, points.map(transform), {
                    color: object.color, width: 2, close,
                });
            }
        }
    }
}
