import { drawBattlezoneLogo } from "./BattlezoneLogo.js";
import { createTankModel } from "./WireModels.js";
import { drawWireModel } from "./VectorRenderer.js";

export class SplashScene extends Phaser.Scene {
    constructor() {
        super("Splash");
    }

    create() {
        const { width, height } = this.scale;
        drawBattlezoneLogo(this);
        this.tankGraphics = this.add.graphics();
        this.tankAngle = -0.9;
        this.tankModel = createTankModel();
        this.drawTank();
        const menuStyle = {
            fontFamily: '"Courier New", monospace', fontSize: "27px",
            fontStyle: "bold", color: "#f5fff6",
            shadow: { color: "#f5fff6", blur: 3, fill: true },
        };
        this.add.text(width / 2, 463, "CLICK OR SPACE STARTS GAME", menuStyle).setOrigin(0.5);
        this.add.text(width / 2, 506, "O KEY FOR OPTIONS", menuStyle).setOrigin(0.5);

        const toggleOptions = () => this.scene.start("Options");

        let starting = false;
        const startGame = () => {
            if (starting) return;
            starting = true;
            this.scene.start("Game");
        };
        this.input.keyboard.on("keydown-ENTER", startGame);
        this.input.keyboard.on("keydown-SPACE", startGame);
        this.input.keyboard.addCapture(["O"]);
        this.input.keyboard.on("keydown-O", toggleOptions);
        this.input.on("pointerdown", startGame);
        this.events.once("shutdown", () => {
            this.input.keyboard.off("keydown-ENTER", startGame);
            this.input.keyboard.off("keydown-SPACE", startGame);
            this.input.keyboard.off("keydown-F1", startGame);
            this.input.keyboard.off("keydown-F2", toggleOptions);
            this.input.keyboard.removeCapture(["F1", "F2"]);
            this.input.off("pointerdown", startGame);
        });
    }

    update(_time, delta) {
        this.tankAngle = (this.tankAngle + delta * 0.00035) % (Math.PI * 2);
        this.drawTank();
    }

    drawTank() {
        this.tankGraphics.clear();
        drawWireModel(this.tankGraphics, this.tankModel, {
            heading: this.tankAngle,
            position: { x: 0, y: 0, z: 10 },
            centerX: 480, centerY: 280, focalLength: 450, width: 1.6,
        });
    }
}
