/**
 * @file script.js
 * @brief スロットゲームの主要なロジックを管理するJavaScriptファイル。
 *        リールの生成、回転アニメーション、停止制御、ゲームモードの切り替えなどを担当します。
 */

/**
 * 設計概要 / アーキテクチャ
 * - 役割分担:
 *   - UIManager: DOM参照とUI更新（テキスト変更、transform適用）に限定。副作用の集中管理を行います。
 *   - SlotGame: ゲーム状態・アニメーション・制御ロジックを保持。DOM操作は UIManager 経由に限定します。
 * - 主要設定（抜粋）:
 *   - selectors: { slotMachine, actionBtn, modeBtn }
 *   - reelsData: string[][]（各リールのシンボル配列）。インデックス順は停止計算・演出の基準です。
 *   - symbolHeight: number（px）。CSSのシンボル高さと一致必須。
 *   - 自動停止: autoStopMinTime/autoStopMaxTime と minSequentialStopGapMs による等間隔+ジッター生成。
 *   - 当たり演出: 水平/斜めの別確率。揃えるシンボルは winSymbolWeights の加重抽選。
 * - 壊れやすいポイントと対処:
 *   1) CSS高さ不整合: symbolHeight と CSS の高さがズレると停止位置が半端になり、当たり/目押しが崩れます。
 *   2) セレクタ変更: HTML の id/class を変えたら config.selectors を必ず更新。null 参照に注意。
 *   3) reverseRotation: 停止計算の符号・正規化式が変わるため、変更時は実機確認を推奨します。
 *   4) reelsData順序: インデックス指定（symbolIndex）や演出位置に影響。テスト設定も合わせて見直し。
 *   5) 互換性: transform 取得は UIManager#getCurrentTranslateY を正典とし、重複実装を避けてください。
 */

/**
 * UI要素の管理とDOM操作を担当するクラス。
 * SlotGameクラスからUIに関する責務を分離し、コードの見通しと保守性を向上させます。
 */
class UIManager {
	/**
	 * UIManagerクラスのコンストラクタ。
	 * @param {object} config - ゲームの設定オブジェクト
	 * 契約:
	 * - 入力: config.selectors の CSS セレクタに該当する要素が DOM 上に存在すること。
	 * - 副作用: DOM を探索し、主要要素を this.elements にキャッシュします。
	 * 注意: セレクタ変更時は HTML 側と必ず同期し、null 参照による TypeError を防止してください。
	 */
	constructor(config) {
		this.config = config;
		this.elements = {}; // 取得したDOM要素を格納するオブジェクト
		this.getElements();
	}

	/**
	 * 必要なDOM要素を取得し、内部プロパティに格納します。
	 */
	getElements() {
		this.elements.slotContainer = document.querySelector(this.config.selectors.slotMachine);
		this.elements.actionBtn = document.querySelector(this.config.selectors.actionBtn);
		this.elements.modeBtn = document.querySelector(this.config.selectors.modeBtn);
	}

	/**
	 * スロットコンテナ内の全ての子要素をクリアします。
	 */
	clearSlotContainer() {
		this.elements.slotContainer.innerHTML = '';
	}

	/**
	 * 新しいリール要素（div.reel）を作成します。
	 * @returns {HTMLElement} 作成されたリール要素
	 */
	createReelElement() {
		const reelElement = document.createElement('div');
		reelElement.className = 'reel';
		return reelElement;
	}

	/**
	 * シンボルを格納するコンテナ要素（div.symbols）を作成します。
	 * @returns {HTMLElement} 作成されたシンボルコンテナ要素
	 */
	createSymbolsElement() {
		const symbolsElement = document.createElement('div');
		symbolsElement.className = 'symbols';
		return symbolsElement;
	}

	/**
	 * 個々のシンボル要素（div.symbol）を作成します。
	 * @param {string} symbol - 表示するシンボルのテキスト
	 * @returns {HTMLElement} 作成されたシンボル要素
	 */
	createSymbolElement(symbol) {
		const symbolElement = document.createElement('div');
		symbolElement.className = 'symbol';
		symbolElement.textContent = symbol;
		if (symbol === 'BAR') {
			symbolElement.classList.add('bar');
		}
		return symbolElement;
	}

	/**
	 * リール要素をスロットコンテナに追加します。
	 * @param {HTMLElement} reelElement - 追加するリール要素
	 */
	appendReelToSlotContainer(reelElement) {
		this.elements.slotContainer.appendChild(reelElement);
	}

	/**
	 * 指定されたリール要素のY軸方向のtransformスタイルを設定します。
	 * @param {HTMLElement} element - スタイルを設定するリール要素
	 * @param {number} yPosition - 設定するY軸の位置（ピクセル単位）
	 */
	setReelTransform(element, yPosition) {
		element.style.transform = `translateY(${yPosition}px)`;
	}

	/* 代替案について
	 * CSS クラス切替 + transition でも停止演出は可能ですが、1px 単位の滑らかな無限スクロールには
	 * 毎フレームの transform 更新が適しています（GPU アクセラレーションの恩恵あり）。
	 */

	/**
	 * アクションボタンのテキストを設定します。
	 * @param {string} text - 設定するテキスト
	 */
	setActionBtnText(text) {
		this.elements.actionBtn.textContent = text;
	}

	/**
	 * アクションボタンのdisabledプロパティを設定します。
	 * @param {boolean} disabled - trueの場合ボタンを無効化、falseの場合有効化
	 */
	setActionBtnDisabled(disabled) {
		this.elements.actionBtn.disabled = disabled;
	}

	/**
	 * モードボタンのテキストを設定します。
	 * @param {string} text - 設定するテキスト
	 */
	setModeBtnText(text) {
		this.elements.modeBtn.textContent = text;
	}

