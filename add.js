// ========= Utilities =========

function toInt(v, fallback = 0) {
  const x = Number.parseInt(String(v), 10);
  return Number.isFinite(x) ? x : fallback;
}

// nCk を安定に計算（nが大きくても比較的安全）
// ここでは JS の浮動小数を使うので、超巨大デッキには非対応だがカードゲーム用途(<=100)なら十分。
function combination(n, k) {
  n = toInt(n); k = toInt(k);
  if (k < 0 || n < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);

  let num = 1;
  let den = 1;
  for (let i = 1; i <= k; i++) {
    num *= (n - (k - i));
    den *= i;
  }
  return num / den;
}

function probNoDrawFromSubset(N, subsetSize, H) {
  // 「サイズ subsetSize の集合から1枚も引かない」確率 = C(N - subsetSize, H)/C(N, H)
  if (subsetSize <= 0) return 1;
  if (N - subsetSize < H) return 0;
  return combination(N - subsetSize, H) / combination(N, H);
}

// ========= Domain logic =========
// カード行データ：{ name, count, isA, e1, e2, e3 }
// ルール：e2 と e3 は共存しない（両方 true なら無効）

function classifyRow(row) {
  // A行はカテゴリ集約では「A」として別扱い（A以外カテゴリから除外）
  if (row.isA) return "A";

  const e1 = !!row.e1;
  const e2 = !!row.e2;
  const e3 = !!row.e3;

  if (e2 && e3) return "INVALID"; // ルール違反

  if (e1 && e2) return "X12";
  if (e1 && e3) return "X13";
  if (e1) return "X1";
  if (e2) return "X2";
  if (e3) return "X3";
  return "X0";
}

function aggregate(deckSize, rows) {
  const agg = {
    N: deckSize,
    nA: 0,
    n1: 0,
    n2: 0,
    n3: 0,
    n12: 0,
    n13: 0,
    n0: 0,
    invalid: 0,
    totalList: 0
  };

  for (const r of rows) {
    const c = Math.max(0, toInt(r.count, 0));
    agg.totalList += c;

    const cls = classifyRow(r);
    if (cls === "INVALID") {
      agg.invalid += c;
      continue;
    }
    if (cls === "A") { agg.nA += c; continue; }
    if (cls === "X1") agg.n1 += c;
    else if (cls === "X2") agg.n2 += c;
    else if (cls === "X3") agg.n3 += c;
    else if (cls === "X12") agg.n12 += c;
    else if (cls === "X13") agg.n13 += c;
    else if (cls === "X0") agg.n0 += c;
  }

  // デッキサイズとリスト合計が一致しない場合、残りをX0に自動補完する選択肢もあるが
  // ここでは「警告だけ」出す（勝手に補完するとユーザーが気づきにくい）
  return agg;
}

