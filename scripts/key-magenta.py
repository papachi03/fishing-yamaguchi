#!/usr/bin/env python3
"""#FF00FF（マゼンタ）の背景を透明にする小道具。ChatGPT で作った HERO のレイヤー用。

使い方:
  python scripts/key-magenta.py 入力.png 出力.png [--trim] [--pad 8] [--preview 確認用.jpg]
                                [--low 40 --high 150] [--despill 12] [--key FF00FF] [--erode 0]

やっていること（順番どおり）:
  1. 各画素の「マゼンタらしさ」 m = min(R, B) - G を出す（純マゼンタ = 255、紺・アイボリー・朱 = 0 以下）
  2. m <= --low なら不透明、m >= --high なら透明、その間はなだらかに（縁のアンチエイリアスを残す）
  3. 半透明の縁は「元の色 × α + マゼンタ × (1-α)」で混ざっているので、逆算して元の色に戻す（unmix）
  4. それでも残った紫っぽさを --despill の強さで抑える（G を min(R,B)-despill まで持ち上げる）
  5. --erode N で縁を N px 削る（フリンジが気になるときだけ。ふつうは 0）
  6. --trim で不透明部分の外接矩形（+pad）に切り詰め、その矩形を表示する（hero-anim.js の箱に写す）

紺（#182c47 前後）・アイボリー・朱は m が負なので触らない。
"""
import argparse
import sys

import numpy as np
from PIL import Image, ImageFilter


def parse_hex(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def key_magenta(img, key=(255, 0, 255), low=40, high=150, despill=12, erode=0):
    """RGB(A) の PIL 画像 → RGBA の numpy 配列（uint8）"""
    rgb = np.asarray(img.convert('RGB')).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    kr, kg, kb = key

    # 1. マゼンタらしさ。キー色が純マゼンタでない場合も同じ式で近似できる（R と B が高く G が低い色）
    m = np.minimum(r, b) - g

    # 2. α：low 以下で 1、high 以上で 0、間は直線
    alpha = np.clip((high - m) / float(high - low), 0.0, 1.0)

    # キー色との距離も見て、遠い色（例：マゼンタ寄りのピンクの塗り）が透明にならないよう保険をかける
    dist = np.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2)
    alpha = np.where(dist > 200, 1.0, alpha)

    # 3. unmix：c = fg*α + key*(1-α) → fg = (c - key*(1-α)) / α
    a_safe = np.clip(alpha, 0.02, 1.0)[..., None]
    keyv = np.array(key, dtype=np.float32)[None, None, :]
    fg = (rgb - keyv * (1.0 - a_safe)) / a_safe
    fg = np.where(alpha[..., None] > 0.02, fg, rgb)
    fg = np.clip(fg, 0, 255)

    # 4. despill：まだ G が R・B より低すぎる（紫っぽい）画素だけ G を持ち上げる
    if despill > 0:
        fr, fg_, fb = fg[..., 0], fg[..., 1], fg[..., 2]
        ceiling = np.minimum(fr, fb) - despill
        need = (fg_ < ceiling) & (alpha > 0) & (alpha < 1)
        fg[..., 1] = np.where(need, ceiling, fg_)

    out = np.dstack([fg, alpha * 255.0]).round().astype(np.uint8)

    # 5. erode
    if erode > 0:
        a_img = Image.fromarray(out[..., 3]).filter(ImageFilter.MinFilter(erode * 2 + 1))
        out[..., 3] = np.asarray(a_img)

    return out


def alpha_bbox(rgba, pad=0):
    ys, xs = np.where(rgba[..., 3] > 8)
    if not len(xs):
        return None
    h, w = rgba.shape[:2]
    return (max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + 1 + pad), min(h, ys.max() + 1 + pad))


def checkerboard(size, cell=24):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    tile = ((xx // cell + yy // cell) % 2).astype(np.uint8)
    v = np.where(tile == 0, 200, 240).astype(np.uint8)
    return Image.fromarray(np.dstack([v, v, v]), 'RGB')


def main(argv=None):
    # Windows のコンソールでも日本語が化けないように
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser(description='マゼンタ背景を透明にする')
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--key', default='FF00FF', help='背景の色（16進）')
    ap.add_argument('--low', type=int, default=40, help='この値以下のマゼンタらしさは不透明')
    ap.add_argument('--high', type=int, default=150, help='この値以上は透明')
    ap.add_argument('--despill', type=int, default=12, help='紫のにじみを抑える強さ（0 で無効）')
    ap.add_argument('--erode', type=int, default=0, help='縁を削るピクセル数')
    ap.add_argument('--trim', action='store_true', help='不透明部分の外接矩形に切り詰める')
    ap.add_argument('--pad', type=int, default=0, help='--trim のときに残す余白')
    ap.add_argument('--preview', help='市松模様に重ねた確認用 JPG の出力先')
    args = ap.parse_args(argv)

    img = Image.open(args.src)
    rgba = key_magenta(img, key=parse_hex(args.key), low=args.low, high=args.high, despill=args.despill, erode=args.erode)
    bbox = alpha_bbox(rgba, args.pad)
    if bbox is None:
        print('不透明な画素がありません（--low/--high を見直してください）', file=sys.stderr)
        return 1
    if args.trim:
        x0, y0, x1, y1 = bbox
        rgba = rgba[y0:y1, x0:x1]

    out = Image.fromarray(rgba, 'RGBA')
    out.save(args.dst, optimize=True)
    x0, y0, x1, y1 = bbox
    print(f'書き出し: {args.dst} {out.width}x{out.height}')
    print(f'不透明部分の矩形（元画像の座標）: x={x0} y={y0} w={x1 - x0} h={y1 - y0}' + ('  ← trim 済み' if args.trim else ''))

    if args.preview:
        board = checkerboard(out.size)
        board.paste(out, (0, 0), out)
        board.save(args.preview, quality=88)
        print(f'確認用: {args.preview}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