	/**
	 * 指定されたHTML要素の現在のY軸方向の`transform`変位量を取得します。
	 * `getComputedStyle`と`DOMMatrix`を使用して、正確なピクセル値を取得します。
	 * @param {HTMLElement} element - Y軸変位量を取得する対象のHTML要素
	 * @returns {number} Y軸の変位量 (ピクセル単位)。transformが設定されていない場合は0を返します。
	 */
	getCurrentTranslateY(element) {
		const style = window.getComputedStyle(element);
		const matrix = new DOMMatrix(style.transform);
		return matrix.m42;
	}
}


/**
 * スロットゲーム全体を管理するクラス。
 * ゲームの状態、DOM要素、アニメーションロジックをカプセル化します。
 */
class SlotGame {
	/**
	 * SlotGameクラスのコンストラクタ。
	 * ゲームの初期設定とDOM要素の紐付けを行います。
	 * @param {HTMLElement} element - スロットマシンのコンテナとなるHTML要素（例: <div id="slot-machine">）
	 * @param {object} config - ゲームの動作を定義する設定オブジェクト
	 * 契約:
	 * - 入力: element は現状未使用（将来の複数インスタンス・スコープ分離で利用予定）。
	 * - 出力: reels 配列やフラグ類を初期化し、DOM構築とイベント登録を完了します。
	 * 注意: selectors への依存が強いため、element ベースのクエリへ段階的に移行するとテスタビリティが向上します。
	 */
	constructor(element, config) {
		this.config = config;
		this.ui = new UIManager(config); // UIManagerのインスタンスを生成

		// --- DOM要素の参照を保持 ---
		this.slotContainer = this.ui.elements.slotContainer; // スロットリールを格納するコンテナ
		this.actionBtn = this.ui.elements.actionBtn; // スタート/ストップボタン
		this.modeBtn = this.ui.elements.modeBtn;     // モード切り替えボタン

		// --- ゲームの状態管理変数 ---
		this.reels = [];             // 各リールのDOM要素、シンボルデータ、アニメーション状態を格納する配列
		this.isSpinning = false;     // ゲーム全体が現在回転中であるかを示すフラグ (true: 回転中, false: 停止中)
		this.isAutoMode = config.initialIsAutoMode;      // 現在のゲームモード (true: 自動停止モード, false: 目押しモード)
		this.manualStopCount = 0;    // 目押しモード時に、プレイヤーが停止させたリールの数をカウント

		// ゲームの初期化処理を開始
		this.init();
	}

	/**
	 * ゲームの初期化処理。
	 * リールの構築、初期位置の設定、イベントリスナーの登録を行います。
	 */
	init() {
		this.buildReels();          // リール要素をHTMLに生成
		this.setInitialPositions(); // 各リールを初期表示位置に設定
		this.bindEvents();          // ボタンクリックなどのイベントを登録
	}

	/**
	 * HTML内にリール要素とシンボルを動的に生成し、配置します。
	 * 無限スクロールを実現するため、シンボルリストは2周分生成されます。
	 */
	buildReels() {
		this.ui.clearSlotContainer(); // 既存のリールがあればクリア

		for (let i = 0; i < this.config.reelCount; i++) {
			// 各リールを構成するHTML要素を作成
			const reelElement = this.ui.createReelElement();
			const symbolsElement = this.ui.createSymbolsElement();

			// 設定データから現在のリールに表示するシンボル配列を取得
			const reelSymbols = this.config.reelsData[i];
			const fragment = document.createDocumentFragment(); // DOM操作のパフォーマンス向上のためDocumentFragmentを使用
			// 注意: symbolDuplicationFactor を増やすと初期 DOM ノード数とメモリ使用量が増加します。体感と性能のバランスで調整。

			// シンボルを2周分生成し、リールに追加
			for (let j = 0; j < reelSymbols.length * this.config.symbolDuplicationFactor; j++) {
				const symbol = reelSymbols[j % reelSymbols.length]; // シンボル配列をループ
				const symbolElement = this.ui.createSymbolElement(symbol);
				fragment.appendChild(symbolElement);
			}

			symbolsElement.appendChild(fragment);
			reelElement.appendChild(symbolsElement);
			this.ui.appendReelToSlotContainer(reelElement);

			// 生成したリール要素と関連データを内部管理用の配列に格納
			this.reels.push({
				element: symbolsElement, // シンボルコンテナのDOM要素
				symbols: reelSymbols,    // このリールに表示されるシンボルデータ
				spinning: false,         // このリールが回転中かどうかのフラグ
				animationFrameId: null,  // requestAnimationFrameのID (アニメーション停止時に使用)
				totalHeight: reelSymbols.length * this.config.symbolHeight // シンボル2周分の全高
			});
		}
	}

	/**
	 * ゲーム開始時に、各リールを設定された初期位置に配置します。
	 * CSSの`transform: translateY()`を使用して位置を調整します。
	 */
	setInitialPositions() {
		this.reels.forEach((reel, index) => {
			const positionIndex = this.config.initialReelPositions[index];

			// 設定された初期位置が不正な場合のバリデーション
			if (positionIndex < 0 || positionIndex >= reel.symbols.length) {
				console.error(`リール${index}の初期位置(${positionIndex})が無効です。0に設定します。`);
				this.ui.setReelTransform(reel.element, 0); // 安全なデフォルト値
				return;
			}
			// 指定されたシンボルがリールの一番上に表示されるようにY座標を計算
			// 例: positionIndexが0なら0px、1なら-80px (シンボル1つ分上に移動)
			const yPosition = -positionIndex * this.config.symbolHeight;
			this.ui.setReelTransform(reel.element, yPosition);
		});
	}

