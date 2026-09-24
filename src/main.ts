import Phaser from 'phaser';
import './ui/styles.css';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#a7d98b',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  disableContextMenu: true,
  scene: [BootScene, PreloadScene, GameScene, UIScene],
});

(window as unknown as { __game: Phaser.Game }).__game = game;
