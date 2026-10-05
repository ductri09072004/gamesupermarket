import './ui/styles.css';
import './ui/theme.css';
import './ui/menuRetro.css';
import './ui/modalRetro.css';
import './ui/hudRetro.css';
import './ui/registerRetro.css';
import './ui/toolRetro.css';
import './ui/pcXp.css';
import './ui/driveHud.css';
import './ui/perf.css';
import './ui/map.css';
import { Game } from './game/Game';
import { watchInstall } from './ui/install';

watchInstall();

const game = new Game(document.getElementById('game-root')!);
void game.boot().then(() => {
  // ?bench=drive: chạy kịch bản đo hiệu năng tự động (xem game/Bench.ts)
  const bench = new URLSearchParams(location.search).get('bench');
  if (bench) void import('./game/Bench').then((m) => m.runBench(game, bench));
});
