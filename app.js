function probabilityVsSuUsable(params) {
  const { N, H, nA, nVF, nVD, nV, nF, nD, nO } = params;

  if (N <= 0) return { ok: false, message: "デッキ枚数Nが不正です。" };
  if (H <= 0) return { ok: false, message: "初手枚数Hが不正です。" };
  if (H > N) return { ok: false, message: "初手枚数Hがデッキ枚数Nを超えています。" };

  const denom = combination(N, H);
  if (denom === 0) return { ok: false, message: "組合せ計算に失敗しました。" };

  // カテゴリ順：A, VF, VD, V, F, D, O
  const caps = [nA, nVF, nVD, nV, nF, nD, nO];

  let p = 0;

  for (let a = 0; a <= Math.min(nA, H); a++) {
    for (let vf = 0; vf <= Math.min(nVF, H - a); vf++) {
      for (let vd = 0; vd <= Math.min(nVD, H - a - vf); vd++) {
        for (let v = 0; v <= Math.min(nV, H - a - vf - vd); v++) {
          for (let f = 0; f <= Math.min(nF, H - a - vf - vd - v); f++) {
            for (let d = 0; d <= Math.min(nD, H - a - vf - vd - v - f); d++) {
              const used = a + vf + vd + v + f + d;
              const o = H - used;
              if (o < 0 || o > nO) continue;

              // 成功条件（新仕様）
              const hasA = a >= 1;
              const vsTotal = a + vf + vd + v;        // ← AもVSとしてカウント
              const hasVs2 = vsTotal >= 2;
              const hasFire = (vf + f) >= 1;
              const hasDark = (vd + d) >= 1;

              if (!(hasA && hasVs2 && hasFire && hasDark)) continue;

              const ways =
                combination(nA, a) *
                combination(nVF, vf) *
                combination(nVD, vd) *
                combination(nV, v) *
                combination(nF, f) *
                combination(nD, d) *
                combination(nO, o);

              p += ways / denom;
            }
          }
        }
      }
    }
  }

  // clamp
  p = Math.max(0, Math.min(1, p));
  return { ok: true, p };
}