	/*
	 * 未使用のためコメントアウト：
	 * SlotGame#getCurrentTranslateY は UIManager#getCurrentTranslateY と処理が重複しており、
	 * 本クラス内では参照しておりません（startReel/stopReel は UIManager 経由で取得）。
	 * 2箇所に同等処理があると将来的な仕様変更（例：transformの扱い変更、DOMMatrix非対応環境へのフォールバック等）時に
	 * 片方だけ修正されて不整合が生じやすいため、UIManager 側を正とし本実装は退避いたします。
	 * 必要になった際は UIManager に統一したうえで呼び出し箇所を見直してください。
	 */
	// getCurrentTranslateY(element) {
	// 	const style = window.getComputedStyle(element);
	// 	const matrix = new DOMMatrix(style.transform);
	// 	return matrix.m42;
	// }

	/**
	 * ゲームの操作ボタンにイベントリスナーを設定します。
	 */
	bindEvents() {
		// スタート/ストップボタンがクリックされたらhandleActionメソッドを実行
		this.ui.elements.actionBtn.addEventListener('click', () => this.handleAction());
		// モード切り替えボタンがクリックされたらtoggleModeメソッドを実行
		this.ui.elements.modeBtn.addEventListener('click', () => this.toggleMode());

		// キーボード: スペースキーでスタート/停止をトグル
		document.addEventListener('keydown', (e) => {
			if (e.code === 'Space') {
				// 長押しの連続発火を防止し、ページスクロールなどの既定動作を抑止
				if (e.repeat) return;
				e.preventDefault();
				this.handleAction();
			}
		});

		/* アクセシビリティの補足
		 * キーボード操作（Enter キー等）やスクリーンリーダー対応を強化する場合は、
		 * ボタン要素にフォーカス可視化や aria-pressed などの属性付与も検討してください。
		 */
	}

	/**
	 * スタート/ストップボタンがクリックされた際の処理を振り分けます。
	 * ゲームが回転中なら手動停止、停止中ならゲーム開始。
	 */
	handleAction() {
		if (this.isSpinning) {
			this.stopManual(); // 回転中なら目押し停止を試みる
		} else {
			this.startGame();  // 停止中ならゲームを開始する
		}
	}

	/**
	 * ゲームモード（自動停止/目押し）を切り替えます。
	 * リール回転中はモード変更を無効化します。
	 */
	toggleMode() {
		if (this.isSpinning) return; // リールが回転中の場合はモード変更を許可しない
		this.isAutoMode = !this.isAutoMode; // モードフラグを反転
		// ボタンのテキストを現在のモードに合わせて更新
		this.ui.setModeBtnText(`モード: ${this.isAutoMode ? '自動' : '目押し'}`);
	}

