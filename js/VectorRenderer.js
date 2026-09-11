// Shared camera-space wireframe projection for the game and splash scenes.
export function drawWireModel(graphics, model, {
    heading = 0, position = { x: 0, y: 0, z: 0 }, ...projection
} = {}) {
    const sin = Math.sin(heading), cos = Math.cos(heading);
    const transform = ({ x, y, z }) => ({
        x: x * cos - z * sin + position.x,
        y: y + position.y,
        z: x * sin + z * cos + position.z,
    });
    for (const { points, close } of model) {
        drawWirePath(graphics, points.map(transform), { ...projection, close });
    }
}

export function strokeVector(graphics, a, b, color = 0xf5fff6, width = 2) {
    for (const [weight, alpha] of [[width + 4, 0.07], [width + 2, 0.16], [width, 1]]) {
        graphics.lineStyle(weight, color, alpha);
        graphics.lineBetween(...a, ...b);
    }
}

export function drawWirePath(graphics, vertices, {
    color = 0xf5fff6, width = 2, close = false,
    centerX = 480, centerY = 299, focalLength = 480, near = 0.05,
} = {}) {
    const count = vertices.length + (close ? 1 : 0);
    for (let i = 1; i < count; i++) {
        let a = vertices[i - 1];
        let b = vertices[i % vertices.length];
        if (a.z < near && b.z < near) continue;
        if (a.z < near || b.z < near) {
            const t = (near - a.z) / (b.z - a.z);
            const clipped = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near };
            if (a.z < near) a = clipped;
            else b = clipped;
        }
        const project = p => [centerX + p.x / p.z * focalLength, centerY - p.y / p.z * focalLength];
        strokeVector(graphics, project(a), project(b), color, width);
    }
}
