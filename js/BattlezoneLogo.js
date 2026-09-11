import { strokeVector } from "./VectorRenderer.js";

export function drawBattlezoneLogo(scene, y = 104) {
        const originY = y;
        const graphics = scene.add.graphics();
        // Angular outline letters traced in a common 0..100 design grid.
        const letters = {
            B: [[[0, 0], [83, 0], [96, 20], [63, 50], [96, 75], [83, 100], [0, 100], [0, 0]],
            [[23, 17], [62, 17], [23, 49], [62, 83], [23, 83], [23, 17]]],
            A: [[[0, 100], [49, 0], [100, 100], [75, 100], [49, 85], [23, 100], [0, 100]],
            [[35, 74], [49, 39], [65, 74], [49, 65], [35, 74]]],
            T: [[[0, 0], [100, 0], [100, 25], [64, 25], [51, 100], [37, 25], [0, 25], [0, 0]]],
            L: [[[0, 0], [30, 0], [30, 75], [100, 100], [0, 100], [0, 0]]],
            E: [[[0, 0], [100, 0], [34, 33], [70, 49], [34, 66], [100, 100], [0, 100], [0, 0]]],
            Z: [[[0, 0], [100, 0], [48, 76], [94, 100], [0, 100], [51, 25], [0, 0]]],
            O: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]],
            [[23, 17], [77, 17], [77, 83], [23, 83], [23, 17]]],
            N: [[[0, 100], [0, 0], [78, 38], [100, 0], [100, 100], [40, 62], [0, 100]]],
        };
        [..."BATTLEZONE"].forEach((letter, index) => {
            for (const points of letters[letter]) {
                const scaled = points.map(([x, y]) => [135 + index * 79 + x * 0.77, originY + y * 0.65]);
                for (let i = 1; i < scaled.length; i++) strokeVector(graphics, scaled[i - 1], scaled[i]);
            }
        });
    }

