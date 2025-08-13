/**
 * スロットゲーム全体を管理するクラス
 */
class SlotGame {
	/**
	 * @param {HTMLElement} element - スロットマシンのコンテナ要素
	 * @param {object} config - ゲームの設定オブジェクト
	 */
	constructor(element, config) {
		// --- DOM要素の保持 ---
		this.slotContainer = element;
		this.actionBtn = document.getElementById('actionBtn');
		this.modeBtn = document.getElementById('modeBtn');

		// --- 設定の保持 ---
		this.config = config;

		// --- 状態の初期化 ---
		this.reels = []; // 各リールのDOM要素や状態を管理する配列
		this.isSpinning = false; // 全体の回転状態
		this.isAutoMode = true; // 現在のモード
		this.manualStopCount = 0; // 目押しモードでの停止カウンタ

		// 初期化処理の呼び出し
		this.init();
	}

	/**
	 * ゲームの初期化処理
	 */
	init() {
		this.buildReels();
		this.setInitialPositions();
		this.bindEvents();
	}

	/**
	 * HTMLにリール要素を生成して配置する
	 */
	buildReels() {
		this.slotContainer.innerHTML = ''; // コンテナをクリア
		for (let i = 0; i < this.config.reelCount; i++) {
			const reelElement = document.createElement('div');
			reelElement.className = 'reel';
			const symbolsElement = document.createElement('div');
			symbolsElement.className = 'symbols';

			const reelSymbols = this.config.reelsData[i];
			const fragment = document.createDocumentFragment();
			for (let j = 0; j < reelSymbols.length * 2; j++) {
				const symbol = reelSymbols[j % reelSymbols.length];
				const symbolElement = document.createElement('div');
				symbolElement.className = 'symbol';
				symbolElement.textContent = symbol;
				if (symbol === 'BAR') {
					symbolElement.classList.add('bar');
				}
				fragment.appendChild(symbolElement);
			}

			symbolsElement.appendChild(fragment);
			reelElement.appendChild(symbolsElement);
			this.slotContainer.appendChild(reelElement);

			this.reels.push({
				element: symbolsElement,
				symbols: reelSymbols,
				spinning: false,
				animationFrameId: null,
				totalHeight: reelSymbols.length * this.config.symbolHeight
			});
		}
	}

	/**
	 * 設定に基づいて各リールの初期位置を設定する
	 */
	setInitialPositions() {
		this.reels.forEach((reel, index) => {
			const positionIndex = this.config.initialReelPositions[index];
			if (positionIndex < 0 || positionIndex >= reel.symbols.length) {
				console.error(`リール${index}の初期位置(${positionIndex})が無効です。0に設定します。`);
				reel.element.style.transform = 'translateY(0px)';
				return;
			}
			const yPosition = -positionIndex * this.config.symbolHeight;
			reel.element.style.transform = `translateY(${yPosition}px)`;
		});
	}

	/**
	 * 要素の現在のY軸方向のtransform値を取得する
	 * @param {HTMLElement} element - 対象の要素
	 * @returns {number} Y軸の変位量(px)
	 */
	getCurrentTranslateY(element) {
		const style = window.getComputedStyle(element);
		const matrix = new DOMMatrix(style.transform);
		return matrix.m42;
	}

	/**
	 * イベントリスナーを設定する
	 */
	bindEvents() {
		this.actionBtn.addEventListener('click', () => this.handleAction());
		this.modeBtn.addEventListener('click', () => this.toggleMode());
	}

	/**
	 * スタート/ストップボタンの処理を振り分ける
	 */
	handleAction() {
		if (this.isSpinning) {
			this.stopManual();
		} else {
			this.startGame();
		}
	}

	/**
	 * ゲームモードを切り替える
	 */
	toggleMode() {
		if (this.isSpinning) return;
		this.isAutoMode = !this.isAutoMode;
		this.modeBtn.textContent = `モード: ${this.isAutoMode ? '自動' : '目押し'}`;
	}

	/**
	 * ゲームを開始する
	 */
	startGame() {
		if (this.isSpinning) return;
		this.isSpinning = true;
		this.manualStopCount = 0;

		const speed = this.isAutoMode ? this.config.autoSpeed : this.config.manualSpeed;

		this.reels.forEach((reel, i) => {
			this.startReel(i, speed);
		});

		if (this.isAutoMode) {
			this.actionBtn.disabled = true;
			this.config.autoStopTimings.forEach((time, i) => {
				const randomTime = time + (Math.random() * 1000 - 500);
				setTimeout(() => this.stopReel(i), randomTime);
			});
		} else {
			this.actionBtn.textContent = '⏸ 停止';
		}
	}

