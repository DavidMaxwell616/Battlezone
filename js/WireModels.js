// Model coordinates use Y up; tank tracks rest at Y = -0.85.
export function createMissileModel() {
    const corners = [{ x: -0.12, y: -0.12, z: 0 }, { x: 0.12, y: -0.12, z: 0 },
        { x: 0.12, y: 0.12, z: 0 }, { x: -0.12, y: 0.12, z: 0 }];
    return [{ points: corners, close: true }, { points: [corners[0], corners[2]] },
        { points: [corners[1], corners[3]] }];
}

export function createPyramidModel(halfWidth = 1.8, height = 2.5) {
    const base = [
        { x: -halfWidth, y: 0, z: -halfWidth },
        { x: halfWidth, y: 0, z: -halfWidth },
        { x: halfWidth, y: 0, z: halfWidth },
        { x: -halfWidth, y: 0, z: halfWidth },
    ];
    const apex = { x: 0, y: height, z: 0 };
    return [{ points: base, close: true }, ...base.map(point => ({ points: [point, apex] }))];
}

export function createBoxModel(halfWidth = 1.3, height = 1.8, halfDepth = 1.3) {
    const base = [
        { x: -halfWidth, y: 0, z: -halfDepth },
        { x: halfWidth, y: 0, z: -halfDepth },
        { x: halfWidth, y: 0, z: halfDepth },
        { x: -halfWidth, y: 0, z: halfDepth },
    ];
    const top = base.map(point => ({ ...point, y: height }));
    return [
        { points: base, close: true }, { points: top, close: true },
        ...base.map((point, i) => ({ points: [point, top[i]] })),
    ];
}

export function createUfoModel() {
    // ufo.png: a wide equatorial rim with matching tapered upper/lower shells.
    const ring = (radius, y) => Array.from({ length: 8 }, (_, i) => {
        const angle = i * Math.PI / 4;
        return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius };
    });
    const rings = [ring(0.5, -0.6), ring(2.1, 0), ring(0.5, 0.6)];
    const paths = rings.map(points => ({ points, close: true }));
    for (let layer = 1; layer < rings.length; layer++) {
        rings[layer].forEach((point, i) => {
            paths.push({ points: [rings[layer - 1][i], point] });
        });
    }
    return paths;
}

export function createTankModel() {
        const paths = [];
        const ring = (points) => paths.push({ points, close: true });
        const connect = (a, b) => {
            ring(a);
            ring(b);
            a.forEach((point, i) => paths.push({ points: [point, b[i]] }));
        };
        const rectangle = (halfWidth, y, front, back) => [
            { x: -halfWidth, y, z: front }, { x: halfWidth, y, z: front },
            { x: halfWidth, y, z: back }, { x: -halfWidth, y, z: back },
        ];
        // Sloped hull and raised trapezoidal turret.
        connect(rectangle(1.55, -0.35, -2.5, 2.3), rectangle(1.15, 0.25, -1.6, 1.6));
        connect(rectangle(0.85, 0.25, -0.85, 1.05), rectangle(0.55, 1.05, -0.45, 0.7));
        // Two separate track housings, with beveled ends and tread divisions.
        for (const side of [-1, 1]) {
            const profile = [[-2.55, -0.3], [-2.15, -0.85], [1.95, -0.85], [2.4, -0.3]];
            const inner = profile.map(([z, y]) => ({ x: side * 1.1, y, z }));
            const outer = profile.map(([z, y]) => ({ x: side * 1.65, y, z }));
            connect(inner, outer);
            for (let z = -1.8; z <= 1.8; z += 0.6) {
                paths.push({
                    points: [
                        { x: side * 1.65, y: -0.85, z },
                        { x: side * 1.65, y: -0.3, z: z - 0.25 },
                    ]
                });
            }
        }
        // Square-section cannon barrel and its open muzzle.
        const barrel = z => [
            { x: -0.13, y: 0.61, z }, { x: 0.13, y: 0.61, z },
            { x: 0.13, y: 0.84, z }, { x: -0.13, y: 0.84, z },
        ];
        connect(barrel(-0.55), barrel(-3.35));
        return paths;
}
