// イカ部「sources」の入口。中身はビルド時に書き込み済みで、操作は無い
import { boot } from '../boot.js';
import { render } from '../views/sources.js';

boot(render);
