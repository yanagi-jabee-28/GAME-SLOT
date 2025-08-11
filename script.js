
// ===================================================================================
// 定数
// ===================================================================================

/** 各リールの絵柄の定義（リールストリップ） */
const REEL_SYMBOLS = [
    ['🍒', '🍉', '🔔', '👑', '👑', '🍒', 'BAR', '７', 'BAR', '🍉', '🔔', '🍒', '🍉', '🔔', 'BAR', '🍒', '🍉', '🔔', '🍒', '🍉', '🍒'],
    ['🍉', '🍒', 'BAR', '🔔', '👑', '７', '👑', '🍒', '🍉', 'BAR', '🔔', '🍒', '🍉', '🔔', 'BAR', '🍒', '🍉', '🔔', '🍒', '🍉', '🍒'],
    ['🔔', '🍒', 'BAR', '🍉', '👑', '７', '🍒', 'BAR', '🍉', '🔔', '👑', '🍒', 'BAR', '🍉', '🔔', '🍒', '🍉', '🔔', '🍒', '🍉', '🍒']
];

/** 配当表 (キー: 揃った絵柄3つの文字列, 値: 配当コイン) */
const PAYOUT_TABLE = {
    '７７７': 300,
    '👑👑👑': 100,
    'BARBARBAR': 80,
    '🔔🔔🔔': 50,
    '🍉🍉🍉': 20,
    '🍒🍒🍒': 10,
};

/** 当たりラインの定義 (リールインデックス, セルインデックス) */
const PAYLINES = [
    [0, 0, 0], // 上段
    [1, 1, 1], // 中段
    [2, 2, 2], // 下段
    [0, 1, 2], // 右下がり斜め
    [2, 1, 0]  // 右上がり斜め
];

/** 1スピンあたりの消費コイン */
const SPIN_COST = 10;

/** 1マスの高さ (px) */
const CELL_HEIGHT = 80;

/** アニメーション設定 */
const ANIMATION_CONFIG = {
    /** 初速の基本値 (px/s) */
    BASE_SPEED: 1800,
    /** 初速のばらつき (± px/s) */
    SPEED_VARIATION: 300,
    /** 減速時間 (ms) - 1番目のリール */
    DECEL_DURATION_BASE: 320,
    /** 減速時間 (ms) - リール毎の追加時間 */
    DECEL_DURATION_INCREMENT: 80,
};


// ===================================================================================
// DOM要素の取得
// ===================================================================================

const reelElements = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
];
const spinButton = document.getElementById('spin-button');
const creditsDisplay = document.getElementById('credits-display');
const resultDisplay = document.getElementById('result-display');


// ===================================================================================
// ゲーム状態管理
// ===================================================================================

/**
 * ゲームの状態を管理するオブジェクト
 */
const gameState = {
    credits: 1000,
    isSpinning: false,
    reelsToStop: 0,
    reelStates: [], // 各リールのアニメーション状態
    animationFrameId: null,
    lastTimestamp: 0,
};


// ===================================================================================
// 初期化処理
// ===================================================================================

/**
 * ページの読み込み完了時に実行されるメインの初期化関数
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
    setupEventListeners();
});

/**
 * ゲームの初期設定を行う
 */
function initializeGame() {
    updateCreditsDisplay();
    // 3本のリールを初期化
    reelElements.forEach((reelEl, i) => {
        setupReel(reelEl, i);
        // 初期表示をランダムに設定
        const stopIndex = Math.floor(Math.random() * REEL_SYMBOLS[i].length);
        setReelStopPosition(i, stopIndex);
    });
}

/**
 * 各リールのDOM構造を初期設定する
 * @param {HTMLElement} reelEl - リールのDOM要素
 * @param {number} reelIndex - リールのインデックス
 */
function setupReel(reelEl, reelIndex) {
    reelEl.innerHTML = ''; // 中身をクリア
    const reelInner = document.createElement('div');
    reelInner.classList.add('reel-inner');

    // アニメーションが途切れないように、絵柄を2周分つなげて配置する
    const extendedSymbols = [...REEL_SYMBOLS[reelIndex], ...REEL_SYMBOLS[reelIndex]];

    for (const symbol of extendedSymbols) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.textContent = symbol;
        reelInner.appendChild(cell);
    }
    reelEl.appendChild(reelInner);
}

/**
 * イベントリスナーを設定する
 */
function setupEventListeners() {
    spinButton.addEventListener('click', handleSpinButtonClick);
}


// ===================================================================================
// イベントハンドラ
// ===================================================================================

/**
 * スピン/ストップボタンがクリックされたときの処理
 */
function handleSpinButtonClick() {
    if (!gameState.isSpinning) {
        startSpin();
    } else {
        stopNextReel();
    }
}


// ===================================================================================
// ゲームロジック
// ===================================================================================

