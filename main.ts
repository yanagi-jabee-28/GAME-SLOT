// スロットのリールに表示するシンボル
const symbols: string[] = ['🍒', '🍋', '🔔', '🍉', '⭐'];

// HTML要素の取得
const reels = document.querySelectorAll('.reel') as NodeListOf<HTMLDivElement>;
const spinButton = document.getElementById('spin-button') as HTMLButtonElement;
const resultMessage = document.getElementById('result-message') as HTMLParagraphElement;

/**
 * スピンボタンがクリックされたときの処理
 */
function spin(): void {
	// スピン中はボタンを無効化
	spinButton.disabled = true;
	resultMessage.textContent = 'スピン中...';

	const results: string[] = [];
	reels.forEach((reel) => {
		// ランダムにシンボルを選択
		const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
		reel.textContent = randomSymbol;
		results.push(randomSymbol);
	});

	// 結果をチェック
	checkWin(results);

	// 少し待ってからボタンを再度有効化
	setTimeout(() => {
		spinButton.disabled = false;
	}, 500); // 0.5秒
}

/**
 * 当たりかどうかを判定する
 * @param results - 3つのリールの結果の配列
 */
function checkWin(results: string[]): void {
	// 3つのシンボルがすべて同じであれば当たり
	if (results[0] === results[1] && results[1] === results[2]) {
		resultMessage.textContent = `大当たり！ ${results[0]} が揃いました！`;
	} else {
		resultMessage.textContent = '残念！もう一度挑戦！';
	}
}

// スピンボタンにクリックイベントリスナーを追加
spinButton.addEventListener('click', spin);

export { };