// 包除原理で P(success) を計算
// 成功条件：手札にAがあり、A以外で要素1>=1、要素2>=1、要素3>=1
// 要素1：X1 + X12 + X13
// 要素2：X2 + X12
// 要素3：X3 + X13
function probabilityAUsable(agg, handSize) {
  const N = agg.N;
  const H = handSize;

  if (H > N) return { ok: false, message: "初手枚数Hがデッキ枚数Nを超えています。" };
  if (N <= 0) return { ok: false, message: "デッキ枚数Nが不正です。" };

  // subset sizes for "missing" events
  const uA = agg.nA;
  const u1 = agg.n1 + agg.n12 + agg.n13;
  const u2 = agg.n2 + agg.n12;
  const u3 = agg.n3 + agg.n13;

  // helper: P(F_S) where F_S means "missing all in each named subset" i.e. no draw from union size u
  const pNo = (u) => probNoDrawFromSubset(N, u, H);

  // sizes for unions (because categories are disjoint, union sizes can be computed directly)
  const uA1   = agg.nA + agg.n1 + agg.n12 + agg.n13;
  const uA2   = agg.nA + agg.n2 + agg.n12;
  const uA3   = agg.nA + agg.n3 + agg.n13;
  const u12   = agg.n1 + agg.n2 + agg.n12 + agg.n13;
  const u13   = agg.n1 + agg.n3 + agg.n12 + agg.n13;
  const u23   = agg.n2 + agg.n3 + agg.n12 + agg.n13;

  const uA12  = agg.nA + agg.n1 + agg.n2 + agg.n12 + agg.n13;
  const uA13  = agg.nA + agg.n1 + agg.n3 + agg.n12 + agg.n13;
  const uA23  = agg.nA + agg.n2 + agg.n3 + agg.n12 + agg.n13;
  const u123  = agg.n1 + agg.n2 + agg.n3 + agg.n12 + agg.n13;

  const uA123 = agg.nA + agg.n1 + agg.n2 + agg.n3 + agg.n12 + agg.n13;

  // Inclusion-Exclusion for P(F_A ∪ F_1 ∪ F_2 ∪ F_3)
  const singles =
    pNo(uA) + pNo(u1) + pNo(u2) + pNo(u3);

  const pairs =
    pNo(uA1) + pNo(uA2) + pNo(uA3) +
    pNo(u12) + pNo(u13) + pNo(u23);

  const triples =
    pNo(uA12) + pNo(uA13) + pNo(uA23) + pNo(u123);

  const quad = pNo(uA123);

  const pFail = singles - pairs + triples - quad;
  const pSuccess = 1 - pFail;

  // clamp due to floating rounding
  const p = Math.max(0, Math.min(1, pSuccess));

  return { ok: true, p };
}

// ========= UI =========

