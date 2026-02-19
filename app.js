// VS専用簡易版（安定動作版）
// 成功条件（最新版）:
// 1) vsスー(A) >= 1
// 2) VS合計 >= 2  （AもVSとしてカウント）  VS合計 = A + VS&火 + VS&闇 + VSのみ
// 3) 火 >= 1       火 = VS&火 + 火のみ
// 4) 闇 >= 1       闇 = VS&闇 + 闇のみ
//
// H=5程度なので全列挙で正確に計算（条件変更に強い）

function toInt(v, fallback = 0) {
  const x = Number.parseInt(String(v), 10);
  return Number.isFinite(x) ? x : fallback;
}

function combination(n, k) {
  n = toInt(n); k = toInt(k);
  if (k < 0 || n < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let num = 1, den = 1;
  for (let i = 1; i <= k; i++) {
    num *= (n - (k - i));
    den *= i;
  }
  return num / den;
}

function probabilityVsSuUsable(params) {
  const { N, H, nA, nVF, nVD, nV, nF, nD, nO } = params;

  if (N <= 0) return { ok: false, message: "デッキ枚数Nが不正です。" };
  if (H <= 0) return { ok: false, message: "初手枚数Hが不正です。" };
  if (H > N) return { ok: false, message: "初手枚数Hがデッキ枚数Nを超えています。" };

  const denom = combination(N, H);
  if (denom === 0) return { ok: false, message: "組合せ計算に失敗しました。" };

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

              const hasA = a >= 1;
              const vsTotal = a + vf + vd + v;   // AもVSに含める
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

  p = Math.max(0, Math.min(1, p));
  return { ok: true, p };
}

document.addEventListener("DOMContentLoaded", () => {
  const els = {
    deckSize: document.getElementById("deckSize"),
    handSize: document.getElementById("handSize"),

    nA:  document.getElementById("nA"),
    nVF: document.getElementById("nVF"),
    nVD: document.getElementById("nVD"),
    nV:  document.getElementById("nV"),
    nF:  document.getElementById("nF"),
    nD:  document.getElementById("nD"),
    nO:  document.getElementById("nO"),

    status: document.getElementById("status"),
    checkBox: document.getElementById("checkBox"),
    resultBox: document.getElementById("resultBox"),

    calcBtn: document.getElementById("calcBtn"),
    resetBtn: document.getElementById("resetBtn"),
    saveBtn: document.getElementById("saveBtn"),
    loadBtn: document.getElementById("loadBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importFile: document.getElementById("importFile"),
  };

  // ID不一致を画面に表示（原因がすぐ分かる）
  const required = ["deckSize","handSize","nA","nVF","nVD","nV","nF","nD","nO","status","checkBox","resultBox","calcBtn","resetBtn"];
  const missing = required.filter(k => !els[k]);
  if (missing.length) {
    const msg =
      `エラー：HTMLのidが一致しません。\n` +
      `見つからない要素: ${missing.join(", ")}\n` +
      `index.html と app.js を丸ごと同時に置き換えてください。`;
    if (els.resultBox) els.resultBox.textContent = msg;
    if (els.status) els.status.textContent = "JS初期化失敗";
    return;
  }

  const DEFAULTS = { deckSize: 40, handSize: 5, nA: 1, nVF: 6, nVD: 6, nV: 3, nF: 4, nD: 4 };
  const STORAGE_KEY = "vs_prob_simple_v3";

  function readParams() {
    const N = Math.max(0, toInt(els.deckSize.value, DEFAULTS.deckSize));
    const H = Math.max(0, toInt(els.handSize.value, DEFAULTS.handSize));

    const nA  = Math.max(0, toInt(els.nA.value, 0));
    const nVF = Math.max(0, toInt(els.nVF.value, 0));
    const nVD = Math.max(0, toInt(els.nVD.value, 0));
    const nV  = Math.max(0, toInt(els.nV.value, 0));
    const nF  = Math.max(0, toInt(els.nF.value, 0));
    const nD  = Math.max(0, toInt(els.nD.value, 0));

    const sumWithoutOther = nA + nVF + nVD + nV + nF + nD;
    const nO = Math.max(0, N - sumWithoutOther);

    return { N, H, nA, nVF, nVD, nV, nF, nD, nO, sumWithoutOther };
  }

  function syncOtherAndValidate() {
    const p = readParams();
    els.nO.value = String(p.nO);

    const notes = [];
    if (p.sumWithoutOther > p.N) {
      notes.push(`❌ 合計がNを超えています：${p.sumWithoutOther} > N=${p.N}`);
    } else if (p.sumWithoutOther < p.N) {
      notes.push(`ℹ 不足分は「その他」に自動で入ります：その他=${p.nO}`);
    } else {
      notes.push("✅ 合計はNと一致しています");
    }

    if (p.H > p.N) notes.push("❌ 初手枚数HがNを超えています");
    if (p.nA === 0) notes.push("⚠ vsスーが0枚です（成功確率は0%）");

    const vsTotalInDeck = p.nA + p.nVF + p.nVD + p.nV;
    if (vsTotalInDeck < 2) notes.push("⚠ デッキ内のVS合計が2枚未満なので成功確率は0%になります");

    els.checkBox.textContent = notes.map(x => `- ${x}`).join("\n");

    const disabled = (p.sumWithoutOther > p.N) || (p.H > p.N) || (p.N <= 0) || (p.H <= 0);
    els.calcBtn.disabled = disabled;
    els.resetBtn.disabled = false;
    els.status.textContent = disabled ? "入力を修正してください（合計超過 / H>N など）" : "準備OK";
  }

  function calculate() {
    syncOtherAndValidate();
    const p = readParams();
    if (p.sumWithoutOther > p.N) {
      els.resultBox.textContent = "エラー：合計がNを超えています。";
      return;
    }
    const r = probabilityVsSuUsable(p);
    if (!r.ok) {
      els.resultBox.textContent = r.message;
      return;
    }
    els.resultBox.textContent = `vsスーが使用できる確率： ${(r.p * 100).toFixed(2)}%`;
  }

  function resetToDefaults() {
    els.deckSize.value = String(DEFAULTS.deckSize);
    els.handSize.value = String(DEFAULTS.handSize);
    els.nA.value  = String(DEFAULTS.nA);
    els.nVF.value = String(DEFAULTS.nVF);
    els.nVD.value = String(DEFAULTS.nVD);
    els.nV.value  = String(DEFAULTS.nV);
    els.nF.value  = String(DEFAULTS.nF);
    els.nD.value  = String(DEFAULTS.nD);
    els.resultBox.textContent = "—";
    syncOtherAndValidate();
    els.status.textContent = "初期値に戻しました";
  }

  function saveToLocal() {
    const p = readParams();
    const data = {
      deckSize: p.N, handSize: p.H,
      nA: p.nA, nVF: p.nVF, nVD: p.nVD, nV: p.nV, nF: p.nF, nD: p.nD
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    els.status.textContent = "保存しました（このブラウザ内）";
  }

  function loadFromLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { els.status.textContent = "保存データがありません"; return; }
    try {
      const d = JSON.parse(raw);
      els.deckSize.value = String(toInt(d.deckSize, DEFAULTS.deckSize));
      els.handSize.value = String(toInt(d.handSize, DEFAULTS.handSize));
      els.nA.value  = String(toInt(d.nA, DEFAULTS.nA));
      els.nVF.value = String(toInt(d.nVF, DEFAULTS.nVF));
      els.nVD.value = String(toInt(d.nVD, DEFAULTS.nVD));
      els.nV.value  = String(toInt(d.nV, DEFAULTS.nV));
      els.nF.value  = String(toInt(d.nF, DEFAULTS.nF));
      els.nD.value  = String(toInt(d.nD, DEFAULTS.nD));
      syncOtherAndValidate();
      els.status.textContent = "読み込みました";
    } catch {
      els.status.textContent = "読み込みに失敗しました（保存データが壊れている可能性）";
    }
  }

  function exportJSON() {
    const p = readParams();
    const data = {
      deckSize: p.N, handSize: p.H,
      nA: p.nA, nVF: p.nVF, nVD: p.nVD, nV: p.nV, nF: p.nF, nD: p.nD
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vs_deck.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    els.status.textContent = "JSONをエクスポートしました";
  }

  function importJSONFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result));
        els.deckSize.value = String(toInt(d.deckSize, DEFAULTS.deckSize));
        els.handSize.value = String(toInt(d.handSize, DEFAULTS.handSize));
        els.nA.value  = String(toInt(d.nA, DEFAULTS.nA));
        els.nVF.value = String(toInt(d.nVF, DEFAULTS.nVF));
        els.nVD.value = String(toInt(d.nVD, DEFAULTS.nVD));
        els.nV.value  = String(toInt(d.nV, DEFAULTS.nV));
        els.nF.value  = String(toInt(d.nF, DEFAULTS.nF));
        els.nD.value  = String(toInt(d.nD, DEFAULTS.nD));
        syncOtherAndValidate();
        els.status.textContent = "JSONをインポートしました";
      } catch {
        els.status.textContent = "インポート失敗（JSON形式が不正）";
      }
    };
    reader.readAsText(file);
  }

  // iOS対策：input + change 両方で反応させる
  const watch = [els.deckSize, els.handSize, els.nA, els.nVF, els.nVD, els.nV, els.nF, els.nD];
  watch.forEach(el => {
    el.addEventListener("input", syncOtherAndValidate);
    el.addEventListener("change", syncOtherAndValidate);
  });

  els.calcBtn.addEventListener("click", calculate);
  els.resetBtn.addEventListener("click", resetToDefaults);
  if (els.saveBtn) els.saveBtn.addEventListener("click", saveToLocal);
  if (els.loadBtn) els.loadBtn.addEventListener("click", loadFromLocal);
  if (els.exportBtn) els.exportBtn.addEventListener("click", exportJSON);
  if (els.importFile) {
    els.importFile.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importJSONFile(file);
      e.target.value = "";
    });
  }

  // 初期化
  resetToDefaults();
});
