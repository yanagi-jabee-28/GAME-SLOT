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

    def get_payout_info_for_line(self, line, bet):
        """
        1本のラインの結果に基づいて配当と当たり役の理由を返す
        :return: (配当, 理由テキスト) のタプル
        """
        if line[0] == line[1] == line[2]:
            symbol = line[0]
            return (bet * self.PAYOUTS.get(symbol, 0), f"{symbol} 3つ揃い")
        if line[0] == '🍒' and line[1] == '🍒':
            return (bet * 5, "左からチェリー2つ")
        return (0, None)


class SlotGUI:
    """
    tkinterを使ったスロットマシンのGUIクラス
    """

    def __init__(self, root):
        self.root = root
        self.root.title("スロットマシン")
        self.root.geometry("850x600")  # ウィンドウサイズを拡大
        self.root.resizable(False, False)
        self.root.configure(bg="#2E2E2E")  # 背景色をダークグレーに

        self.slot_machine = SlotMachine()
        self.coins = 100
        self.bet = 10

        # リールと状態の管理
        self.reel_strips = self.slot_machine.REEL_STRIPS
        # 各リールの現在の表示位置 (ランダムな位置から開始)
        self.reel_positions = [random.randint(
            0, len(s) - 1) for s in self.reel_strips]

        # 統計情報
        self.wins = 0
        self.losses = 0
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
        BG_COLOR = "#2E2E2E"
        FG_COLOR = "white"

        # スタイル設定
        style = ttk.Style()
        # 'clam'テーマは色のカスタマイズがしやすい
        style.theme_use('clam')
        style.configure(".", background=BG_COLOR, foreground=FG_COLOR)
        style.configure("TFrame", background=BG_COLOR)
        style.configure("TLabel", background=BG_COLOR,
                        foreground=FG_COLOR, font=("Helvetica", 16))
        style.configure("TButton", font=("Helvetica", 16, "bold"), padding=10)
        style.map("TButton", background=[('active', '#6E6E6E')])
        style.configure("TLabelFrame", background=BG_COLOR, borderwidth=1)
        style.configure("TLabelFrame.Label", background=BG_COLOR,
                        foreground=FG_COLOR, font=("Helvetica", 14, "bold"))
        style.configure("Win.TLabel", background=BG_COLOR,
                        foreground="#4CAF50", font=("Helvetica", 18, "bold"))
        style.configure("Loss.TLabel", background=BG_COLOR,
                        foreground="#F44336", font=("Helvetica", 18, "bold"))
        style.configure("Highlight.TFrame", background="gold")

        # --- メインレイアウトフレーム ---
        main_frame = ttk.Frame(self.root, padding=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        game_frame = ttk.Frame(main_frame)
        game_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))

        info_frame = ttk.Frame(main_frame, padding=10,
                               relief="solid", borderwidth=1)
        info_frame.pack(side=tk.RIGHT, fill=tk.Y)

        # 上部フレーム (コイン表示)
        top_frame = ttk.Frame(game_frame)
        top_frame.pack(fill="x")
        self.coin_label = ttk.Label(top_frame, text="コイン: 100")
        self.coin_label.pack()

        # 中央フレーム (リール)
        reel_frame = ttk.Frame(game_frame, padding=(0, 10))
        reel_frame.pack()
        # 3x3のラベルを格納する2次元リスト
        self.reel_labels = []
        for row in range(3):
            row_labels = []
            for col in range(3):
                cell_frame = ttk.Frame(reel_frame, width=110, height=110)
                cell_frame.grid(row=row, column=col, padx=5, pady=5)
                cell_frame.pack_propagate(False)

                # ttk.Labelでは絵文字の色がテーマの色で上書きされてしまうため、標準のtk.Labelを使用する
                label = tk.Label(cell_frame, image=self.pixel_image,
                                 text="?", font=("Arial", 50),
                                 bg="#1C1C1C", fg="white",  # 背景を濃いグレー、文字を白に
                                 compound="center")
                label.pack(expand=True)
                row_labels.append(label)
            self.reel_labels.append(row_labels)

        # 下部フレーム (ボタンとメッセージ)
        bottom_frame = ttk.Frame(game_frame)
        bottom_frame.pack(fill="x", pady=10)

        self.message_label = ttk.Label(
            bottom_frame, text="エンターキーかボタンでスピン！", anchor="center")
        self.message_label.pack(pady=5)

        # ボタンのコマンドを統一的なハンドラに変更
        self.spin_button = ttk.Button(
            bottom_frame, text=f"{self.bet}コインでスピン", command=self.handle_button_press)
        self.spin_button.pack(pady=10)

        # Enterキーでもスピンできるようにする
        self.root.bind("<Return>", self.handle_button_press)

        # --- 情報表示フレーム (右側) ---
        # 統計情報
        stats_frame = ttk.LabelFrame(info_frame, text="統計", padding=10)
        stats_frame.pack(fill="x", pady=(0, 10))
        self.wins_label = ttk.Label(
            stats_frame, text="当たり: 0 回", font=("Helvetica", 14))
        self.wins_label.pack(anchor="w")
        self.losses_label = ttk.Label(
            stats_frame, text="はずれ: 0 回", font=("Helvetica", 14))
        self.losses_label.pack(anchor="w")

        # 当たり役
        payout_frame = ttk.LabelFrame(
            info_frame, text="当たり役 (3水平ライン有効)", padding=10)
        payout_frame.pack(fill="x")

        # 3つ揃いの役
        for symbol, multiplier in self.slot_machine.PAYOUTS.items():
            payout_text = f"{symbol} {symbol} {symbol} : {multiplier} 倍"
            ttk.Label(payout_frame, text=payout_text,
                      font=("Helvetica", 14)).pack(anchor="w")

        # その他の役
        ttk.Separator(payout_frame, orient='horizontal').pack(fill='x', pady=5)
        payout_text_2 = f"🍒 🍒 -- : 5 倍"
        ttk.Label(payout_frame, text=payout_text_2,
                  font=("Helvetica", 14)).pack(anchor="w")

        # スピンログ
        log_frame = ttk.LabelFrame(info_frame, text="スピンログ", padding=10)
        log_frame.pack(fill="both", expand=True, pady=(10, 0))
        self.log_text = tk.Text(
            log_frame, height=5, state="disabled", wrap="word", font=("Helvetica", 12),
            background="#1C1C1C", foreground="white", relief="flat", borderwidth=2,
            insertbackground="white")
        log_scroll = ttk.Scrollbar(
            log_frame, orient="vertical", command=self.log_text.yview)
        self.log_text.config(yscrollcommand=log_scroll.set)
        log_scroll.pack(side="right", fill="y")
        self.log_text.pack(side="left", fill="both", expand=True)

    def update_display(self):
        """コイン数や統計情報を更新する"""
        self.coin_label.config(text=f"コイン: {self.coins}")
        self.wins_label.config(text=f"当たり: {self.wins} 回")
        self.losses_label.config(text=f"はずれ: {self.losses} 回")

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

        self.clear_highlights()
        self.is_spinning = True
        self.reels_stopped = [False, False, False]
        self.coins -= self.bet
        self.update_display()

        self.spin_button.config(text="ストップ")
        self.message_label.config(text="リール回転中...", style="TLabel")

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
            # 80msごとに更新して、回転速度を少し落とす
            self.animation_id = self.root.after(80, self.animate_reels)

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

    def clear_highlights(self):
        """全セルのハイライトを解除する"""
        for row in range(3):
            for col in range(3):
                cell_frame = self.reel_labels[row][col].master
                cell_frame.config(style="TFrame")

    def highlight_winning_lines(self, winning_line_indices):
        """当たったラインのセルの背景色を変更する"""
        for line_index in winning_line_indices:
            for col in range(3):
                cell_frame = self.reel_labels[line_index][col].master
                # "Highlight.TFrame" スタイルを適用
                cell_frame.config(style="Highlight.TFrame")

    def finish_spin(self):
        """スピン終了後の処理"""
        # 3本の水平ラインのシンボルを構築
        lines_to_check = []
        for row in range(3):
            line = []
            for col in range(3):
                final_index = self.final_indices[col]
                strip = self.reel_strips[col]
                symbol_index = (final_index + row - 1) % len(strip)
                line.append(strip[symbol_index])
            lines_to_check.append(line)

        # 各ラインの配当を計算し、合計する
        self.log_message("--- スピン終了 ---")
        total_payout = 0
        winning_line_indices = []
        for i, line in enumerate(lines_to_check):
            payout, reason = self.slot_machine.get_payout_info_for_line(
                line, self.bet)
            if payout > 0:
                total_payout += payout
                winning_line_indices.append(i)
                line_name = {0: "上段", 1: "中段", 2: "下段"}[i]
                line_str = " ".join(line)
                log_msg = f"- {line_name}: {line_str} ({reason}) -> {payout}コイン"
                self.log_message(log_msg)

        self.highlight_winning_lines(winning_line_indices)

        if total_payout > 0:
            self.log_message(f"合計: {total_payout}コイン獲得")
            self.message_label.config(
                text=f"🎉 当たり！ {total_payout}コイン獲得！ 🎉", style="Win.TLabel")
            self.coins += total_payout
            self.wins += 1
        else:
            self.log_message("結果: はずれ")
            self.message_label.config(text="残念、はずれです。", style="Loss.TLabel")
            self.losses += 1

        self.update_display()
        # ボタンをスピン状態に戻す
        self.spin_button.config(text=f"{self.bet}コインでスピン")

    def log_message(self, message):
        """スピンログにメッセージを追記する"""
        self.log_text.config(state="normal")
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)  # 自動で一番下までスクロール
        self.log_text.config(state="disabled")


def main():
    """
    GUIアプリケーションを起動する
    """
    root = tk.Tk()
    app = SlotGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