	/**
	 * スロットゲームを開始します。
	 * 全てのリールを同時に回転させ、モードに応じた処理を行います。
	 */
	startGame() {
		if (this.isSpinning) return; // 既に回転中であれば、多重起動を防ぐ
		this.isSpinning = true;      // ゲーム全体が回転中であることを示すフラグを立てる
		this.manualStopCount = 0;    // 目押しカウンターをリセット

		// 現在のモードに応じたリール回転速度を設定
		const speed = this.isAutoMode ? this.config.autoSpeed : this.config.manualSpeed;

		// 全てのリールに対して回転開始命令を出す
		this.reels.forEach((reel, i) => {
			this.startReel(i, speed);
		});

		if (this.isAutoMode) {
			// 自動モードの場合: スタートボタンを一時的に無効化し、自動停止タイマーを設定
			this.ui.setActionBtnDisabled(true);

			// 停止順序は常に左→中→右（index昇順）。乱数ゆらぎは維持しつつ、最小ギャップで順序を強制。
			const targets = this.config.stopTargets || [];
			// 同時ターゲット制御の発動確率（スピン単位で一括適用）
			const activationP = (typeof this.config.targetActivationProbability === 'number') ? this.config.targetActivationProbability : 1;
			const useTargetsThisSpin = targets.length > 0 && Math.random() < activationP;

			let scheduled;
			const hasMinMax = typeof this.config.autoStopMinTime === 'number' && typeof this.config.autoStopMaxTime === 'number';
			if (hasMinMax) {
				const minT = this.config.autoStopMinTime;
				const maxT = this.config.autoStopMaxTime;
				const count = this.config.reelCount;
				const step = count > 1 ? (maxT - minT) / (count - 1) : (maxT - minT);
				const derivedRand = (typeof this.config.autoStopTimeRandomness === 'number')
					? this.config.autoStopTimeRandomness
					: Math.max(20, Math.min(300, step * 0.25));
				const minGap = (this.config.minSequentialStopGapMs ?? Math.max(60, Math.min(200, step * 0.2)));

				scheduled = Array.from({ length: count }, (_v, i) => {
					const base = minT + step * i;
					const jitter = (Math.random() * derivedRand * 2) - derivedRand; // [-derivedRand, +derivedRand]
					return { i, time: base + jitter };
				});

				// 単調増加にクランプして順序を担保
				for (let k = 1; k < scheduled.length; k++) {
					if (scheduled[k].time <= scheduled[k - 1].time + minGap) {
						scheduled[k].time = scheduled[k - 1].time + minGap;
					}
				}
			} else {
				/*
				 * レガシー/互換性用フォールバックの簡易スケジュール生成
				 *
				 * 背景:
				 * - 以前は config.autoStopTimings / autoStopTimeRandomness 等の別プロパティで
				 *   停止時刻を管理していました。現在は autoStopMinTime / autoStopMaxTime に
				 *   一本化されていますが、万が一古い設定が混在した場合や、ここを復活させる必要が
				 *   出たときに安全に動くよう“退避版”を用意しています。
				 *
				 * 重要な注意点（将来の編集時に狂いやすい箇所）:
				 * - 単位感覚: `base`/`step` はミリ秒（setTimeout の単位）を想定しています。変更する際は
				 *   フロントエンド全体で同じ単位になっているか確認してください（ms vs s 等の混在注意）。
				 * - minSequentialStopGapMs の意味合い: ここで `step` に minSequentialStopGapMs を使うことで
				 *   リール間の最小ギャップを担保しています。別箇所で minSequentialStopGapMs を変更すると
				 *   停止順序や体感が変わるため、互換性のためこの連動を維持すること。
				 * - setTimeout クロージャ: scheduled をループして setTimeout を登録する際に
				 *   ループ変数を直接参照する形に変更すると予期せぬインデックス混乱を招きます。
				 *   必ず各スコープで値をキャプチャする（または構造体に保持する）実装を行ってください。
				 * - 優先度と整合性: この短絡案は autoStopMinTime/MaxTime の計算結果に比べて
				 *   明確に遅延が固定化されます。勝ち演出 (spinTargets) の優先度や `targets` 設定と
				 *   整合するよう留意してください（下流で上書きされる可能性あり）。
				 *
				 * 実処理（安全な既定スケジュール）
				 * - base: 最初の停止が発火するまでの遅延（ms）。UI/体感に合わせて見直し推奨。
				 * - step: 各リールの停止差分（ms）。minSequentialStopGapMs を尊重して単調増加を担保。
				 */
				const count = this.config.reelCount;
				const base = 1000; // ms: 最初のリール停止までの既定遅延。UI 体感に応じて調整してください。
				// minSequentialStopGapMs を優先してステップ幅を決定。未設定なら安全な下限（100ms）を使用。
				const step = Math.max(100, this.config.minSequentialStopGapMs ?? 100);
				scheduled = Array.from({ length: count }, (_v, i) => ({ i, time: base + step * i }));
			}

			// --------------------------
			// 当たり（勝ち）演出の決定
			// --------------------------
			/*
			 * ロジック:
			 * - horizontal / diagonal のどちらか（またはなし）を確率で決定する。
			 * - horizP と diagP は独立に設定され得るため、合計が 1 を超えないように clamp する。
			 * - roll により発動判定を行い、発動した場合は winType を 'horizontal'|'diagonal' に設定する。
			 *
			 * 将来の編集で注意すべき点:
			 * - 確率の合算順序: horizP と diagP の優先度付けを変えると出現傾向が変わるため、
			 *   ゲームバランス調整時はテストスピンを必ず行ってください。
			 * - winActivationProbability を用いる古い設定との互換性: 互換性コードが混在すると
			 *   発動頻度が意図せず増減する可能性があるため、1つに統一することを推奨します。
			 */
			const horizP = (typeof this.config.winHorizontalProbability === 'number')
				? this.config.winHorizontalProbability
				: ((typeof this.config.winActivationProbability === 'number') ? this.config.winActivationProbability : 0);
			const diagP = (typeof this.config.winDiagonalProbability === 'number') ? this.config.winDiagonalProbability : 0;
			// 合計確率を 0..1 にクランプ（溢れを防止）
			const sumP = Math.min(1, Math.max(0, horizP + diagP));
			let winType = null; // 'horizontal' | 'diagonal' | null

			const roll = Math.random();
			if (roll < sumP) {
				// horizontal を優先的に判定（horizP の範囲に収まれば horizontal、そうでなければ diagonal）
				winType = (roll < Math.min(1, horizP)) ? 'horizontal' : 'diagonal';
			}

			let spinTargets = null;
			if (winType) {
				// 当たり演出を展開するための絵柄を抽選
				// chooseSymbolByProbability() は「全リールに存在する絵柄」を返す仕様になっています。
				// ここで返る絵柄が必ず全リールにある前提で下流処理を書いてよい（存在チェックは二重防御として残す）。
				const chosenSymbol = this.chooseSymbolByProbability();
				const existsOnAll = this.reels.every(r => r.symbols.includes(chosenSymbol));
				if (existsOnAll) {
					if (winType === 'horizontal') {
						const rows = ['top', 'middle', 'bottom'];
						const rowMode = this.config.winRowMode;
						const row = rows.includes(rowMode) ? rowMode : rows[Math.floor(Math.random() * rows.length)];
						spinTargets = this.reels.map((_r, idx) => ({ reelIndex: idx, symbol: chosenSymbol, position: row }));
					} else if (winType === 'diagonal') {
						// 3リール想定の斜め: ↘ (top,middle,bottom) or ↗ (bottom,middle,top)
						let dir;
						const mode = this.config.winDiagonalMode;
						if (mode === 'up' || mode === 'down') {
							dir = mode;
						} else {
							dir = Math.random() < 0.5 ? 'down' : 'up';
						}
						let positions;
						if (this.config.reelCount === 3) {
							positions = (dir === 'down') ? ['top', 'middle', 'bottom'] : ['bottom', 'middle', 'top'];
							spinTargets = this.reels.map((_r, idx) => ({ reelIndex: idx, symbol: chosenSymbol, position: positions[idx] }));
						} else {
							// reelCount != 3 の場合は水平にフォールバック
							const rows = ['top', 'middle', 'bottom'];
							const row = rows[Math.floor(Math.random() * rows.length)];
							spinTargets = this.reels.map((_r, idx) => ({ reelIndex: idx, symbol: chosenSymbol, position: row }));
						}
					}
				}
			}

			// スケジュール実行（優先度: 当たりターゲット > 設定stopTargets > 通常）
			scheduled.forEach(({ i, time }) => {
				const configuredTarget = useTargetsThisSpin ? (targets.find(t => t.reelIndex === i) || null) : null;
				const target = (spinTargets && spinTargets[i]) || configuredTarget || null;
				setTimeout(() => this.stopReel(i, target), time);
			});
		}
		else {
			// 目押しモードの場合: スタートボタンのテキストを「停止」に変更
			this.ui.setActionBtnText('⏸ 停止');
		}
	}

