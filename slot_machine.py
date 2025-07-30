import random
import tkinter as tk
from tkinter import ttk, PhotoImage
import os


class SlotMachine:
    """
    スロットマシンのロジックを管理するクラス
    """
    # 各リールのシンボルの並び順（リールストリップ）を定義
    REEL_STRIPS = [
        ["７", "🔔", "🍊", "🍒", "⭐", "🍋", "🍒", "🔔", "🍒",
            "🍊", "🍒", "🍋"],  # Reel 1 (12 symbols)
        ["🍒", "🍋", "７", "🍒", "🔔", "🍊", "🍒", "⭐", "🍋",
            "🍒", "🔔", "🍊"],  # Reel 2 (12 symbols)
        ["⭐", "🍒", "🍋", "🔔", "🍊", "🍒", "🍋", "７", "🍒",
            "🔔", "🍊", "🍒"]   # Reel 3 (12 symbols)
    ]
    # REEL_STRIPSから重複を除いたシンボルのリストを生成
    SYMBOLS = sorted(list(set(s for strip in REEL_STRIPS for s in strip)))
    PAYOUTS = {
        "７": 100,
        "⭐": 50,
        "🔔": 20,
        "🍋": 10,
        "🍊": 10,
        "🍒": 10,
    }

    def get_final_indices(self):
        """3つのリールの最終停止位置（インデックス）をランダムに返す"""
        return [random.randint(0, len(strip) - 1) for strip in self.REEL_STRIPS]

    def check_payout(self, result, bet):
        """
        結果に基づいて配当を計算する
        """
        if result[0] == result[1] == result[2]:
            symbol = result[0]
            return bet * self.PAYOUTS.get(symbol, 0)
        elif result.count("🍒") == 2:
            # チェリーが2つ揃った場合
            return bet * 2
        return 0


