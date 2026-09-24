// レシピの分量を人数で換算する（純粋関数。node --test で試せる）。
// データは2人分で書いてあり、4人分は2倍。小数は「大さじ・小さじ」にせず g / ml のまま出す
export const BASE_SERVINGS = 2;

export const scaleQty = (qty, servings) => {
  const v = (qty * servings) / BASE_SERVINGS;
  return Number.isInteger(v) ? v : Math.round(v * 10) / 10;
};

export const scaledIngredients = (ingredients, servings) => ingredients.map(([name, qty, unit]) => [name, scaleQty(qty, servings), unit]);