	/**
	 * 指定されたリールを回転させるアニメーションを開始します。
	 * `requestAnimationFrame`と`transform: translateY()`を使用して滑らかな動きを実現します。
	 * @param {number} index - 回転を開始するリールのインデックス番号
	 * @param {number} speed - リールの回転速度 (ピクセル/フレーム)
	 */
	startReel(index, speed) {
		const reel = this.reels[index];
		reel.spinning = true; // このリールが回転中であることを示すフラグを立てる
		reel.element.classList.add('spinning'); // リールが回転中であることを示すクラスを追加

		// 現在のY座標を取得し、回転方向に応じて内部的な位置`pos`を初期化
		// `pos`は、リールの全高を考慮した無限スクロールのための仮想的な位置です。
		const currentY = this.ui.getCurrentTranslateY(reel.element);
		let pos = this.config.reverseRotation ? (currentY + reel.totalHeight) : -currentY;

		const startTime = performance.now(); // アニメーション開始時刻を記録

		// アニメーションループ関数
		const animate = (currentTime) => {
			if (!reel.spinning) return; // 停止命令が出ていればアニメーションを終了

			const elapsed = currentTime - startTime; // アニメーション開始からの経過時間
			let currentSpeed; // 現在のフレームでの速度

			// 加速処理: 設定された加速時間内で徐々に速度を上げる
			if (elapsed < this.config.accelerationTime) {
				const progress = elapsed / this.config.accelerationTime; // 加速の進行度 (0.0 - 1.0)
				currentSpeed = speed * this.easeInCubic(progress); // イージング関数で滑らかな加速を適用
			} else {
				currentSpeed = speed; // 最高速度に到達
			}

			// `pos`を更新し、リールの全高を超えたらループさせる (無限スクロールの錯覚)
			// 補足: totalHeight は重複分を含む 2 周（または指定周）相当です。mod により継ぎ目を不可視化します。
			pos = (pos + currentSpeed) % reel.totalHeight;

			// `pos`から実際のY座標`newY`を計算し、`transform: translateY()`に適用
			// 回転方向によって計算方法が異なります。
			const newY = this.config.reverseRotation ? (pos - reel.totalHeight) : -pos;
			reel.element.style.transform = `translateY(${newY}px)`;

			// 次のフレームで再度animate関数を呼び出す
			reel.animationFrameId = requestAnimationFrame(animate);
		};
		requestAnimationFrame(animate); // アニメーションを開始
	}