const els = {
  deckSize: document.getElementById("deckSize"),
  handSize: document.getElementById("handSize"),
  addRowBtn: document.getElementById("addRowBtn"),
  calcBtn: document.getElementById("calcBtn"),
  status: document.getElementById("status"),
  deckTbody: document.getElementById("deckTbody"),
  aggBox: document.getElementById("aggBox"),
  checkBox: document.getElementById("checkBox"),
  resultBox: document.getElementById("resultBox"),

  saveBtn: document.getElementById("saveBtn"),
  loadBtn: document.getElementById("loadBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  clearBtn: document.getElementById("clearBtn"),
};

function newRowData() {
  return { name: "", count: 0, isA: false, e1: false, e2: false, e3: false };
}

function renderRow(row, idx) {
  const tr = document.createElement("tr");

  const tdName = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = row.name;
  nameInput.placeholder = "例: キーカード";
  nameInput.addEventListener("input", () => { row.name = nameInput.value; });
  tdName.appendChild(nameInput);

  const tdCount = document.createElement("td");
  const countInput = document.createElement("input");
  countInput.type = "number";
  countInput.min = "0";
  countInput.step = "1";
  countInput.value = row.count;
  countInput.addEventListener("input", () => { row.count = toInt(countInput.value, 0); });
  tdCount.appendChild(countInput);

  function makeCheckCell(prop, className = "center") {
    const td = document.createElement("td");
    td.className = className;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!row[prop];
    cb.addEventListener("change", () => {
      row[prop] = cb.checked;

      // ルール：要素2 と 要素3 は共存しない
      if (prop === "e2" && cb.checked) row.e3 = false;
      if (prop === "e3" && cb.checked) row.e2 = false;

      // A？をONにしても要素チェックはそのまま（Aの属性を後で使う拡張に備える）
      renderAll();
    });
    td.appendChild(cb);
    return td;
  }

  const tdIsA = makeCheckCell("isA");
  const tdE1  = makeCheckCell("e1");
  const tdE2  = makeCheckCell("e2");
  const tdE3  = makeCheckCell("e3");

  const tdDel = document.createElement("td");
  tdDel.className = "center";
  const delBtn = document.createElement("button");
  delBtn.textContent = "削除";
  delBtn.addEventListener("click", () => {
    deckRows.splice(idx, 1);
    renderAll();
  });
  tdDel.appendChild(delBtn);

  tr.append(tdName, tdCount, tdIsA, tdE1, tdE2, tdE3, tdDel);
  return tr;
}

let deckRows = [
  // 初期サンプル（自由に消してOK）
  { name: "カードA", count: 1, isA: true,  e1: false, e2: false, e3: false },
  { name: "要素1のみ", count: 6, isA: false, e1: true,  e2: false, e3: false },
  { name: "要素2のみ", count: 6, isA: false, e1: false, e2: true,  e3: false },
  { name: "要素3のみ", count: 6, isA: false, e1: false, e2: false, e3: true  },
  { name: "その他",   count: 21, isA: false, e1: false, e2: false, e3: false },
];

function computeAndDisplay() {
  const deckSize = toInt(els.deckSize.value, 40);
  const handSize = toInt(els.handSize.value, 5);

  const agg = aggregate(deckSize, deckRows);

  // 表示：集約
  els.aggBox.textContent =
`N=${agg.N}, H=${handSize}
nA=${agg.nA}
n1=${agg.n1}
n2=${agg.n2}
n3=${agg.n3}
n12=${agg.n12}
n13=${agg.n13}
n0=${agg.n0}
invalid=${agg.invalid}
list_total=${agg.totalList}`;

  // チェック
  const problems = [];
  if (agg.invalid > 0) problems.push("要素2&3が同時ONの行があります（invalid > 0）");
  if (agg.totalList !== deckSize) problems.push(`デッキリスト合計(${agg.totalList})がN(${deckSize})と一致しません`);
  if (agg.nA <= 0) problems.push("Aの枚数(nA)が0です（A？にチェックした行が必要）");

  els.checkBox.textContent = problems.length ? problems.map(x => `- ${x}`).join("\n") : "OK";

  // 計算
  const r = probabilityAUsable(agg, handSize);
  if (!r.ok) {
    els.resultBox.textContent = r.message;
    els.status.textContent = "入力を確認してください。";
    return;
  }

  els.resultBox.textContent = `Aが使用できる確率： ${(r.p * 100).toFixed(2)}%`;
  els.status.textContent = "計算完了";
}

function renderAll() {
  els.deckTbody.innerHTML = "";
  deckRows.forEach((row, idx) => {
    els.deckTbody.appendChild(renderRow(row, idx));
  });
  computeAndDisplay();
}

// ========= Storage / Import-Export =========

const STORAGE_KEY = "deck_prob_app_v1";

function saveToLocal() {
  const data = {
    deckSize: toInt(els.deckSize.value, 40),
    handSize: toInt(els.handSize.value, 5),
    rows: deckRows
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  els.status.textContent = "保存しました（このブラウザ内）";
}

function loadFromLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    els.status.textContent = "保存データが見つかりません";
    return;
  }
  try {
    const data = JSON.parse(raw);
    els.deckSize.value = toInt(data.deckSize, 40);
    els.handSize.value = toInt(data.handSize, 5);
    deckRows = Array.isArray(data.rows) ? data.rows : [];
    els.status.textContent = "読み込みました";
    renderAll();
  } catch {
    els.status.textContent = "読み込みに失敗しました（保存データが壊れている可能性）";
  }
}

function exportJSON() {
  const data = {
    deckSize: toInt(els.deckSize.value, 40),
    handSize: toInt(els.handSize.value, 5),
    rows: deckRows
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "deck.json";
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
      const data = JSON.parse(String(reader.result));
      els.deckSize.value = toInt(data.deckSize, 40);
      els.handSize.value = toInt(data.handSize, 5);
      deckRows = Array.isArray(data.rows) ? data.rows : [];
      els.status.textContent = "JSONをインポートしました";
      renderAll();
    } catch {
      els.status.textContent = "インポート失敗（JSON形式が不正）";
    }
  };
  reader.readAsText(file);
}

// ========= Wire up =========

els.addRowBtn.addEventListener("click", () => {
  deckRows.push(newRowData());
  renderAll();
});

els.calcBtn.addEventListener("click", () => {
  computeAndDisplay();
});

els.saveBtn.addEventListener("click", saveToLocal);
els.loadBtn.addEventListener("click", loadFromLocal);
els.exportBtn.addEventListener("click", exportJSON);

els.importFile.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) importJSONFile(file);
  e.target.value = ""; // 同じファイルを連続で選べるように
});

els.clearBtn.addEventListener("click", () => {
  deckRows = [];
  renderAll();
  els.status.textContent = "全クリアしました";
});

// 初期表示
renderAll();
