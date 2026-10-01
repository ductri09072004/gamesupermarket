import './ui/styles.css';
import './ui/theme.css';
import './ui/menuRetro.css';
import './ui/modalRetro.css';
import './ui/hudRetro.css';
import './ui/toolRetro.css';
import './ui/pcXp.css';
import { Game } from './game/Game';
import { watchInstall } from './ui/install';

watchInstall();

const game = new Game(document.getElementById('game-root')!);
void game.boot();