	/**
	 * 指定されたリールを、最も近いシンボルの位置で滑らかに停止させます。
	 * `transform: translateY()`とイージング関数を使用して、自然な停止アニメーションを実現します。
	 * @param {number} index - 停止させるリールのインデックス番号
	 * @param {object} [target=null] - 停止目標オブジェクト。自動モードの狙い撃ち停止時に使用。
	 */
	stopReel(index, target = null) {
		const reel = this.reels[index];
		if (!reel.spinning) return; // 既に停止している場合は何もしない

		cancelAnimationFrame(reel.animationFrameId); // 回転アニメーションをキャンセル

		const currentY = this.ui.getCurrentTranslateY(reel.element); // 現在のY座標を取得

		let targetY;
		let duration;

		if (target) {
			// --- ターゲット停止ロジック（目標に合わせて最短で前方に停止させる） ---
			/* 契約と注意点（簡潔に）
			 * - 入力: target = { symbolIndex?: number, symbol?: string, position?: 'top'|'middle'|'bottom' }
			 * - 副作用: DOM の transform を更新し、該当リールを停止状態にする。
			 * - 重要: reverseRotation が true の場合は「進行方向」が逆転するため、
			 *   「前方／後方」の計算を必ず考慮すること（以下 pickForwardClosestY 参照）。
			 * - 将来の編集で狂いやすい点:
			 *   1) pickForwardClosestY のループ判定を壊すと無限ループや誤ったオフセットが発生します。
			 *   2) 正規化式（mod -> -totalHeight）を変更すると表示が半周ずれるため慎重に。
			 *   3) reel.totalHeight とここで計算する totalHeight を混在させると整合性が崩れる可能性があるため、
			 *      どちらかに統一することを推奨します（本実装は既存プロパティを優先）。
			 */

			const reelSymbols = reel.symbols;
			const symbolHeight = this.config.symbolHeight;
			// ※ totalHeight は「1周分の高さ」を示す（reel.totalHeight は2周分を保持している呼び出し側もある）。
			//    ここでは明示的に算出しているが、以降の計算では既存の reel.totalHeight を参照している箇所があるため
			//    将来編集する場合はどちらを正とするか統一して下さい。
			const totalHeight = reelSymbols.length * symbolHeight;

			// position の意味: top=表示上端にシンボルの先頭、middle=1つ下、bottom=2つ下に該当するようにオフセットを設ける
			const validPositions = ['top', 'middle', 'bottom'];
			let chosenPosition = validPositions.includes(target.position)
				? target.position
				: validPositions[Math.floor(Math.random() * validPositions.length)];
			let positionOffset = 0;
			if (chosenPosition === 'middle') positionOffset = 1;
			if (chosenPosition === 'bottom') positionOffset = 2;

			// 回転方向フラグ（true: 下方向に進行＝reverseRotation での扱い）
			const movingDown = this.config.reverseRotation;

			// currentY は外部で取得済み（この関数冒頭の currentY を参照）
			// 「前方」にある最も近い baseY を返すヘルパー
			const pickForwardClosestY = (baseY) => {
				// 注意: この関数は baseY を基準に currentY の「前方方向」へ伸ばしていく。
				//       ループ条件を誤ると無限ループや off-by-one が発生するため慎重に編集すること。
				let y = baseY;
				if (movingDown) {
					// 下方向に動いている場合、表示上の数値（currentY）は負になり得るため、
					// baseY を currentY 以上になるまで足して調整（最短で前方へ到達する値を生成）
					while (y < currentY) y += reel.totalHeight;
					while (y >= currentY + reel.totalHeight) y -= reel.totalHeight;
				} else {
					// 上方向に動いている場合
					while (y > currentY) y -= reel.totalHeight;
					while (y <= currentY - reel.totalHeight) y += reel.totalHeight;
				}
				return y;
			};

			let targetSymbolTopIndex;
			let baseTargetY;
			let animTargetY;

			if (typeof target.symbolIndex === 'number' && Number.isFinite(target.symbolIndex)) {
				// 明示的なシンボルインデックス指定（トップに来るべきシンボルインデックスを指定）
				const rawIndex = ((target.symbolIndex % reelSymbols.length) + reelSymbols.length) % reelSymbols.length;
				// positionOffset を考慮して「そのシンボルが top に来るインデックス」を算出
				targetSymbolTopIndex = (rawIndex - positionOffset + reelSymbols.length) % reelSymbols.length;
				baseTargetY = -targetSymbolTopIndex * symbolHeight;
				animTargetY = pickForwardClosestY(baseTargetY);

				// position が未指定の場合は seam（表示領域の継ぎ目）を回避しつつ距離が最短の候補を選ぶ
				if (!validPositions.includes(target.position)) {
					const candidates = [];
					for (const pos of validPositions) {
						const offset = pos === 'middle' ? 1 : (pos === 'bottom' ? 2 : 0);
						const topIdx = (rawIndex - offset + reelSymbols.length) % reelSymbols.length;
						const baseY = -topIdx * symbolHeight;
						const y = pickForwardClosestY(baseY);
						// 距離計算は進行方向に沿った単調増加距離を用いる
						const dist = movingDown ? (y - currentY) : (currentY - y);
						// wraps フラグは「1周分以上進むか」を示す（ラップ発生の判定）
						const wraps = movingDown ? (y >= 0) : (y <= -reel.totalHeight);
						candidates.push({ pos, y, dist, wraps, topIdx, baseY });
					}
					// 編集時の注意: sort の比較ロジックを変えるとラップ優先度や体感が変わるため、
					// 最小の dist かつラップしない候補を優先する意図を崩さないでください。
					candidates.sort((a, b) => (Number(a.wraps) - Number(b.wraps)) || (a.dist - b.dist));
					const best = candidates[0];
					chosenPosition = best.pos;
					animTargetY = best.y;
					targetSymbolTopIndex = best.topIdx;
					baseTargetY = best.baseY;
				}
			} else if (typeof target.symbol === 'string') {
				// 絵柄指定: 該当絵柄が複数ある場合は「前方へ最短で到達」する出現位置を選択する
				const candidates = [];
				for (let ci = 0; ci < reelSymbols.length; ci++) {
					if (reelSymbols[ci] === target.symbol) candidates.push(ci);
				}
				if (candidates.length === 0) {
					// 指定された絵柄がこのリールに存在しない場合は通常停止へフォールバック
					console.warn(`Target symbol not found on reel ${index}:`, target.symbol);
					return this.stopReel(index, null);
				}
				// 与えられたオフセットで最短となる候補を探索するヘルパー
				const buildBestForOffset = (offset) => {
					let best = { dist: Infinity, topIndex: 0, baseY: 0, y: 0, wraps: false };
					for (const ci of candidates) {
						const topIndex = (ci - offset + reelSymbols.length) % reelSymbols.length;
						const baseY = -topIndex * symbolHeight;
						const y = pickForwardClosestY(baseY);
						const dist = movingDown ? (y - currentY) : (currentY - y);
						const wraps = movingDown ? (y >= 0) : (y <= -reel.totalHeight);
						if (dist < best.dist) best = { dist, topIndex, baseY, y, wraps };
					}
					return best;
				};

				if (!validPositions.includes(target.position)) {
					// top/middle/bottom の各オフセットで最良を比較して選択
					const options = [
						{ pos: 'top', off: 0 },
						{ pos: 'middle', off: 1 },
						{ pos: 'bottom', off: 2 },
					].map(o => ({
						...o,
						best: buildBestForOffset(o.off)
					}));
					// ラップしないものを優先、次に距離最小
					options.sort((a, b) => (Number(a.best.wraps) - Number(b.best.wraps)) || (a.best.dist - b.best.dist));
					const sel = options[0];
					chosenPosition = sel.pos;
					targetSymbolTopIndex = sel.best.topIndex;
					baseTargetY = sel.best.baseY;
					animTargetY = sel.best.y;
				} else {
					const offset = chosenPosition === 'middle' ? 1 : (chosenPosition === 'bottom' ? 2 : 0);
					const best = buildBestForOffset(offset);
					targetSymbolTopIndex = best.topIndex;
					baseTargetY = best.baseY;
					animTargetY = best.y;
				}
			} else {
				// 指定が不正または欠落している場合は通常停止処理へフォールバック
				// （再帰呼び出しにより最終的に nearest boundary 停止へ統一される）
				return this.stopReel(index, null);
			}

			// 表示レンジに正規化した最終ターゲット（範囲: -totalHeight .. 0）
			// 正規化式は負値領域へ落とし込むための既定式。変更すると半周ずれる恐れあり。
			const finalTargetYNormalized = (((animTargetY % reel.totalHeight) + reel.totalHeight) % reel.totalHeight) - reel.totalHeight;

			// 停止に必要な距離を、進行方向に沿って単方向で算出
			let distanceToStop;
			if (this.config.reverseRotation) {
				// 下方向に進むため、animTargetY が currentY より小さい（負の差）なら一周分追加して正にする
				distanceToStop = animTargetY - currentY;
				if (distanceToStop < 0) distanceToStop += reel.totalHeight;
			} else {
				// 上方向に進むため、currentY から animTargetY へ戻る量を正距離として算出
				distanceToStop = currentY - animTargetY;
				if (distanceToStop < 0) distanceToStop += reel.totalHeight;
			}
			// 距離に基づく停止アニメ時間を共通関数で算出（ここで min/max によるクリッピングも行う）
			duration = this.calculateStopDuration(distanceToStop);

			// さらに上限/下限の二重保護（設定値の暴走を防ぐ）
			duration = Math.min(Math.max(duration, this.config.minStopAnimTime), this.config.maxStopAnimTime);

			// アニメーション開始
			// デバッグログの追加
			if (this.config.debug?.stopLogs) {
				console.log(`--- stopReel Debug Log for Reel ${index} ---`);
				console.log(`Target:`, target);
				console.log(`Chosen Position: ${chosenPosition}`);
				console.log(`Current Y: ${currentY}px`);
				console.log(`Reel Symbols Length: ${reelSymbols.length}`);
				console.log(`Symbol Height: ${symbolHeight}px`);
				console.log(`Total Height (2x): ${totalHeight}px`);
				console.log(`Target Symbol Top Index: ${targetSymbolTopIndex}`);
				console.log(`Base Target Y: ${baseTargetY}px`);
				console.log(`Closest Target Y (anim): ${animTargetY}px`);
				console.log(`Final Target Y (normalized): ${finalTargetYNormalized}px`);
				console.log(`Distance to Stop: ${distanceToStop}px`);
				console.log(`Animation Duration: ${duration}ms`);
			}
			const startY = currentY;
			const startTime = performance.now();

			const animateStop = (currentTime) => {
				const elapsed = currentTime - startTime;
				const progress = Math.min(elapsed / duration, 1);
				const easedProgress = this.getStopEasingFn()(progress);

				// 仮想座標上の進行（前方に単調増加/減少）
				const virtualY = startY + (animTargetY - startY) * easedProgress;
				// 表示用に [-H, 0] へ正規化して適用（フリッカー防止）
				const displayY = (((virtualY % totalHeight) + totalHeight) % totalHeight) - totalHeight;
				reel.element.style.transform = `translateY(${displayY}px)`;

				// 追加ログ（デフォルトOFF）
				if (this.config.debug?.frameLogs) {
					console.log(`Reel ${index} Stop Anim: startY=${startY.toFixed(2)}px, targetY=${animTargetY.toFixed(2)}px, elapsed=${elapsed.toFixed(2)}ms, progress=${progress.toFixed(2)}, easedProgress=${easedProgress.toFixed(2)}, virtualY=${virtualY.toFixed(2)}px, displayY=${displayY.toFixed(2)}px`);
				}

				if (progress < 1) {
					requestAnimationFrame(animateStop);
				} else {
					// 最終位置は正規化した表示値で確定
					const finalY = (((animTargetY % totalHeight) + totalHeight) % totalHeight) - totalHeight;
					reel.element.style.transform = `translateY(${finalY}px)`;
					reel.spinning = false;
					reel.element.classList.remove('spinning'); // 回転中クラスを削除
					this.checkAllStopped();
				}
			};
			requestAnimationFrame(animateStop);

		} else {
			// --- 通常停止ロジックをターゲット生成に切り替え ---
			// 次のシンボル位置に停止するためのターゲットを内部的に生成します。
			const symbolHeight = this.config.symbolHeight;
			const totalHeight = reel.totalHeight;

			// 現在のY座標から、次に最も近いシンボル境界のY座標を計算します。
			let remainder;
			if (this.config.reverseRotation) {
				const pos = currentY + totalHeight;
				remainder = pos % symbolHeight;
			} else {
				const posMod = ((-currentY) % totalHeight + totalHeight) % totalHeight;
				remainder = posMod % symbolHeight;
			}
			const distanceToNext = (symbolHeight - remainder) % symbolHeight;
			// 停止目標となるY座標
			const targetY = currentY + (this.config.reverseRotation ? distanceToNext : -distanceToNext);

			// targetYから、その位置に該当するシンボルのインデックスを計算します。
			// Y座標は負の値であるため、-1を掛けて正のインデックスに変換し、リールシンボル数で剰余を取ります。
			const targetSymbolTopIndex = Math.round(-targetY / symbolHeight) % reel.symbols.length;

			// 新しいターゲットオブジェクトを作成します。
			// positionは'top'固定とすることで、シンボルが常に上端に揃うようにします。
			const newTarget = {
				reelIndex: index,
				symbolIndex: targetSymbolTopIndex,
				position: 'top'
			};

			if (this.config.debug?.stopLogs) {
				console.log(`--- stopReel Normal to Target Fallback for Reel ${index} ---`);
				console.log(`Current Y: ${currentY}px, Calculated Target Y: ${targetY}px, Target Index: ${targetSymbolTopIndex}`);
				console.log(`Generated Target:`, newTarget);
			}

			// 生成したターゲットで自身を再帰的に呼び出します。
			// これにより、全ての停止処理がターゲットベースのロジックに統一され、挙動の差異がなくなります。
			return this.stopReel(index, newTarget);
		}
	}

