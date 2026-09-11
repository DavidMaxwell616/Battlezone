import { createMissileModel } from "./WireModels.js";

// Segment versus object-local bounds: fast shots cannot skip through a target.
export function missileHit(start, end, object) {
    const sin = Math.sin(object.heading), cos = Math.cos(object.heading);
    const local = p => {
        const x = p.x - object.position.x, z = p.z - object.position.z;
        return { x: x * cos + z * sin, y: p.y - object.position.y, z: -x * sin + z * cos };
    };
    const a = local(start), b = local(end);
    const points = object.model.flatMap(path => path.points);
    let enter = 0, leave = 1;
    for (const axis of ["x", "y", "z"]) {
        const min = Math.min(...points.map(p => p[axis])) - 0.08;
        const max = Math.max(...points.map(p => p[axis])) + 0.08;
        const delta = b[axis] - a[axis];
        if (Math.abs(delta) < 1e-9) {
            if (a[axis] < min || a[axis] > max) return null;
        } else {
            const t1 = (min - a[axis]) / delta, t2 = (max - a[axis]) / delta;
            enter = Math.max(enter, Math.min(t1, t2));
            leave = Math.min(leave, Math.max(t1, t2));
            if (enter > leave) return null;
        }
    }
    return enter;
}

export class Combat {
    constructor() {
        this.missiles = [];
        this.shards = [];
        this.cooldown = 0;
        this.score = 0;
        this.missileModel = createMissileModel();
    }

    fire(position, heading, height) {
        if (this.cooldown > 0) return;
        this.cooldown = 0.3;
        this.missiles.push({
            model: this.missileModel, color: 0xf5fff6, heading: -heading,
            position: { x: position.x + Math.sin(heading) * 0.7, y: height - 0.3,
                z: position.z + Math.cos(heading) * 0.7 },
            velocity: { x: Math.sin(heading) * 28, z: Math.cos(heading) * 28 },
            life: 4,
        });
    }

    fireEnemy(tank, playerPosition, height) {
        const position = { x: tank.position.x + Math.sin(tank.heading) * 3.5,
            y: tank.position.y + 0.72, z: tank.position.z - Math.cos(tank.heading) * 3.5 };
        const dx = playerPosition.x - position.x, dz = playerPosition.z - position.z;
        const dy = height - 0.3 - position.y;
        const length = Math.hypot(dx, dy, dz);
        if (length < 0.01) return;
        this.missiles.push({ model: this.missileModel, color: 0xf5fff6,
            heading: -Math.atan2(dx, dz), position, owner: tank, enemy: true,
            velocity: { x: dx / length * 14, y: dy / length * 14, z: dz / length * 14 }, life: 5 });
    }

    explode(object) {
        const sin = Math.sin(object.heading), cos = Math.cos(object.heading);
        for (let i = 0; i < 22; i++) {
            const path = object.model[i % object.model.length];
            const p = path.points[i % path.points.length];
            const size = 0.12 + Math.random() * 0.3;
            this.shards.push({
                model: [{ close: true, points: [{ x: -size, y: 0, z: 0 },
                    { x: size, y: size, z: size * 0.5 }, { x: 0, y: -size, z: size }] }],
                position: { x: object.position.x + p.x * cos - p.z * sin,
                    y: object.position.y + p.y, z: object.position.z + p.x * sin + p.z * cos },
                velocity: { x: (Math.random() - 0.5) * 8, y: 2 + Math.random() * 5, z: (Math.random() - 0.5) * 8 },
                heading: Math.random() * Math.PI * 2, pitch: 0,
                spin: (Math.random() - 0.5) * 10, life: 1.5 + Math.random(), color: object.color,
            });
        }
    }

    update(seconds, objects, player = null) {
        let playerHit = false;
        this.cooldown = Math.max(0, this.cooldown - seconds);
        for (const shard of this.shards) {
            shard.life -= seconds;
            shard.position.x += shard.velocity.x * seconds;
            shard.position.z += shard.velocity.z * seconds;
            shard.position.y += shard.velocity.y * seconds - 2.5 * seconds * seconds;
            shard.velocity.y -= 5 * seconds;
            shard.heading += shard.spin * seconds;
            shard.pitch += seconds * 3;
        }
        this.shards = this.shards.filter(s => s.life > 0 && s.position.y > -0.5);
        for (const missile of this.missiles) {
            const travelTime = Math.min(seconds, missile.life);
            const end = { ...missile.position, x: missile.position.x + missile.velocity.x * travelTime,
                y: missile.position.y + (missile.velocity.y || 0) * travelTime,
                z: missile.position.z + missile.velocity.z * travelTime };
            let target = null, nearest = Infinity;
            for (const object of objects) {
                if (object.destroyed || object === missile.owner) continue;
                const hit = missileHit(missile.position, end, object);
                if (hit !== null && hit < nearest) { nearest = hit; target = object; }
            }
            if (missile.enemy && player) {
                const hit = missileHit(missile.position, end, player);
                if (hit !== null && hit < nearest) target = player;
            }
            missile.position = end;
            missile.life -= seconds;
            if (target) {
                missile.life = 0;
                if (target === player) playerHit = true;
                else if (target.destructible && !missile.enemy) {
                    target.destroyed = true;
                    this.score += target.points || 0;
                    this.explode(target);
                }
            }
        }
        this.missiles = this.missiles.filter(m => m.life > 0);
        return playerHit;
    }
}