/**
 * スピンを開始する
 */
function startSpin() {
    if (gameState.credits < SPIN_COST) {
        resultDisplay.textContent = 'コインが足りません！';
        spinButton.disabled = true;
        return;
    }

    // --- スピン開始の準備 ---
    gameState.isSpinning = true;
    gameState.reelsToStop = 0;
    gameState.reelStates = [];
    clearWinHighlights();

    // UI更新
    spinButton.textContent = 'ストップ';
    spinButton.classList.add('stop-mode');
    resultDisplay.textContent = 'ボタンを押してリールを止めよう！';

    // コイン消費
    gameState.credits -= SPIN_COST;
    updateCreditsDisplay();

    // --- 各リールのアニメーション設定 ---
    reelElements.forEach((_, i) => {
        const speedVariation = Math.random() * ANIMATION_CONFIG.SPEED_VARIATION - (ANIMATION_CONFIG.SPEED_VARIATION / 2);
        const initialSpeed = ANIMATION_CONFIG.BASE_SPEED + speedVariation;
        gameState.reelStates[i] = {
            position: 0,
            speed: initialSpeed,
            isDecelerating: false,
            decelStartTime: 0,
            decelDuration: 0,
            startPosition: 0,
            finalPosition: 0,
            stopIndex: null,
            isFinished: false
        };
    });

    // --- アニメーションループ開始 ---
    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
    }
    gameState.lastTimestamp = performance.now();
    gameState.animationFrameId = requestAnimationFrame(animateReels);
}

/**
 * 次のリールを停止させる
 */
function stopNextReel() {
    const reelIndex = gameState.reelsToStop;
    if (reelIndex >= REEL_SYMBOLS.length) return;

    const state = gameState.reelStates[reelIndex];
    if (!state || state.isDecelerating) return; // 既に減速中の場合は何もしない

    // --- 目押し処理: 押した瞬間の絵柄を停止位置とする ---
    const reelSymbols = REEL_SYMBOLS[reelIndex];
    const loopHeight = reelSymbols.length * CELL_HEIGHT;
    const currentOffset = gameState.reelStates[reelIndex].position % loopHeight;
    const topIndex = Math.floor(currentOffset / CELL_HEIGHT);
    const middleIndex = (topIndex + 1) % reelSymbols.length;
    const stopIndex = middleIndex; // 中段の絵柄で停止させる

    // --- 減速アニメーションのパラメータ設定 ---
    state.isDecelerating = true;
    state.decelStartTime = performance.now();
    state.decelDuration = ANIMATION_CONFIG.DECEL_DURATION_BASE + reelIndex * ANIMATION_CONFIG.DECEL_DURATION_INCREMENT;
    state.stopIndex = stopIndex;
    state.startPosition = state.position;

    // --- 最終停止位置の計算 ---
    // 最終的に、リールの上端が (stopIndex - 1) の絵柄の位置に来るように調整する
    const targetOffsetInLoop = ((stopIndex - 1 + reelSymbols.length) % reelSymbols.length) * CELL_HEIGHT;
    const currentOffsetInLoop = state.startPosition % loopHeight;

    let deltaOffset = targetOffsetInLoop - currentOffsetInLoop;
    if (deltaOffset < 0) {
        deltaOffset += loopHeight; // 必ず正の方向に回す
    }

    // 最低1周は回すことで、自然な停止を演出
    const extraRotation = loopHeight;
    state.finalPosition = state.startPosition + deltaOffset + extraRotation;

    gameState.reelsToStop++;
}

/**
 * 全てのリールが停止したか判定し、終了処理を行う
 */
function tryFinishSpin() {
    const allFinished = gameState.reelStates.every(s => s.isFinished);
    if (!allFinished) return;

    // --- スピン終了処理 ---
    cancelAnimationFrame(gameState.animationFrameId);
    gameState.animationFrameId = null;
    gameState.isSpinning = false;

    // UI更新
    spinButton.textContent = 'スピン！';
    spinButton.classList.remove('stop-mode');
    if (gameState.credits < SPIN_COST) {
        spinButton.disabled = true;
        resultDisplay.textContent = 'コインが足りません！';
    }

    // 当たり判定
    const stopIndexes = gameState.reelStates.map(s => s.stopIndex);
    checkWin(stopIndexes);
}

/**
 * 当たり判定と配当処理
 * @param {number[]} stopIndexes - 3つのリールの停止位置の配列
 */