	/**
	 * 「目押し」モード中に、プレイヤーがボタンを押した際にリールを1つずつ停止させる関数です。
	 * 自動モード中や、全てのリールが停止済みの場合は何もしません。
	 */
	stopManual() {
		// 自動モード中、または全てのリールが停止済みであれば処理を中断
		if (this.isAutoMode || this.manualStopCount >= this.config.reelCount) return;

		this.stopReel(this.manualStopCount); // 現在のカウンターに対応するリールを停止
		this.manualStopCount++;              // 次に停止させるリールのインデックスを更新

		// 最後のリールを停止させたら、誤操作防止のためにボタンを無効化
		if (this.manualStopCount === this.config.reelCount) {
			this.ui.setActionBtnDisabled(true);
		}
	}

	/**
	 * 全てのリールが停止したかを確認し、ゲーム終了後の後処理を行います。
	 * 全て停止したら、スタートボタンを再度有効化します。
	 */
	checkAllStopped() {
		// 全てのリールが回転中でないことを確認
		if (this.reels.every(r => !r.spinning)) {
			this.isSpinning = false; // ゲーム全体が停止状態であることを示す
			this.ui.setActionBtnText('▶ スタート'); // ボタンテキストを「スタート」に戻す
			this.ui.setActionBtnDisabled(false); // ボタンを有効化
		}
	}

