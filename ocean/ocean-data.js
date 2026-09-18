/* ═══════════════════════════════════════════════════════════════════════
   ocean-data.js ─ OCEAN のデータ層（音階・テトラコルド・ノード・航路・分潮）

   設計原則5「データと処理の分離」に従い、**数値と出典だけ**をここに置く。
   処理（発音・伝播・変異・潮汐計算）は ocean.html 側の関数が行う。
   file:// でも読めるよう script タグで読み込む（fetch しない）。

   ■ 各エントリの note / source
     note   … その数値をどう解釈したか、何が仮説で何が定説かを書く欄
     source … 出典。空欄は「未出典＝仮説」を意味する。書き換え歓迎。

   ■ 音階の内部表現は cents（1200 = 1オクターブ）。12平均律は基準ではなく、
     「たまたま中間音が 100 の倍数に並んだ一例」として cents で表される。

   ■ 音階の mode（degree → cents の決め方）
     "octave" … cents[] を1オクターブ内の音として持ち、degree が音数を超えたら
                 +1200 して上のオクターブへ回る（従来の民族音階と同じ挙動）
     "abs"    … degree ごとの絶対 cents を並べる。末尾を超えたら末尾で飽和
     "gen"    … 式で生成する。kind:"harmonic"（倍音列 n倍）/
                 kind:"ratio-power"（比の累乗）

   ■ テトラコルド（小泉文夫）
     核音（動きにくい枠）＝ 0 と frame（完全4度 ≒ 498c）と upperCore（完全5度）と 1200。
     可動音（inner）＝ 枠の内側。ここが変異し、混交する。
     日本の4種は「下の核音からの可動音位置」だけが違う：
        都節 100c / 律 200c / 民謡 300c / 琉球 400c
     同じ「完全4度枠＋可動音」構造はアラブの jins、インドの purvanga/uttaranga
     にも見られる。これが「海路で繋がる文化圏を一つのパラメータ空間に置ける」根拠。
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2;
  var C_JUST_4TH = 1200 * Math.log2(4 / 3);   // 498.045
  var C_JUST_5TH = 1200 * Math.log2(3 / 2);   // 701.955

  /* ── 可動音テトラコルド辞書 ────────────────────────────────────
     morph（混交）の行き先として使う。inner は下の核音からの cents。       */
  var TETRACHORDS = {
    // ─ 日本（小泉文夫の四種）：可動音は 100 / 200 / 300 / 400 の一点だけ違う
    "都節":   { inner: [100], region: "日本", note: "陰音階。可動音 100c＝短2度。",  source: "小泉文夫『日本傳統音楽の研究』（1958）テトラコルド論" },
    "律":     { inner: [200], region: "日本", note: "雅楽の律。可動音 200c＝長2度。", source: "小泉文夫（同上）" },
    "民謡":   { inner: [300], region: "日本", note: "民謡テトラコルド。可動音 300c。", source: "小泉文夫（同上）" },
    "琉球":   { inner: [400], region: "琉球", note: "可動音 400c。核音は同じで可動音だけが 400 に寄る。", source: "小泉文夫（同上）" },

    // ─ アラブ／トルコの jins（4音の枠）。地域差・演奏家差が大きい近似値
    "rast":   { inner: [200, 350], region: "アラブ", note: "Rast 0-200-350-500。第3音は 340〜360c の幅で歌われる（地域差）。", source: "" },
    "bayati": { inner: [150, 300], region: "アラブ", note: "Bayati 0-150-300-500。第2音は 140〜160c の幅。", source: "" },
    "hijaz":  { inner: [100, 400], region: "アラブ", note: "Hijaz 0-100-400-500。増2度の跳躍が特徴。", source: "" },
    "nahawand":{ inner: [200, 300], region: "アラブ", note: "Nahawand 0-200-300-500。西洋の短音階下半部に近い。", source: "" },

    // ─ インド（purvanga = 下の4音群）。ラーガの実際は微分音の揺れを含む
    "bhairav-purvanga": { inner: [100, 400], region: "インド", note: "ラガ・バイラヴ下半 0-100-400-500。Hijaz と同型＝海路で繋がる根拠の一例（仮説）。", source: "" },
    "yaman-purvanga":   { inner: [200, 400, 600], region: "インド", note: "ラガ・ヤマンは下半に増4度(600c)を含むため完全4度枠を持たない＝枠外。", source: "" },

    // ─ 等分割系（枠外）
    "slendro-approx": { inner: [240, 480], region: "ジャワ", note: "スレンドロの5等分割近似。実際の楽団調律(embat)は等分割ではない。", source: "" }
  };

  /* ── 音階 ────────────────────────────────────────────────────────
     name は UI 表示と preset の値を兼ねるので**既存名を変更しない**。
     cents は既存の半音値を ×100 したもの（＝移し替えで音高は不変）。
     tetra は分解できたものだけ。できないものは null＋note に理由。         */
  var SCALES = [
    {
      name: "ペンタトニック", mode: "octave", cents: [0, 200, 400, 700, 900],
      frame: null, tetra: null,
      note: "完全5度(700c)は持つが完全4度(500c)の核音を欠くため、テトラコルド分解不能＝枠外扱い。ヨナ抜き長音階。",
      source: ""
    },
    {
      name: "ヒラジョシ", mode: "octave", cents: [0, 200, 300, 700, 800],
      frame: null, tetra: null,
      note: "この綴りは平調子の一異名（0-200-300-700-800）。500c の核音を欠くため枠外。都節系の平調子（0-100-500-700-800）とは別形。",
      source: ""
    },
    {
      name: "インセン", mode: "octave", cents: [0, 100, 500, 700, 1000],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [100] }, upper: { inner: [300] } },
      note: "下が都節(100c)・上が民謡(300c)の混成テトラコルド。上下で可動音位置が違う＝すでに混交した形（仮説）。",
      source: ""
    },
    {
      name: "都節", mode: "octave", cents: [0, 100, 500, 700, 800],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [100] }, upper: { inner: [100] } },
      note: "上下ともに都節テトラコルド。frame が 500 なのは12平均律近似のため（純正の完全4度は 498.045c）。",
      source: "小泉文夫（1958）"
    },
    {
      name: "ラガ・バイラヴ", mode: "octave", cents: [0, 100, 400, 500, 700, 800, 1100],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [100, 400] }, upper: { inner: [100, 400] } },
      note: "下半・上半ともに 0-100-400-500＝アラブの Hijaz と同型。インド洋航路での構造の共有（仮説）。",
      source: ""
    },
    {
      name: "ラガ・ヤマン", mode: "octave", cents: [0, 200, 400, 600, 700, 900, 1100],
      frame: null, upperCore: 700, tetra: null,
      note: "下半が 0-200-400-600（増4度枠）。完全4度の核音を持たないため枠外。リディア的。",
      source: ""
    },
    {
      name: "マカーム・ラスト", mode: "octave", cents: [0, 200, 350, 500, 700, 900, 1050],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [200, 350] }, upper: { inner: [200, 350] } },
      note: "Rast jins を上下に積んだ形。第3音 350c は近似で、実演は 340〜360c の幅を持つ（地域差）。",
      source: ""
    },
    {
      name: "ペロッグ", mode: "octave", cents: [0, 100, 300, 700, 800],
      frame: null, tetra: null, embat: true,
      note: "ガムランのペロッグ近似。楽団ごとに調律(embat)が異なり単一の正解値が存在しない。完全4度核音を欠く枠外ノード。",
      source: ""
    },
    {
      name: "スレンドロ", mode: "octave", cents: [0, 240, 480, 720, 960],
      frame: null, tetra: "slendro-approx", embat: true,
      note: "1オクターブ5等分割(240c)の近似。実際の楽団調律は等分割ではなく、楽団ごとに違う。枠外ノード。",
      source: ""
    },
    {
      name: "ブルース", mode: "octave", cents: [0, 300, 500, 600, 700, 1000],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [300] }, upper: { inner: [300] }, extra: [600] },
      note: "上下ともに民謡テトラコルド(300c)＋核音の外に 600c(ブルーノート)。extra は枠の外側なので最も変異しやすい音。",
      source: ""
    },
    {
      name: "ハーモニックマイナー", mode: "octave", cents: [0, 200, 300, 500, 700, 800, 1100],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [200, 300] }, upper: { inner: [100, 400] } },
      note: "下が Nahawand(200-300)、上が Hijaz(100-400)。上下で別文化の jins が同居する形。",
      source: ""
    },
    {
      name: "ホールトーン", mode: "octave", cents: [0, 200, 400, 600, 800, 1000],
      frame: null, tetra: null,
      note: "1オクターブ6等分割。完全4度・完全5度の核音をどちらも持たない完全な枠外。",
      source: ""
    },
    {
      name: "アイヌ", mode: "octave", cents: [0, 200, 400, 700, 900, 1100],
      frame: null, upperCore: 700, tetra: null,
      note: "この6音並びは近似。アイヌのウポポ／ウコウク等の実際の旋律は固定音階より旋律型で捉えるべきで、単一音階への還元は仮説にすぎない。",
      source: ""
    },
    {
      name: "琉球音階", mode: "octave", cents: [0, 400, 500, 700, 1100],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [400] }, upper: { inner: [400] } },
      note: "上下ともに琉球テトラコルド(400c)。核音 0-500-700-1200 は都節・律・民謡と共通で、可動音だけが 400 に寄る。",
      source: "小泉文夫（1958）"
    },

    /* ── 日本の残り2種（小泉のテトラコルドをそのまま上下に積んだ形）──── */
    {
      name: "民謡音階", mode: "octave", cents: [0, 300, 500, 700, 1000],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [300] }, upper: { inner: [300] } },
      note: "上下とも民謡テトラコルド(300c)。わらべうた・民謡の基本形（小泉）。九州・三陸・山陰の民謡に広く見られる。",
      source: "小泉文夫（1958）"
    },
    {
      name: "律音階", mode: "octave", cents: [0, 200, 500, 700, 900],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [200] }, upper: { inner: [200] } },
      note: "上下とも律テトラコルド(200c)。雅楽の律旋・声明・追分系の民謡。",
      source: "小泉文夫（1958）"
    },

    /* ── 東アジア・東南アジア・インド洋（航路のノードに合わせて追加）──── */
    {
      name: "清楽音階", mode: "octave", cents: [0, 200, 400, 500, 700, 900, 1100],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [200, 400] }, upper: { inner: [200, 400] } },
      note: "中国の七声のうち清楽（清角＋変宮）。宮商角清角徴羽変宮。福建・浙江の沿岸民間音楽（南音の管門を含む）で広く用いられる12平均律近似。実演は三分損益（ピタゴラス系）に近い。",
      source: ""
    },
    {
      name: "ユクチャベギ", mode: "octave", cents: [0, 300, 500, 700, 780],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [300] }, upper: { inner: [80] } },
      note: "朝鮮半島南西部（全羅道）の육자배기토리。核音 mi–la–si に、si から下行する시김새の音（do' より低い、780c 前後）が加わる。小泉の枠組みで見ると下＝民謡・上＝都節より狭い可動音。近似。",
      source: ""
    },
    {
      name: "ラガ・カマージ", mode: "octave", cents: [0, 200, 400, 500, 700, 900, 1000],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [200, 400] }, upper: { inner: [200, 300] } },
      note: "Khamaj thaat（komal ni）。ベンガルの舟歌 bhatiyali、Rabindra sangeet に多い。cents はミクソリディアと同じだが、ここではインドの名で置く。",
      source: ""
    },
    {
      name: "マカーム・ヒジャーズ", mode: "octave", cents: [0, 100, 400, 500, 700, 800, 1100],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [100, 400] }, upper: { inner: [100, 400] } },
      note: "Hijaz jins を上下に積んだ形。ハドラマウト（イエメン）出身のアラブ商人がマラッカに持ち込んだ zapin・ghazal Melayu の旋法（仮説）。cents はラガ・バイラヴと同じ＝海路で繋がる同型。",
      source: ""
    },
    {
      name: "ホイ・オアン", mode: "octave", cents: [0, 350, 500, 700, 1050],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [350] }, upper: { inner: [350] } },
      note: "ベトナム南部（メコンデルタの đờn ca tài tử）の hơi Oán。第3音・第7音が中立音程（≈350c）に上ずる。上下同型のテトラコルド。近似。",
      source: ""
    },
    {
      name: "パシブツブツ", mode: "octave",
      cents: [0, 1200 * Math.log2(9 / 8), 1200 * Math.log2(5 / 4), 1200 * Math.log2(3 / 2), 1200 * Math.log2(7 / 4)],
      frame: null, upperCore: C_JUST_5TH, tetra: null,
      note: "台湾ブヌン族の八部合音 pasibutbut。倍音列（第8〜14倍音）を目標に声部が少しずつ上昇する。ここでは到達点の倍音 8:9:10:12:14 をオクターブに畳んだ近似。完全4度を持たないので枠外。",
      source: "黒澤隆朝（1943）録音／許常惠"
    },
    {
      name: "クリンタン", mode: "octave", cents: [0, 220, 460, 720, 940],
      frame: null, tetra: null, embat: true,
      note: "フィリピン南部（マギンダナオ／マラナオ）のゴング列 kulintang。非等分の五音で、調律は楽団ごとに違う（ガムランの embat と同じ性格）。数値は近似。",
      source: ""
    },
    {
      name: "オリ", mode: "octave", cents: [0, 200, 300, 500],
      frame: null, tetra: null,
      note: "ハワイ／タヒチの接触以前の詠唱（oli / himene の古層）。基準音とその上下の隣接音、下方の4度への落ちだけで歌われる狭い音域。七音の音階が東端で「詠唱」に還元される到達点として置く。近似。",
      source: ""
    },

    /* ── 大西洋（湾流の航路のために追加）──────────────────────── */
    {
      name: "ドリアン", mode: "octave", cents: [0, 200, 300, 500, 700, 900, 1000],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [200, 300] }, upper: { inner: [200, 300] } },
      note: "上下ともに 0-200-300-500（＝アラブの Nahawand と同型）。アイルランド／アパラチアの旋法的民謡に多い。ケルト系の実演は6音・5音の核に還元されることが多く、7音への還元は仮説。",
      source: ""
    },
    {
      name: "ミクソリディア", mode: "octave", cents: [0, 200, 400, 500, 700, 900, 1000],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [200, 400] }, upper: { inner: [200, 300] } },
      note: "下 0-200-400-500・上 0-200-300-500。ケルト系のパイプ音楽、ニューファンドランドの舞曲、メキシコ湾岸のソン（son jarocho）の一部に見られる旋法（仮説）。",
      source: ""
    },
    {
      name: "ハルダンゲル", mode: "octave", cents: [0, 200, 350, 500, 700, 850, 1050],
      frame: 500, upperCore: 700, join: "disjunct",
      tetra: { lower: { inner: [200, 350] }, upper: { inner: [150, 350] } },
      note: "ノルウェーのハルダンゲル・フィドル音楽に見られる中立3度（≈350c）・中立6度・中立7度の近似。下テトラコルドは Rast jins と同型になる（偶然の一致か海路の名残かは未検証＝仮説）。",
      source: ""
    },

    /* ── 物理律（枠外・自然数や比から生える音列）────────────────
       degree の当て方は従来実装と同一にしてある（音高が変わらない）。   */
    {
      name: "倍音列", mode: "gen", gen: { kind: "harmonic" },
      frame: null, tetra: null,
      note: "第 n 倍音＝基音の n 倍。degree i → 比 (i+1)。オクターブに折り返さず上に伸びる。",
      source: ""
    },
    {
      name: "純正律", mode: "octave",
      cents: [0, 1200 * Math.log2(9 / 8), 1200 * Math.log2(5 / 4), 1200 * Math.log2(4 / 3),
              1200 * Math.log2(3 / 2), 1200 * Math.log2(5 / 3), 1200 * Math.log2(15 / 8)],
      frame: C_JUST_4TH, upperCore: C_JUST_5TH, join: "disjunct",
      tetra: { lower: { inner: [1200 * Math.log2(9 / 8), 1200 * Math.log2(5 / 4)] },
               upper: { inner: [1200 * Math.log2(5 / 3) - C_JUST_5TH, 1200 * Math.log2(15 / 8) - C_JUST_5TH] } },
      note: "9/8, 5/4, 4/3, 3/2, 5/3, 15/8。frame は純正完全4度 498.045c で、12平均律の 500 から 1.955c ずれる。",
      source: ""
    },
    {
      name: "黄金比律", mode: "gen", gen: { kind: "ratio-power", ratio: PHI, exponentStep: 0.45 },
      frame: null, tetra: null,
      note: "degree i → φ^(0.45 i)。1音あたり約 374.89c。オクターブと整合しない＝どの核音も持たない。",
      source: ""
    },
    {
      name: "ピタゴラス律", mode: "octave",
      cents: (function () {
        var f = 1, raw = [];
        for (var i = 0; i < 12; i++) { raw.push(f); f *= 1.5; while (f >= 2) f /= 2; }
        raw.sort(function (a, b) { return a - b; });
        return raw.map(function (r) { return 1200 * Math.log2(r); });
      })(),
      frame: null, upperCore: C_JUST_5TH, join: null, tetra: null,
      note: "完全5度(3/2)を12回積んでオクターブに折り返し昇順に並べたもの。上方向のみ積むため完全4度(498.045c)が現れず、521.5c が代わりに立つ＝テトラコルド分解不能。",
      source: ""
    },
    {
      name: "フィボナッチ", mode: "abs",
      cents: (function () {
        var fib = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377], base = fib[2];
        var out = [];
        for (var i = 0; i < 11; i++) out.push(1200 * Math.log2(fib[i + 2] / base));
        return out;
      })(),
      frame: null, tetra: null,
      note: "F(n+2)/F(2)＝3を1とする比。隣接比は黄金比に収束するので上へ行くほど約 833c 等間隔に漸近。degree 11 以降は末尾で飽和（従来実装と同じ）。",
      source: ""
    }
  ];

  /* ── ノード（航路上の寄港地）──────────────────────────────────
     scale は「その土地に残った音階」の**仮説**。出典つきの書き換えを前提とする。 */
  var NODES = [
    // 黒潮
    { id: "luzon",      name: "ルソン",         lat: 16.0,  lon: 120.6, scale: "ハーモニックマイナー",       note: "黒潮の源流域。スペイン植民期にマニラ・ガレオン経由で入った短調歌曲 kundiman（短調→長調へ転じる）を置く。海路による西洋音階の到来そのもの（仮説）。", source: "" },
    { id: "taiwan",     name: "台湾",           lat: 23.7,  lon: 120.9, scale: "パシブツブツ",       note: "オーストロネシア語族の出発点。ブヌン族の八部合音 pasibutbut＝倍音列を目標に上昇する合唱。黒澤隆朝の1943年録音で知られる。沿岸のアミ族は五音だが、ここでは台湾固有の倍音志向を採る。", source: "" },
    { id: "ryukyu",     name: "琉球",           lat: 26.2,  lon: 127.7, scale: "琉球音階",             note: "黒潮とモンスーン航路が交わる結節点。可動音 400c。", source: "小泉文夫（1958）" },
    { id: "kyushu-s",   name: "九州南",         lat: 31.4,  lon: 130.6, scale: "民謡音階",                 note: "琉球から本土へ最初に接岸する地点。民謡テトラコルド（可動音 300c）。", source: "" },
    { id: "kii",        name: "紀伊",           lat: 33.7,  lon: 135.9, scale: "都節",                 note: "黒潮が最も陸に近づく。都節＝可動音 100c。", source: "" },
    { id: "boso",       name: "房総",           lat: 34.9,  lon: 139.9, scale: "都節",                 note: "黒潮の離岸点。ここから先は外洋へ出る（環流へ接続）。", source: "" },
    // 対馬海流
    { id: "eastchina",  name: "東シナ海",       lat: 29.0,  lon: 125.0, scale: "清楽音階",     note: "黒潮から対馬海流が分岐する海域。福建・浙江沿岸の七声（清楽）を大陸からの流入口として置く（仮説）。", source: "" },
    { id: "korea-s",    name: "朝鮮半島南岸",   lat: 34.8,  lon: 128.4, scale: "ユクチャベギ",                   note: "全羅道の육자배기토리。核音 mi–la–si と下行する시김새。小泉のテトラコルドと同型の枠を持つ。", source: "" },
    { id: "sanin",      name: "山陰",           lat: 35.5,  lon: 133.1, scale: "民謡音階",                   note: "対馬海流が日本海沿いに北上する経路。安来節・貝殻節など民謡テトラコルド。", source: "" },
    { id: "hokuriku",   name: "北陸",           lat: 36.9,  lon: 137.0, scale: "都節",                 note: "北前船の寄港地。江戸期に都節が広く流入した（仮説）。", source: "" },
    // 親潮
    { id: "kuril",      name: "千島",           lat: 46.8,  lon: 151.8, scale: "アイヌ",         note: "親潮の源流。千島アイヌの歌（ウポポ／ヤイサマ）は北海道と同系。単一音階への還元は仮説。", source: "" },
    { id: "hokkaido",   name: "北海道（アイヌ）", lat: 43.1, lon: 141.4, scale: "アイヌ",              note: "アイヌの歌唱は旋律型で捉えるべきで、音階への還元は仮説。", source: "" },
    { id: "sanriku",    name: "三陸",           lat: 39.3,  lon: 141.9, scale: "民謡音階",                 note: "黒潮と親潮が出会う潮目の陸側。南部の民謡（民謡テトラコルド）。二系統の音階が同時に鳴る地点。", source: "" },
    // モンスーン航路
    { id: "arabia",     name: "アラビア海",     lat: 15.0,  lon: 60.0,  scale: "マカーム・ラスト",     note: "夏の南西モンスーンで東へ、冬の北東モンスーンで西へ。maqam の出発点。", source: "" },
    { id: "india-w",    name: "インド西岸",     lat: 15.3,  lon: 73.9,  scale: "ラガ・バイラヴ",       note: "下半が Hijaz と同型＝アラビア海からの構造の受け取り（仮説）。", source: "" },
    { id: "bengal",     name: "ベンガル湾",     lat: 15.0,  lon: 88.0,  scale: "ラガ・カマージ",         note: "ベンガルの舟歌 bhatiyali（Khamaj）。河と海の歌が海路に乗る地点として置く（仮説）。", source: "" },
    { id: "malacca",    name: "マラッカ",       lat: 2.2,   lon: 102.2, scale: "マカーム・ヒジャーズ",           note: "海峡＝流れが狭まり混交が最大化する地点。ハドラマウト系アラブ商人が持ち込んだ zapin の旋法（仮説）。", source: "" },
    { id: "java",       name: "ジャワ",         lat: -7.0,  lon: 110.4, scale: "ペロッグ",             note: "楽団ごとに調律(embat)が違う。単一値は持てない枠外ノード。", source: "" },
    { id: "southchina", name: "南シナ海",       lat: 15.0,  lon: 114.0, scale: "ホイ・オアン",       note: "ベトナム南部（メコンデルタ）の hơi Oán＝中立3度の五音。北上して琉球へ戻る経路。", source: "" },
    // オーストロネシア拡散
    { id: "philippines",name: "フィリピン",     lat: 12.9,  lon: 121.8, scale: "クリンタン",       note: "拡散の第一波。南部のゴング列 kulintang の非等分五音。", source: "" },
    { id: "indonesia",  name: "インドネシア",   lat: -2.5,  lon: 118.0, scale: "スレンドロ",           note: "拡散の分岐点。西へマダガスカル、東へポリネシア。", source: "" },
    { id: "madagascar", name: "マダガスカル",   lat: -18.9, lon: 47.5,  scale: "ミクソリディア",       note: "インド洋を越えた最西端。ヴァリハ（竹の筒琴）と salegy の旋法。オーストロネシア＋アフリカ＋アラブの層（仮説）。", source: "" },
    { id: "polynesia",  name: "ポリネシア",     lat: -17.7, lon: -149.4, scale: "オリ",        note: "最東端。七音の音階が狭い詠唱（oli）へ還元される到達点として置く（仮説）。", source: "" },
    // 環流・停滞
    { id: "npg-e",      name: "北太平洋環流東",  lat: 38.0,  lon: -160.0, scale: "黄金比律",           note: "外洋。陸の文化から切れた場所として、オクターブと整合しない律を置く（仮説）。", source: "" },
    { id: "npg-n",      name: "北太平洋環流北",  lat: 45.0,  lon: 175.0, scale: "倍音列",              note: "外洋。倍音列＝物理だけが残る場所（仮説）。", source: "" },
    { id: "stagnant",   name: "停滞域",         lat: 34.0,  lon: 138.0, scale: "ホールトーン",         note: "赤潮＝停滞と同化。ここでは cents が12平均律グリッドへ吸着していく。", source: "" },
    // 湾流（メキシコ湾流 → 北大西洋海流）
    { id: "gulf-mexico",  name: "メキシコ湾",       lat: 24.0, lon: -87.0, scale: "ミクソリディア", note: "湾流の源。ユカタン海峡から流れ込む。メキシコ湾岸のソン系旋法を仮に置く（仮説）。", source: "" },
    { id: "florida",      name: "フロリダ海峡",     lat: 25.0, lon: -80.0, scale: "ブルース",       note: "流れが最も狭く速い。米南部のブルース（枠外の 600c を含む）。", source: "" },
    { id: "hatteras",     name: "ハッテラス岬",     lat: 35.2, lon: -75.5, scale: "ドリアン",       note: "湾流が大陸棚を離れて外洋へ出る地点。アパラチアの旋法的バラッド（仮説）。", source: "" },
    { id: "newfoundland", name: "ニューファンドランド", lat: 47.5, lon: -52.7, scale: "ミクソリディア", note: "ラブラドル海流（寒流）と出会う潮目でもある。アイルランド系入植地の舞曲。", source: "" },
    { id: "ireland-w",    name: "アイルランド西岸", lat: 53.0, lon: -10.0, scale: "ドリアン",       note: "北大西洋海流として到着。sean-nós／トラッドの旋法（仮説）。", source: "" },
    { id: "norway-sea",   name: "ノルウェー海",     lat: 60.4, lon:  5.0,  scale: "ハルダンゲル",   note: "海流の終端。中立3度を持つフィドル音楽。", source: "" }
  ];

  /* ── 航路 ──────────────────────────────────────────────────────
     speed は km/日（伝播の速さ。海流の実速度ではなく「文化が動く速さ」の目安）。
     panFn は潮流パンの軌跡 id（処理側が実装）。                            */
  var ROUTES = [
    {
      id: "fixed", name: "固定", path: [], speed: 0, seasonal: false, panFn: "none", hidden: true,
      note: "後方互換のためだけに残す（UI には出さない）。旧 preset / 場API が route=fixed を送ってきたら「最初の航路に停泊」として扱う。音階は航路のノードからしか来ない。", source: ""
    },
    {
      id: "kuroshio", name: "黒潮",
      path: ["luzon", "taiwan", "ryukyu", "kyushu-s", "kii", "boso"],
      speed: 220, seasonal: false, panFn: "kuroshio",
      note: "実流速は最大 2〜4 ノット。ここでの speed は「音階が次のノードへ届く速さ」の目安で、実流速ではない。",
      source: ""
    },
    {
      id: "tsushima", name: "対馬海流",
      path: ["eastchina", "korea-s", "sanin", "hokuriku"],
      speed: 150, seasonal: false, panFn: "tsushima",
      note: "黒潮の分岐。日本海側を北上する。北前船の経路と重なる（仮説）。", source: ""
    },
    {
      id: "oyashio", name: "親潮",
      path: ["kuril", "hokkaido", "sanriku"],
      speed: 120, seasonal: false, panFn: "oyashio",
      note: "南下する寒流。黒潮と逆向きに音階を運ぶ。", source: ""
    },
    {
      id: "monsoon", name: "モンスーン航路",
      path: ["arabia", "india-w", "bengal", "malacca", "java", "southchina", "ryukyu"],
      speed: 260, seasonal: true, panFn: "monsoon",
      note: "季節風で伝播方向が反転する。夏の南西モンスーンで東へ、冬の北東モンスーンで西へ。seasonal=true。",
      source: ""
    },
    {
      id: "austronesian", name: "オーストロネシア拡散",
      path: ["taiwan", "philippines", "indonesia", "madagascar"],
      branches: [{ from: "indonesia", path: ["polynesia"] }],
      speed: 90, seasonal: false, panFn: "spread",
      note: "インドネシアで分岐し、西のマダガスカルと東のポリネシアへ同時に伸びる。数千年規模の拡散を圧縮して扱う。",
      source: ""
    },
    {
      id: "gyre", name: "環流",
      path: ["boso", "npg-n", "npg-e", "luzon"],
      speed: 300, seasonal: false, panFn: "gyre", loop: true,
      note: "北太平洋環流。終点から始点へ戻るので、変異した音階が出発地へ帰還する。loop=true。",
      source: ""
    },
    {
      id: "shiome", name: "潮目",
      path: ["sanriku"], confluence: ["kuroshio", "oyashio"],
      speed: 100, seasonal: false, panFn: "shiome",
      note: "黒潮と親潮が三陸沖で出会う。二系統の音階を同時に鳴らし、±30c 以内の近接音のうなりを残す。",
      source: ""
    },
    {
      id: "gulfstream", name: "湾流",
      path: ["gulf-mexico", "florida", "hatteras", "newfoundland", "ireland-w", "norway-sea"],
      speed: 250, seasonal: false, panFn: "gulf",
      note: "メキシコ湾流から北大西洋海流へ。フロリダ海峡で狭く速く、ハッテラス岬で離岸し、ニューファンドランド沖で寒流と出会い、アイルランドを経てノルウェー海で終わる。実流速は最大 2.5 m/s だが speed は「音階が動く速さ」の目安。ブルースの枠外音 600c がドリアン／ミクソリディアの骨格の上を運ばれていく（仮説）。",
      source: ""
    },
    {
      id: "akashio", name: "赤潮", path: ["stagnant"],
      speed: 0, seasonal: false, panFn: "akashio", homogenizing: true,
      note: "停滞と同化。伝播せず、代わりに全層の cents が12平均律グリッドへ吸着していく（均質化圧）。吸着率は homogenize パラメータ。",
      source: ""
    }
  ];

  /* ── 潮汐：分潮定数 ────────────────────────────────────────────
     periodHours は天文学的に決まる値（固定）。amp/phase は東京湾程度の
     近似で、気象庁の調和定数に差し替え可能。                              */
  var TIDE = {
    constituents: [
      { name: "M2", periodHours: 12.4206, amp: 0.50, phase: 0.00,  note: "主太陰半日周潮。最大の分潮。" },
      { name: "S2", periodHours: 12.0000, amp: 0.24, phase: 0.55,  note: "主太陽半日周潮。M2 とのうなり周期(約14.77日)が大潮・小潮を作る。" },
      { name: "N2", periodHours: 12.6583, amp: 0.10, phase: 1.20,  note: "主太陰楕率半日周潮。月軌道の離心率由来。" },
      { name: "K1", periodHours: 23.9345, amp: 0.25, phase: 2.10,  note: "日月合成日周潮。日潮不等を作る。" },
      { name: "O1", periodHours: 25.8193, amp: 0.19, phase: 2.85,  note: "主太陰日周潮。" },
      { name: "M4", periodHours: 6.2103,  amp: 0.02, phase: 1.70,  note: "M2 の倍潮。浅海の非線形から生じるので、海岸層のみの非線形に対応させる。" }
    ],
    beatDays: 14.765,
    moon: { newMoonEpochUTC: "2000-01-06T18:14:00Z", synodicMonthDays: 29.530588 },
    note: "潮位 h(t) = Σ A_i cos(2π t / T_i + φ_i)。amp/phase は東京湾程度の近似値で、気象庁の調和定数（各地の潮位表）に差し替え可。periodHours は天文定数なので固定。",
    source: "周期は天文定数。振幅・位相は近似（要差し替え）。"
  };

  /* ── 時間圧縮 ────────────────────────────────────────────────────
     実世界の時間を演奏の時間に畳む比率。すべて timeScale 100 のときの値で、
     timeScale はこれらを一律に伸縮させる。                                  */
  var TIME = {
    secondsPerDayAt100: 6.0,
    note_secondsPerDay: "航海：実世界の1日をこの秒数に畳む。黒潮(14.5日)は 87 秒になる。",
    tideM2SecAt100: 180,
    note_tideM2: "潮汐：M2(12.4206時間)の1周期をこの秒数に畳む。大潮小潮のうなり(14.765日)は約86分になる。",
    seasonYearSecAt100: 300,
    note_season: "季節：1年をこの秒数に畳む。モンスーン航路の伝播方向の反転は半年ごと＝150秒ごとに起きる。",
    source: "いずれも聴取のための任意の圧縮率。実測値ではない。"
  };

  root.OCEAN_DATA = {
    version: 5,
    time: TIME,
    constants: { justFourthCents: C_JUST_4TH, justFifthCents: C_JUST_5TH, phi: PHI },
    tetrachords: TETRACHORDS,
    scales: SCALES,
    nodes: NODES,
    routes: ROUTES,
    tide: TIDE,
    note: "航路・ノードの追加はこのファイルの書き換えだけで完結する（ocean.html は触らない）。"
  };
})(typeof window !== "undefined" ? window : this);