function checkWin(stopIndexes) {
    const board = getBoard(stopIndexes);
    let totalWin = 0;
    const winningPaylines = [];

    // 各ペイラインをチェック
    PAYLINES.forEach((line, lineIndex) => {
        const symbol1 = board[0][line[0]];
        const symbol2 = board[1][line[1]];
        const symbol3 = board[2][line[2]];

        if (symbol1 === symbol2 && symbol2 === symbol3) {
            const winKey = `${symbol1}${symbol2}${symbol3}`;
            const payout = PAYOUT_TABLE[winKey];
            if (payout) {
                totalWin += payout;
                winningPaylines.push(lineIndex);
            }
        }
    });

    // --- 結果の表示とコインの更新 ---
    if (totalWin > 0) {
        gameState.credits += totalWin;
        resultDisplay.textContent = `${totalWin}コイン GET!`;
        highlightWinningLines(winningPaylines);
    } else {
        resultDisplay.textContent = '残念！';
    }
    updateCreditsDisplay();
}


// ===================================================================================
// 描画・アニメーション
// ===================================================================================

/**
 * リールのアニメーションを更新する (requestAnimationFrameで毎フレーム呼ばれる)
 * @param {DOMHighResTimeStamp} timestamp - 現在のタイムスタンプ
 */
function animateReels(timestamp) {
    const deltaTime = (timestamp - gameState.lastTimestamp) / 1000; // 経過時間(秒)
    gameState.lastTimestamp = timestamp;

    gameState.reelStates.forEach((state, i) => {
        if (state.isFinished) return;

        const reelInner = reelElements[i].querySelector('.reel-inner');
        if (!reelInner) return;

        if (!state.isDecelerating) {
            // 等速回転
            state.position += state.speed * deltaTime;
        } else {
            // 減速回転 (ease-out cubic)
            const progress = Math.min(1, (timestamp - state.decelStartTime) / state.decelDuration);
            const ease = 1 - Math.pow(1 - progress, 3);
            state.position = state.startPosition + (state.finalPosition - state.startPosition) * ease;

            if (progress >= 1) {
                // 減速完了
                state.isFinished = true;
                // 最終位置に正確に合わせる
                setReelStopPosition(i, state.stopIndex);
                return; // このフレームでのtransform更新は不要
            }
        }

        // リールの表示を更新
        const loopHeight = REEL_SYMBOLS[i].length * CELL_HEIGHT;
        reelInner.style.transform = `translateY(${- (state.position % loopHeight)}px)`;
    });

    tryFinishSpin(); // 全リールが停止したかチェック

    if (gameState.animationFrameId) {
        gameState.animationFrameId = requestAnimationFrame(animateReels);
    }
}

/**
 * リールの最終的な停止位置を設定する
 * @param {number} reelIndex - リールのインデックス
 * @param {number} stopIndex - 停止する絵柄のインデックス
 */
function setReelStopPosition(reelIndex, stopIndex) {
    const reelInner = reelElements[reelIndex].querySelector('.reel-inner');
    const reelSymbols = REEL_SYMBOLS[reelIndex];
    // 停止位置は、目的の絵柄が中央 (2番目) に来るように、その前の絵柄を一番上に表示する
    const topSymbolPosition = ((stopIndex - 1 + reelSymbols.length) % reelSymbols.length) * CELL_HEIGHT;
    reelInner.style.transform = `translateY(-${topSymbolPosition}px)`;
}

/**
 * 所持コインの表示を更新する
 */
function updateCreditsDisplay() {
    creditsDisplay.textContent = `コイン: ${gameState.credits}`;
}

/**
 * 当たったラインをハイライトする
 * @param {number[]} winningPaylines - 当たったペイラインのインデックス配列
 */
function highlightWinningLines(winningPaylines) {
    winningPaylines.forEach(lineIndex => {
        const line = PAYLINES[lineIndex];
        line.forEach((cellRowIndex, reelIndex) => {
            const reelEl = reelElements[reelIndex];
            // 表示されているのは3つのセルだけなので、nth-childで直接指定できる
            const cell = reelEl.querySelector(`.reel-inner .cell:nth-child(${cellRowIndex + 1})`);
            if (cell) {
                cell.classList.add('winning-cell');
            }
        });
    });
}

/**
 * 全ての当たりハイライトを消す
 */
function clearWinHighlights() {
    document.querySelectorAll('.winning-cell').forEach(el => {
        el.classList.remove('winning-cell');
    });
}

/**
 * 現在の表示盤面を3x3の2次元配列で取得する
 * @param {number[]} stopIndexes - 3つのリールの停止位置の配列
 * @returns {string[][]} 3x3の盤面データ
 */
function getBoard(stopIndexes) {
    return stopIndexes.map((stopIndex, reelIndex) => {
        const reel = REEL_SYMBOLS[reelIndex];
        const reelLength = reel.length;
        // [上段, 中段, 下段] の絵柄を取得
        const top = reel[(stopIndex - 1 + reelLength) % reelLength];
        const middle = reel[stopIndex];
        const bottom = reel[(stopIndex + 1) % reelLength];
        return [top, middle, bottom];
    });
}
