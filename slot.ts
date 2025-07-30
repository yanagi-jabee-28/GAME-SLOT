let slotSymbols = ["🍒", "🍋", "🍊", "🍇", "🍉", "⭐"]; // スロットの絵柄

// getRandomSymbol function (single implementation)
function getRandomSymbol(): string {
	return slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
}

function spinSlot(): string[] {
	return [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
}

function checkWin(symbols: string[]): string {
	if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
		return "🎉 大当たり！";
	} else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
		return "😊 あたり！";
	} else {
		return "😢 はずれ...";
	}
}

window.onload = () => {
	const slotDiv = document.getElementById("slot")!;
	const spinBtn = document.getElementById("spin")!;
	const resultDiv = document.getElementById("result")!;

	spinBtn.onclick = () => {
		slotDiv.classList.add("spinning");
		resultDiv.textContent = "";

		setTimeout(() => {
			const symbols = spinSlot();
			slotDiv.innerHTML = symbols.map(s => `<span>${s}</span>`).join("");
			resultDiv.textContent = checkWin(symbols);
			slotDiv.classList.remove("spinning");
		}, 1000); // 1秒後に結果表示
	};
};

export { };
