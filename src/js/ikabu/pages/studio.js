// イカ部「studio」の入口。中身はビルド時に書き込み済みで、操作は無い
import { boot } from '../boot.js';
import { render } from '../views/studio.js';

boot(render);
