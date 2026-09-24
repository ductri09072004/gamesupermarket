import type Phaser from 'phaser';
import { AudioEngine } from './Audio';
import { bus } from './EventBus';
import { createNewState, type SaveData, type Settings } from './GameState';
import { SaveSystem } from './SaveSystem';
import { Services, setServices } from './Services';
import { showMainMenu } from '../ui/menu';

export const audio = new AudioEngine();
const menuSettings: Settings = { muted: false, music: true, gameOverEnabled: true, cameraFollow: true };

export function applyAudioSettings(st: Settings): void {
  audio.setMuted(st.muted);
  audio.setMusic(st.music && !st.muted);
}

export function showMenu(game: Phaser.Game): void {
  const saves = new SaveSystem();
  const saved = saves.load();
  const settings = saved?.settings ?? menuSettings;
  applyAudioSettings(settings);
  showMainMenu(
    {
      hasSave: !!saved && !saved.gameOver,
      onContinue: () => startGame(game, saves.load() ?? createNewState()),
      onNewGame: () => {
        saves.clear();
        const fresh = createNewState();
        fresh.settings = { ...settings };
        startGame(game, fresh);
      },
    },
    settings,
    (st) => {
      applyAudioSettings(st);
      if (saved) saves.save({ ...saved, settings: st });
    },
  );
}

export function startGame(game: Phaser.Game, data: SaveData): void {
  bus.clear();
  audio.attach(bus);
  const s = new Services(data);
  setServices(s);
  applyAudioSettings(data.settings);
  game.scene.start('Game');
  game.scene.start('UI');
}

export function quitToMenu(game: Phaser.Game): void {
  game.scene.stop('UI');
  game.scene.stop('Game');
  setServices(null);
  bus.clear();
  document.querySelectorAll('#ui-root > *').forEach((el) => el.remove());
  showMenu(game);
}
