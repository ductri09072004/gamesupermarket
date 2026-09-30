import './ui/styles.css';
import './ui/theme.css';
import { Game } from './game/Game';

const game = new Game(document.getElementById('game-root')!);
void game.boot();