	/**
	 * 設定された確率に基づいて、次に狙うシンボルを抽選します。
	 * @returns {string} 抽選されたシンボルの文字（例: '🍒'）
	 */
	chooseSymbolByProbability() {
		// 推奨: winSymbolWeights = { '7️⃣': 1.0, 'BAR': 0.5, '🍒': 0.2, ... }
		const weights = this.config.winSymbolWeights;
		if (weights && Object.keys(weights).length > 0) {
			// 全リール共通に存在するシンボルのみを対象（揃えられない候補は除外）
			const common = this.reels.reduce((acc, r) => acc.filter(sym => r.symbols.includes(sym)), Object.keys(weights));
			const filtered = common.filter(sym => weights[sym] > 0);
			if (filtered.length > 0) {
				const total = filtered.reduce((s, sym) => s + weights[sym], 0);
				let r = Math.random() * total;
				for (const sym of filtered) {
					r -= weights[sym];
					if (r <= 0) return sym;
				}
				return filtered[filtered.length - 1];
			}
		}
		// フォールバック: 左リールからランダム
		const symbols = this.reels[0].symbols;
		return symbols[Math.floor(Math.random() * symbols.length)];
	}

	/**
	 * リールが停止する際のアニメーション時間を計算します。
	 * 停止までの残り距離と速度に基づいて、滑らかな停止に必要な時間を算出します。
	 * @param {number} distance - 次のシンボル位置までの残り距離 (ピクセル単位)
	 * @returns {number} アニメーション時間 (ミリ秒)。設定された最小・最大値の範囲内に収まります。
	 */
	calculateStopDuration(distance) {
		// 現在のモードに応じた速度（px/frame）
		const speed = this.isAutoMode ? this.config.autoSpeed : this.config.manualSpeed;
		// rAF 60fps を想定して px/frame → px/ms に換算し、イージング導関数(0)でスケール
		const msPerFrame = 1000 / 60;
		const deriv0 = this.getStopEasingDerivative0();
		let time = (distance / speed) * msPerFrame * deriv0;
		// 自動停止時は一定以上の減速時間を確保して体感差を抑える
		if (this.isAutoMode && typeof this.config.stopBaseDurationMs === 'number') {
			time = Math.max(time, this.config.stopBaseDurationMs);
		}
		// 設定された最小・最大値の範囲に収まるように調整
		return Math.min(Math.max(time, this.config.minStopAnimTime), this.config.maxStopAnimTime);
	}

	// 停止用イージングを設定から取得
	getStopEasingFn() {
		switch (this.config.stopEasing) {
			case 'linear':
				return this.easeLinear;
			case 'quad':
				return this.easeOutQuad;
			case 'sine':
				return this.easeOutSine;
			case 'cubic':
			default:
				return this.easeOutCubic;
		}
	}

	// 選択イージングの t=0 での導関数（初速係数）
	getStopEasingDerivative0() {
		switch (this.config.stopEasing) {
			case 'linear': // f(t)=t => f'(0)=1
				return 1;
			case 'quad': // 1 - (1-t)^2 => d/dt = 2 - 2t, t=0 => 2
				return 2;
			case 'sine': // sin(t*pi/2) => d/dt = (pi/2)cos(t*pi/2), t=0 => pi/2
				return Math.PI / 2;
			case 'cubic':
			default: // 1 - (1-t)^3 => d/dt = 3 - 6t + 3t^2, t=0 => 3
				return 3;
		}
	}

	// --- イージング関数 ---
	/**
	 * キュービックイーズイン関数。アニメーションの開始をゆっくりにし、徐々に加速させます。
	 * @param {number} t - 進行度 (0.0 - 1.0)
	 * @returns {number} 補間された値
	 */
	easeInCubic(t) { return t * t * t; }

	/**
	 * キュービックイーズアウト関数。アニメーションの開始を速くし、徐々に減速させます。
	 * @param {number} t - 進行度 (0.0 - 1.0)
	 * @returns {number} 補間された値
	 */
	easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

	/**
	 * クアドラティック（2次）イーズアウト。
	 */
	easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

	/**
	 * サイン型イーズアウト。
	 */
	easeOutSine(t) { return Math.sin((t * Math.PI) / 2); }

	/**
	 * リニア（直線）イージング。
	 */
	easeLinear(t) { return t; }
}

// DOMが完全に読み込まれたらゲームを開始する
document.addEventListener('DOMContentLoaded', () => {
	// gameConfigがグローバルに存在することを想定
	// もし存在しない場合は、ここでconfig.jsから読み込むか、定義する必要がある
	// 注意: index.html は defer で config.js → script.js の順に読み込みます。順序を変えると gameConfig 未定義になります。
	const slotMachineElement = document.querySelector(gameConfig.selectors.slotMachine);
	if (slotMachineElement) {
		new SlotGame(slotMachineElement, gameConfig);
	} else {
		console.error('スロットマシンの要素が見つかりません。セレクターを確認してください:', gameConfig.selectors.slotMachine);
	}
});