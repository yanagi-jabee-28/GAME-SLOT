const reels = document.querySelectorAll('.reel');
const resultDiv = document.getElementById('result');
const symbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐'];
const playerCoinsSpan = document.getElementById('player-coins');
const betAmountInput = document.getElementById('bet-amount');

let playerCoins = 100;
let isSpinning = false;
let spinningReels = [];
let reelResults = [];

function getRandomSymbol() {
	return symbols[Math.floor(Math.random() * symbols.length)];
}

function startSpinning() {
	if (isSpinning) return;

	const betAmount = parseInt(betAmountInput.value);
	if (playerCoins < betAmount) {
		resultDiv.textContent = "コインが足りません！";
		return;
	}

	playerCoins -= betAmount;
	updatePlayerCoins();

	isSpinning = true;
	reelResults = [];
	spinningReels = Array.from(reels);
	resultDiv.textContent = 'リールを止めてください';

	reels.forEach(reel => {
		reel.classList.add('spinning');
		const symbolContainer = document.createElement('div');
		symbolContainer.classList.add('symbol-container');
		reel.innerHTML = '';
		reel.appendChild(symbolContainer);

		const updateSymbol = () => {
			if (spinningReels.includes(reel)) {
				symbolContainer.textContent = getRandomSymbol();
				requestAnimationFrame(updateSymbol);
			}
		};
		updateSymbol();
	});
}

function stopReel() {
	if (!isSpinning || spinningReels.length === 0) return;

	const reelToStop = spinningReels.shift();
	reelToStop.classList.remove('spinning');
	const finalSymbol = getRandomSymbol();
	reelResults.push(finalSymbol);

	const symbolContainer = reelToStop.querySelector('.symbol-container');
	if (symbolContainer) {
		symbolContainer.textContent = finalSymbol;
	}

	if (spinningReels.length === 0) {
		isSpinning = false;
		checkWin();
	}
}

function checkWin() {
	const betAmount = parseInt(betAmountInput.value);
	let winMultiplier = 0;

	if (reelResults[0] === reelResults[1] && reelResults[1] === reelResults[2]) {
		winMultiplier = 10; // 大当たりの倍率
		resultDiv.textContent = `🎉 大当たり！ ${reelResults[0]} が揃いました！`;
	} else if (reelResults[0] === reelResults[1] || reelResults[1] === reelResults[2] || reelResults[0] === reelResults[2]) {
		winMultiplier = 2; // あたりの倍率
		resultDiv.textContent = '😊 あたり！';
	} else {
		resultDiv.textContent = '😢 はずれ... エンターで再挑戦';
	}

	if (winMultiplier > 0) {
		const winnings = betAmount * winMultiplier;
		playerCoins += winnings;
		resultDiv.textContent += ` (+${winnings}コイン)`;
		updatePlayerCoins();
	}
}

function updatePlayerCoins() {
	playerCoinsSpan.textContent = playerCoins;
}

document.addEventListener('keydown', (event) => {
	if (event.key === 'Enter') {
		if (!isSpinning) {
			startSpinning();
		} else {
			stopReel();
		}
	}
});

updatePlayerCoins();
