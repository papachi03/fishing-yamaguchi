// イカ部「recipes」（イカ食堂の一覧）の入口。一覧はビルド時に書き込み済みで、操作は無い
import { boot } from '../boot.js';
import { render } from '../views/recipes.js';

boot(render);
