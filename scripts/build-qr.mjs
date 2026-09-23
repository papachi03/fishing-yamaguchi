// 「友だち紹介用」のQRコード画像を作る。URLはめったに変わらないので、
// ビルドのたびではなく、必要になったときだけ手で実行する：
//   node scripts/build-qr.mjs
// 出力は public/assets/qr/site-qr.png（git管理する。QRの中身は固定URLなので毎回作り直さなくてよい）

import QRCode from 'qrcode';
import { mkdirSync } from 'node:fs';

// utm_source=qr で、現地で見せて登録してもらった訪問だとGA4で分かるようにする
const URL = 'https://yamaguchifishing.com/invite.html?utm_source=qr&utm_medium=offline&utm_campaign=friend_invite';
const OUT_DIR = 'public/assets/qr';

mkdirSync(OUT_DIR, { recursive: true });
await QRCode.toFile(`${OUT_DIR}/site-qr.png`, URL, {
  width: 1000,
  margin: 2,
  color: { dark: '#20232a', light: '#f1ece1' }, // サイトの配色（墨×生成り）に合わせる
  errorCorrectionLevel: 'M',
});
console.log(`作成しました: ${OUT_DIR}/site-qr.png`);
console.log(`中身のURL: ${URL}`);
