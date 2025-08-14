/**
 * @file config.js
 * @brief スロットゲームの設定を管理するファイル。
 *        ゲームの挙動、リールの構成、アニメーションの速度などを定義します。
 */

// ゲーム全体の設定を管理するオブジェクト
const gameConfig = {
	// --- DOM要素のセレクタ ---
	// HTML側のIDやクラスを変更した場合は、ここを修正するだけで対応できます。
	selectors: {
		slotMachine: '#slot-machine', // スロットマシンのコンテナ
		actionBtn: '#actionBtn',       // スタート/ストップボタン
		modeBtn: '#modeBtn',         // モード切り替えボタン
	},

	// --- ゲームの基本設定 ---
	reelCount: 3,          // リールの数
	symbolHeight: 80,      // 1シンボルの高さ (ピクセル単位)。CSSと一致させる必要があります。
	symbolDuplicationFactor: 2, // 無限スクロールのためにシンボルを何周分複製するか

	// --- リールのシンボル構成 ---
	// 各リールに表示されるシンボルの配列を定義します。
	reelsData: [
		['🍌', '🍋', '🍎', '🍌', '🍋', '💎', '🍉', '🍌', '🍋', 'BAR', '🍒', '🍎', '🍌', '🍋', '🍉', '🍌', '🍋', '7️⃣', '🍇', '7️⃣', '🍇'], // 左リール
		['🍌', '🍒', '🍋', '🍌', '🍎', '💎', '🍉', '🍋', '🍌', '🍒', 'BAR', '🍒', '🍋', '🍌', '🍉', '🍋', '🍌', '🍇', '7️⃣', '🍇', '🍋'], // 中央リール
		['🍋', '🍎', '🍌', '🍋', '🍉', '💎', '🍌', '🍋', '🍒', 'BAR', '🍌', '🍋', '🍉', '🍎', '🍌', '🍋', '🍇', '7️⃣', '🍇', '7️⃣', '🍌']  // 右リール
	],

	// --- シンボル出現確率 ---
	// 各シンボルが抽選される確率を重みで定義します。
	// この設定は、狙い撃ち機能がOFFの場合や、通常のスピンでどのシンボルを狙うかを決定する際に使用されます。
	// 重みが大きいほど、そのシンボルが選ばれやすくなります。
	symbolProbabilities: [
		{ symbol: '7️⃣', weight: 1 },   // 7
		{ symbol: 'BAR', weight: 10 },  // BAR
		{ symbol: '💎', weight: 15 },   // ダイヤモンド
		{ symbol: '🍉', weight: 20 },   // スイカ
		{ symbol: '🍎', weight: 25 },   // リンゴ
		{ symbol: '🍋', weight: 500 },   // レモン
		{ symbol: '🍒', weight: 35 },   // チェリー
		{ symbol: '🍌', weight: 40 },   // バナナ
		{ symbol: '🍇', weight: 5 }    // ぶどう
	],


	// --- ゲーム開始時の状態 ---
	initialReelPositions: [17, 17, 17], // 各リールの初期シンボルインデックス
	initialIsAutoMode: true,             // 初期ゲームモード (true: 自動, false: 目押し)

	// --- アニメーションと速度設定 ---
	autoSpeed: 40,         // 自動モード時のリール回転速度 (ピクセル/フレーム)
	manualSpeed: 20,       // 目押しモード時のリール回転速度 (ピクセル/フレーム)
	accelerationTime: 250, // スピン開始から最高速に達するまでの加速時間 (ms)
	minStopAnimTime: 750,  // 停止アニメーションの最短時間 (ms) 短すぎ停止を防止
	maxStopAnimTime: 1000, // 停止アニメーションの最長時間 (ms)
	reverseRotation: true, // リールの回転方向 (true: 下から上へ, false: 上から下へ)
	stopEasing: 'cubic',   // 停止時のイージング: 'cubic'|'quad'|'sine'|'linear'（sineは停止開始時の加速度0）
	stopBaseDurationMs: 240, // 自動停止時の減速ベース時間（短距離でも最低限の演出を確保）

	// --- 自動モード設定 ---
	// 【注意】設定値が競合すると、意図しない挙動を引き起こす可能性があります。
	// 最短時間と最長時間の間隔は、リール間の最小ギャップの合計以上である必要があります。
	// 計算式: (reelCount - 1) * minSequentialStopGapMs <= autoStopMaxTime - autoStopMinTime
	//
	// 現在の無効な設定例 (3リールの場合):
	// (3 - 1) * 300ms = 600ms
	// 1500ms - 1000ms = 500ms
	// 600ms > 500ms のため、この設定では右リールの停止時間が autoStopMaxTime を超える可能性があります。
	//
	// 新方式: 最小/最大待ち時間と最小ギャップのみ指定（左→中→右の順で自動分配＋ゆらぎ）
	autoStopMinTime: 1000,               // 左リールの最短停止時刻 (ms)
	autoStopMaxTime: 1500,               // 全リールの最長停止時刻 (ms)
	minSequentialStopGapMs: 100,         // 各リール間の最小停止ギャップ (ms)（左→中→右の順で適用）
	// 旧方式（配列指定）は不要。必要なら下記を復活
	// autoStopTimings: [1800, 2400, 3000], // 各リールの自動停止タイミング (ms)
	// autoStopTimeRandomness: 300,         // 自動停止タイミングのランダムな揺らぎ幅 (ms)

	// --- 狙い撃ち停止設定 (自動モード時のみ有効) ---
	// reelIndex: 対象リールのインデックス (0から)
	// symbolIndex: reelsData 内の対象絵柄のインデックス（または symbol: '🍒' のように絵柄文字でも指定可）
	// position: 停止位置 ('top', 'middle', 'bottom') ※省略可。省略時はランダムで選択されます。
	// 例: 左リール(0)の下段('bottom')に、インデックス19の絵柄(7️⃣)を止める
	stopTargets: [
		// { reelIndex: 1, symbol: '7️⃣' },
		// // 例: 左・中・右すべてを同時ターゲット
		// { reelIndex: 0, symbol: '7️⃣' },
		// { reelIndex: 2, symbol: '7️⃣' },
	],

	// 同時ターゲット制御の発動確率（0〜1）。開発中は1に設定。
	// 1: 常に stopTargets を適用、0: 一切適用しない。将来的には変数などで変更可能。
	targetActivationProbability: 1,

	// --- 勝ち（当たり）制御 ---
	// 水平/斜めの発動確率（0〜1）。合計が1を超える場合は内部で正規化されます。
	winHorizontalProbability: 0.15,
	winDiagonalProbability: 0.1,
	// 旧: winActivationProbability は後方互換として水平に流用
	// winActivationProbability: 0.5,
	// 絵柄ごとの重み（高いほど選ばれやすい）
	// 例: 7️⃣を最優先で揃える: { '7️⃣': 1, 'BAR': 0.5, '🍒': 0.2 }
	winSymbolWeights: {
		'7️⃣': 1,
		'BAR': 10,
		'💎': 15,
		'🍉': 20,
		'🍎': 25,
		'🍒': 35,
		'🍌': 40,
		'🍋': 500,
		'🍇': 5
	},
	// 揃える段。'top'|'middle'|'bottom'|'random'（未設定/不正時はrandom）
	winRowMode: 'random',
	// 斜めの方向。'down'(↘) | 'up'(↗) | 'random'
	winDiagonalMode: 'random',

	// --- デバッグ設定 ---
	debug: {
		stopLogs: true,  // 停止時の概要ログ
		frameLogs: false, // フレーム毎ログ（重いので通常はfalse）
	},
};