	/**
	 * 指定されたリールの回転を開始する
	 * @param {number} index - リールのインデックス
	 * @param {number} speed - 回転速度
	 */
	startReel(index, speed) {
		const reel = this.reels[index];
		reel.spinning = true;

		const currentY = this.getCurrentTranslateY(reel.element);
		let pos = this.config.reverseRotation ? (currentY + reel.totalHeight) : -currentY;

		const startTime = performance.now();

		const animate = (currentTime) => {
			if (!reel.spinning) return;

			const elapsed = currentTime - startTime;
			let currentSpeed = (elapsed < this.config.accelerationTime)
				? speed * this.easeInCubic(elapsed / this.config.accelerationTime)
				: speed;

			pos = (pos + currentSpeed) % reel.totalHeight;

			const newY = this.config.reverseRotation ? (pos - reel.totalHeight) : -pos;
			reel.element.style.transform = `translateY(${newY}px)`;

			reel.animationFrameId = requestAnimationFrame(animate);
		};
		requestAnimationFrame(animate);
	}

	/**
	 * 指定されたリールを停止する
	 * @param {number} index - リールのインデックス
	 */
	stopReel(index) {
		const reel = this.reels[index];
		if (!reel.spinning) return;

		cancelAnimationFrame(reel.animationFrameId);

		const currentY = this.getCurrentTranslateY(reel.element);

		let remainder;
		if (this.config.reverseRotation) {
			const pos = currentY + reel.totalHeight;
			remainder = pos % this.config.symbolHeight;
		} else {
			const posMod = ((-currentY) % reel.totalHeight + reel.totalHeight) % reel.totalHeight;
			remainder = posMod % this.config.symbolHeight;
		}

		const distanceToNext = (this.config.symbolHeight - remainder) % this.config.symbolHeight;

		const targetY = currentY + (this.config.reverseRotation ? distanceToNext : -distanceToNext);

		const duration = this.calculateStopDuration(distanceToNext);
		const startY = currentY;
		const startTime = performance.now();

		const animateStop = (currentTime) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const easedProgress = this.easeOutCubic(progress);

			const newY = startY + (targetY - startY) * easedProgress;
			reel.element.style.transform = `translateY(${newY}px)`;

			if (progress < 1) {
				requestAnimationFrame(animateStop);
			} else {
				reel.element.style.transform = `translateY(${targetY}px)`;
				reel.spinning = false;
				this.checkAllStopped();
			}
		};
		requestAnimationFrame(animateStop);
	}

	/**
	 * 目押しモードでリールを停止する
	 */
	stopManual() {
		if (this.isAutoMode || this.manualStopCount >= this.config.reelCount) return;
		this.stopReel(this.manualStopCount);
		this.manualStopCount++;
		if (this.manualStopCount === this.config.reelCount) {
			this.actionBtn.disabled = true;
		}
	}

	/**
	 * 全てのリールが停止したかを確認し、後処理を行う
	 */
	checkAllStopped() {
		if (this.reels.every(r => !r.spinning)) {
			this.isSpinning = false;
			this.actionBtn.textContent = '▶ スタート';
			this.actionBtn.disabled = false;
		}
	}

	/**
	 * 停止アニメーションの時間を計算する
	 * @param {number} distance - 次のシンボルまでの距離
	 * @returns {number} アニメーション時間(ms)
	 */
	calculateStopDuration(distance) {
		const speed = this.isAutoMode ? this.config.autoSpeed : this.config.manualSpeed;
		let time = Math.ceil(distance / speed) * 20;
		return Math.min(Math.max(time, this.config.minStopAnimTime), this.config.maxStopAnimTime);
	}

	// --- イージング関数 ---
	easeInCubic(t) { return t * t * t; }
	easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
}

// --- ゲーム設定 ---
const gameConfig = {
	reelCount: 3,
	symbolHeight: 80,
	reelsData: [
		['🍑', '🍋', '🍎', '🍑', '🍋', '💎', '🍉', '🍑', '🍋', 'BAR', '🍒', '🍎', '🍑', '🍋', '🍉', '🍑', '🍋', '7️⃣', '🍇', '7️⃣', '🍇'],
		['🍑', '🍒', '🍋', '🍑', '🍎', '💎', '🍉', '🍋', '🍑', '🍒', 'BAR', '🍒', '🍋', '🍑', '🍉', '🍋', '🍑', '🍇', '7️⃣', '🍇', '🍋'],
		['🍋', '🍎', '🍑', '🍋', '🍉', '💎', '🍑', '🍋', '🍒', 'BAR', '🍑', '🍋', '🍉', '🍎', '🍑', '🍋', '🍇', '7️⃣', '🍇', '7️⃣', '🍑']
	],
	initialReelPositions: [17, 17, 17],
	autoStopTimings: [2000, 3000, 4000],
	autoSpeed: 20, // 自動モードの速度
	manualSpeed: 10,  // 目押しモードの速度
	accelerationTime: 1000,
	minStopAnimTime: 100,
	maxStopAnimTime: 1000,
	reverseRotation: true, // ★変更：回転方向を逆にするか (true:逆回転, false:正回転)
};

// --- ゲームインスタンスの生成 ---
document.addEventListener('DOMContentLoaded', () => {
	const slotMachineElement = document.getElementById('slot-machine');
	if (slotMachineElement) {
		new SlotGame(slotMachineElement, gameConfig);
	}
});
