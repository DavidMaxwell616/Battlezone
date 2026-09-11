import { drawBattlezoneLogo } from "./BattlezoneLogo.js";
import { createTankModel } from "./WireModels.js";
import { drawWireModel } from "./VectorRenderer.js";

export class OptionsScene extends Phaser.Scene {
    constructor() { super("Options"); }

    create() {
        this.remapping = null;
        this.settings = this.registry.get("options") || {
            level: 1, sound: true, screenOffset: 0,
            keys: { up: 38, down: 40, left: 37, right: 39, space: 32 },
        };
        this.registry.set("options", this.settings);
        const style = { fontFamily: '"Courier New", monospace', fontSize: "26px",
            fontStyle: "bold", color: "#f5fff6", shadow: { color: "#f5fff6", blur: 3, fill: true } };
        const label = (x, y, text, size = 26) => this.add.text(x, y, text, { ...style, fontSize: `${size}px` });
        label(480, 37, "OPTION SELECTION").setOrigin(0.5, 0);
        const row = (x, y, text, action) => label(x, y, text).setInteractive({ useHandCursor: true }).on("pointerdown", action);
        const start = () => this.scene.start("Game");
        const players = () => this.notice.setText("TWO PLAYER MODE NOT AVAILABLE");
        const level = () => { this.settings.level = this.settings.level % 5 + 1; this.refresh(); };
        const sound = () => { this.settings.sound = !this.settings.sound; this.sound.mute = !this.settings.sound; this.refresh(); };
        const shift = amount => {
            this.settings.screenOffset = Math.max(-40, Math.min(40, this.settings.screenOffset + amount));
            this.cameras.main.setScroll(-this.settings.screenOffset, 0);
        };
        const calibrate = () => this.notice.setText("JOYSTICK NOT AVAILABLE — KEYBOARD ONLY");
        row(70, 80, "F1 START GAME", start);
        row(70, 102, "F3 1-2 PLAYERS", players);
        row(70, 124, "F5 SELECT LEVEL", level);
        row(70, 146, " S SOUND ON/OFF", sound);
        row(510, 80, " F9 SCREEN LEFT", () => shift(-4));
        row(510, 102, "F10 SCREEN RIGHT", () => shift(4));
        row(510, 124, "  C CHANGE KEYS", () => this.changeKeys());
        row(510, 146, "  X CALIBRATE", calibrate);
        label(600, 168, "JOYSTICK");
        drawBattlezoneLogo(this, 222);
        drawWireModel(this.add.graphics(), createTankModel(), {
            heading: 0, position: { x: 0, y: 0, z: 10 },
            centerX: 480, centerY: 365, focalLength: 570, width: 1.8,
        });
        this.levelLabel = label(622, 426, "");
        label(94, 469, "KEYBOARD ONLY ENABLED");
        label(94, 512, "ONE PLAYER");
        this.soundLabel = label(645, 512, "");
        this.notice = label(480, 453, "ESC / F2: BACK", 14).setOrigin(0.5);
        this.refresh();
        this.cameras.main.setScroll(-this.settings.screenOffset, 0);

        const actions = { F1: start, F3: players, F5: level, S: sound,
            F9: () => shift(-4), F10: () => shift(4), C: () => this.changeKeys(), X: calibrate,
            Escape: () => this.scene.start("Splash"), F2: () => this.scene.start("Splash") };
        const captured = ["F1", "F2", "F3", "F5", "F9", "F10"];
        this.input.keyboard.addCapture(captured);
        const handleKey = event => {
            if (event.repeat) return;
            if (this.remapping) {
                event.preventDefault();
                if (event.key === "Escape") { this.remapping = null; this.notice.setText("KEY CHANGES CANCELLED"); return; }
                const code = event.keyCode;
                if (Object.values(this.pendingKeys).includes(code)) { this.notice.setText("KEY ALREADY USED — CHOOSE ANOTHER"); return; }
                this.pendingKeys[this.remapping.shift()] = code;
                if (!this.remapping.length) {
                    this.settings.keys = this.pendingKeys;
                    this.remapping = null;
                    this.notice.setText("KEYS SAVED — F1 TO START");
                } else this.promptKey();
                return;
            }
            actions[event.key.length === 1 ? event.key.toUpperCase() : event.key]?.();
        };
        this.input.keyboard.on("keydown", handleKey);
        this.events.once("shutdown", () => {
            this.input.keyboard.off("keydown", handleKey);
            this.input.keyboard.removeCapture(captured);
        });
    }

    refresh() {
        this.levelLabel.setText(`LEVEL ${this.settings.level}`);
        this.soundLabel.setText(`SOUND ${this.settings.sound ? "ON" : "OFF"}`);
    }

    changeKeys() {
        this.remapping = ["up", "down", "left", "right", "space"];
        this.pendingKeys = {};
        this.promptKey();
    }

    promptKey() {
        const names = { up: "FORWARD", down: "REVERSE", left: "TURN LEFT", right: "TURN RIGHT", space: "FIRE" };
        this.notice.setText(`PRESS KEY FOR ${names[this.remapping[0]]} — ESC CANCELS`);
    }
}
