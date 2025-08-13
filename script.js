/**
 * @file script.js
 * @brief スロットゲームの主要なロジックを管理するJavaScriptファイル。
 *        リールの生成、回転アニメーション、停止制御、ゲームモードの切り替えなどを担当します。
 */

/**
 * UI要素の管理とDOM操作を担当するクラス。
 * SlotGameクラスからUIに関する責務を分離し、コードの見通しと保守性を向上させます。
 */
class UIManager {
    /**
     * UIManagerクラスのコンストラクタ。
     * @param {object} config - ゲームの設定オブジェクト
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

    /**
     * 指定されたHTML要素の現在のY軸方向の`transform`変位量を取得します。
     * `getComputedStyle`と`DOMMatrix`を使用して、正確なピクセル値を取得します。
     * @param {HTMLElement} element - Y軸変位量を取得する対象のHTML要素
     * @returns {number} Y軸の変位量 (ピクセル単位)。transformが設定されていない場合は0を返します。
     */
    getCurrentTranslateY(element) {
        const style = window.getComputedStyle(element);
        // `transform`プロパティの計算値からDOMMatrixオブジェクトを生成
        // DOMMatrixは、要素に適用されている変換行列を表します。
        const matrix = new DOMMatrix(style.transform);
        // `m42`は、変換行列のY軸方向の平行移動成分（translateY）を表します。
        return matrix.m42;
    }

    /**
     * ゲームの操作ボタンにイベントリスナーを設定します。
     */
    bindEvents() {
        // スタート/ストップボタンがクリックされたらhandleActionメソッドを実行
        this.ui.elements.actionBtn.addEventListener('click', () => this.handleAction());
        // モード切り替えボタンがクリックされたらtoggleModeメソッドを実行
        this.ui.elements.modeBtn.addEventListener('click', () => this.toggleMode());
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
            this.config.autoStopTimings.forEach((time, i) => {
                // 停止タイミングにランダムな揺らぎを追加し、単調さをなくす
                const randomTime = time + (Math.random() * this.config.autoStopTimeRandomness * 2 - this.config.autoStopTimeRandomness);
                setTimeout(() => this.stopReel(i), randomTime);
            });
        } else {
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
     */
    stopReel(index) {
        const reel = this.reels[index];
        if (!reel.spinning) return; // 既に停止している場合は何もしない

        cancelAnimationFrame(reel.animationFrameId); // 回転アニメーションをキャンセル

        const currentY = this.ui.getCurrentTranslateY(reel.element); // 現在のY座標を取得

        // 現在のY座標から、次のシンボルでぴったり止まるための残りの距離を計算
        let remainder; // シンボル境界からの残りピクセル数
        if (this.config.reverseRotation) {
            // 逆回転の場合: `currentY`は負の値で、下方向が正。`pos`は正の値で、`totalHeight`を加算して正規化
            const pos = currentY + reel.totalHeight;
            remainder = pos % this.config.symbolHeight;
        } else {
            // 正回転の場合: `currentY`は負の値で、上方向が正。`posMod`は正の値で、`totalHeight`で剰余を取る
            const posMod = ((-currentY) % reel.totalHeight + reel.totalHeight) % reel.totalHeight;
            remainder = posMod % this.config.symbolHeight;
        }

        // 次のシンボル位置までの距離を計算
        const distanceToNext = (this.config.symbolHeight - remainder) % this.config.symbolHeight;

        // 最終的な停止位置`targetY`を計算
        // 回転方向によって`distanceToNext`を加算するか減算するかが変わります。
        const targetY = currentY + (this.config.reverseRotation ? distanceToNext : -distanceToNext);

        const duration = this.calculateStopDuration(distanceToNext); // 停止アニメーションにかける時間
        const startY = currentY; // アニメーション開始時のY座標
        const startTime = performance.now(); // アニメーション開始時刻

        // 停止のための短いアニメーションループ関数
        const animateStop = (currentTime) => {
            const elapsed = currentTime - startTime; // 経過時間
            const progress = Math.min(elapsed / duration, 1); // アニメーションの進行度 (0.0 - 1.0)
            const easedProgress = this.easeOutCubic(progress); // イーズアウト関数で滑らかに減速

            // 現在のY座標を計算し、`transform: translateY()`に適用
            const newY = startY + (targetY - startY) * easedProgress;
            reel.element.style.transform = `translateY(${newY}px)`;

            if (progress < 1) {
                requestAnimationFrame(animateStop); // アニメーション継続
            } else {
                // アニメーション完了: 最終位置に正確に設定し、リールの状態を更新
                reel.element.style.transform = `translateY(${targetY}px)`;
                reel.spinning = false;
                this.checkAllStopped(); // 全てのリールが停止したかを確認
            }
        };
        requestAnimationFrame(animateStop); // 停止アニメーションを開始
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
     * リールが停止する際のアニメーション時間を計算します。
     * 停止までの残り距離と速度に基づいて、滑らかな停止に必要な時間を算出します。
     * @param {number} distance - 次のシンボル位置までの残り距離 (ピクセル単位)
     * @returns {number} アニメーション時間 (ミリ秒)。設定された最小・最大値の範囲内に収まります。
     */
    calculateStopDuration(distance) {
        // 現在のモードに応じた速度を使用
        const speed = this.isAutoMode ? this.config.autoSpeed : this.config.manualSpeed;
        // 距離と速度からおおよその時間を計算し、フレームレート(20ms/frame)を考慮
        let time = Math.ceil(distance / speed) * 20;
        // 計算された時間が設定された最小・最大値の範囲に収まるように調整
        return Math.min(Math.max(time, this.config.minStopAnimTime), this.config.maxStopAnimTime);
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
}

// DOMが完全に読み込まれたらゲームを開始する
document.addEventListener('DOMContentLoaded', () => {
    // gameConfigがグローバルに存在することを想定
    // もし存在しない場合は、ここでconfig.jsから読み込むか、定義する必要がある
    const slotMachineElement = document.querySelector(gameConfig.selectors.slotMachine);
    if (slotMachineElement) {
        new SlotGame(slotMachineElement, gameConfig);
    } else {
        console.error('スロットマシンの要素が見つかりません。セレクターを確認してください:', gameConfig.selectors.slotMachine);
    }
});
