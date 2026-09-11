import { GameScene } from "./GameScene.js";
import { SplashScene } from "./SplashScene.js";
import { OptionsScene } from "./OptionsScene.js";

const config = {
    type: Phaser.WEBGL,
    width: 960,
    height: 540,
    backgroundColor: "#000000",
    pixelArt: true,
    roundPixels: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [SplashScene, OptionsScene, GameScene],
    fps: { target: 60, forceSetTimeOut: true },
};


new Phaser.Game(config);