class SlotGUI:
    """
    tkinterを使ったスロットマシンのGUIクラス
    """

    def __init__(self, root):
        self.root = root
        self.root.title("スロットマシン")
        self.root.geometry("450x350")
        self.root.resizable(False, False)

        self.slot_machine = SlotMachine()
        self.coins = 100
        self.bet = 10

        # リールと状態の管理
        self.reel_strips = self.slot_machine.REEL_STRIPS
        # 各リールの現在の表示位置 (ランダムな位置から開始)
        self.reel_positions = [random.randint(
            0, len(s) - 1) for s in self.reel_strips]
        self.is_spinning = False
        self.final_indices = [0, 0, 0]
        self.reels_stopped = [False, False, False]
        self.animation_id = None

        # 画像の読み込み
        self.image_path = "images"  # 画像フォルダ名
        self.symbol_images = self._load_images()

        # ウィジェットのサイズを固定するための1x1ピクセルの透明画像
        self.pixel_image = tk.PhotoImage(width=1, height=1)

        self.create_widgets()
        self.update_display()

    def _load_images(self):
        """シンボルの画像を読み込む。なければNoneを格納。"""
        images = {}
        for symbol in self.slot_machine.SYMBOLS:
            # ファイル名はシンボル名に合わせてください (例: 🍒.png, ７.png)
            # Windowsでは絵文字ファイル名が扱いにくい場合、'cherry.png'のように別名にしてもOK
            filepath = os.path.join(self.image_path, f"{symbol}.png")
            try:
                images[symbol] = PhotoImage(
                    file=filepath).subsample(2, 2)  # サイズ調整
            except tk.TclError:
                images[symbol] = None  # ファイルが見つからない場合
        return images

    def create_widgets(self):
        """GUIのウィジェットを作成・配置する"""
        # スタイル設定
        style = ttk.Style()
        style.configure("TLabel", font=("Helvetica", 14))
        style.configure("TButton", font=("Helvetica", 14))

        # 上部フレーム (コイン表示)
        top_frame = ttk.Frame(self.root, padding=10)
        top_frame.pack(fill="x")
        self.coin_label = ttk.Label(top_frame, text="コイン: 100")
        self.coin_label.pack()

        # 中央フレーム (リール)
        reel_frame = ttk.Frame(self.root, padding=10)
        reel_frame.pack()
        # 3x3のラベルを格納する2次元リスト
        self.reel_labels = []
        for row in range(3):
            row_labels = []
            for col in range(3):
                # セルのサイズを固定するためのフレームを作成
                cell_frame = ttk.Frame(reel_frame, width=90, height=90)
                cell_frame.grid(row=row, column=col, padx=5, pady=5)
                # フレームのサイズが中身のウィジェットによって変わらないように設定
                cell_frame.pack_propagate(False)

                # フレーム内にラベルを配置
                label = ttk.Label(cell_frame, image=self.pixel_image,
                                  text="?", font=("Arial", 40),
                                  relief="solid", padding=5, compound="center")
                label.pack(expand=True)
                row_labels.append(label)
            self.reel_labels.append(row_labels)

        # 下部フレーム (ボタンとメッセージ)
        bottom_frame = ttk.Frame(self.root, padding=10)
        bottom_frame.pack(fill="x")

        self.message_label = ttk.Label(
            bottom_frame, text="エンターキーかボタンでスピン！", anchor="center")
        self.message_label.pack(pady=5)

        # ボタンのコマンドを統一的なハンドラに変更
        self.spin_button = ttk.Button(
            bottom_frame, text=f"{self.bet}コインでスピン", command=self.handle_button_press)
        self.spin_button.pack(pady=10)

        # Enterキーでもスピンできるようにする
        self.root.bind("<Return>", self.handle_button_press)

    def update_display(self):
        """コイン数やメッセージを更新する"""
        self.coin_label.config(text=f"コイン: {self.coins}")

    def handle_button_press(self, event=None):
        """スピン/ストップボタンが押されたときの処理を振り分ける"""
        if not self.is_spinning:
            self.start_spin()
        else:
            self.stop_reel()

    def start_spin(self):
        """スピンを開始する"""
        if self.coins < self.bet:
            self.message_label.config(text="コインが足りません！")
            return

        self.is_spinning = True
        self.reels_stopped = [False, False, False]
        self.coins -= self.bet
        self.update_display()

        self.spin_button.config(text="ストップ")
        self.message_label.config(text="リール回転中...")

        # 最終的な停止位置と、それに対応するシンボルを決定
        self.final_indices = self.slot_machine.get_final_indices()
        self.final_result = [self.reel_strips[i]
                             [self.final_indices[i]] for i in range(3)]

        self.animate_reels()  # アニメーション開始

    def animate_reels(self):
        """3x3のグリッド全体をスクロールさせてアニメーションさせる"""
        for col in range(3):  # 各リール（列）について処理
            if not self.reels_stopped[col]:
                strip = self.reel_strips[col]
                # リール位置を1つ進める (末尾に来たら先頭に戻る)
                self.reel_positions[col] = (
                    self.reel_positions[col] + 1) % len(strip)

                for row in range(3):  # 各行の表示を更新
                    # 中央(row=1)が現在の位置。上(row=0)は-1、下(row=2)は+1
                    symbol_index = (
                        self.reel_positions[col] + row - 1) % len(strip)
                    symbol = strip[symbol_index]
                    self.set_reel_display(self.reel_labels[row][col], symbol)

        # is_spinningがTrueの間、アニメーションを継続
        if self.is_spinning:
            # 50msごとに更新して、より滑らかな回転に見せる
            self.animation_id = self.root.after(50, self.animate_reels)

    def stop_reel(self):
        """押された順にリールを1つ停止する"""
        try:
            # 次に停止するリールのインデックスを探す (停止していない最初のもの)
            reel_to_stop = self.reels_stopped.index(False)
            self.reels_stopped[reel_to_stop] = True

            # 停止したリールの列全体を最終結果で更新
            final_index = self.final_indices[reel_to_stop]
            strip = self.reel_strips[reel_to_stop]
            for row in range(3):
                symbol_index = (final_index + row - 1) % len(strip)
                symbol = strip[symbol_index]
                self.set_reel_display(
                    self.reel_labels[row][reel_to_stop], symbol)

            # 全てのリールが停止したかチェック
            if all(self.reels_stopped):
                self.is_spinning = False  # アニメーションループを止める
                if self.animation_id:
                    self.root.after_cancel(self.animation_id)
                    self.animation_id = None
                # 少し間を置いてから結果発表
                self.root.after(500, self.finish_spin)

        except ValueError:
            # すでに全てのリールが停止している場合は何もしない
            pass

    def set_reel_display(self, label, symbol):
        """リールの表示を画像またはテキストで設定する"""
        if self.symbol_images.get(symbol):
            label.config(image=self.symbol_images[symbol], text="")
        else:
            label.config(image="", text=symbol)  # 画像がない場合はテキスト表示

    def finish_spin(self):
        """スピン終了後の処理"""
        payout = self.slot_machine.check_payout(self.final_result, self.bet)
        if payout > 0:
            self.message_label.config(text=f"🎉 当たり！ {payout}コイン獲得！ 🎉")
            self.coins += payout
        else:
            self.message_label.config(text="残念、はずれです。")

        self.update_display()
        # ボタンをスピン状態に戻す
        self.spin_button.config(text=f"{self.bet}コインでスピン")


def main():
    """
    GUIアプリケーションを起動する
    """
    root = tk.Tk()
    app = SlotGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
