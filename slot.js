"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var slotSymbols = ["🍒", "🍋", "🍊", "🍇", "🍉", "⭐"]; // スロットの絵柄
// getRandomSymbol function (single implementation)
function getRandomSymbol() {
    return slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
}
function spinSlot() {
    return [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
}
function checkWin(symbols) {
    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        return "🎉 大当たり！";
    }
    else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
        return "😊 あたり！";
    }
    else {
        return "😢 はずれ...";
    }
}
window.onload = function () {
    var slotDiv = document.getElementById("slot");
    var spinBtn = document.getElementById("spin");
    var resultDiv = document.getElementById("result");
    spinBtn.onclick = function () {
        slotDiv.classList.add("spinning");
        resultDiv.textContent = "";
        setTimeout(function () {
            var symbols = spinSlot();
            slotDiv.innerHTML = symbols.map(function (s) { return "<span>".concat(s, "</span>"); }).join("");
            resultDiv.textContent = checkWin(symbols);
            slotDiv.classList.remove("spinning");
        }, 1000); // 1秒後に結果表示
    };
};
