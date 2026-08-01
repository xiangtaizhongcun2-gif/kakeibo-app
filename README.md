# My家計簿

iPhoneのSafariからホーム画面へ追加して使う、自分専用の家計簿PWAです。現在は **Phase 2（IndexedDB保存基盤）** まで実装しています。

## Phase 1で実装済み

- React + TypeScript + Vite
- TypeScript strict mode
- iPhone優先のレスポンシブレイアウト
- ホーム / 収支一覧 / 登録 / 予算 / 設定の下部タブ
- ライトモード・ダークモード自動追従
- Safe Area対応
- PWA manifest / Service Worker / オフライン用アプリシェル
- アプリ更新通知
- GitHub Pagesのサブパス対応
- GitHub Actionsによるテスト・ビルド・自動デプロイ
- Vitest + React Testing Library
- React移行前のLocalStorageデータを確認・書き出しできる旧版互換画面

## Phase 2で実装済み

- Dexieを使用した端末内IndexedDB
- 収入・支出を分離した型安全なTransaction union
- 1円単位の整数金額、`YYYY-MM-DD`の日付、UTC ISO 8601の日時
- 支出カテゴリ、収入カテゴリ、支払い方法の初期データ
- 削除不可のシステム支払い方法「未設定」
- 収支・カテゴリ・支払い方法・予算・通知状態・設定・アプリ情報のテーブル
- データバージョンと将来のマイグレーションに対応する初期化処理
- 収支の作成・更新・削除と使用回数を同一トランザクションで更新するRepository
- 使用中の支払い方法を削除すると、過去の支出を「未設定」へ置換する処理
- fake-indexeddbを使った保存層の自動テスト

収支登録画面、収支一覧の実データ表示、集計、予算計算、通知、CSV、PDF、バックアップは後続フェーズで実装します。

## 初期マスターデータ

### 支出カテゴリ

- 食費
- 日用品
- 交通費
- 固定費
- 娯楽費

### 収入カテゴリ

- 給与
- 仕送り
- 臨時収入
- その他

### 支払い方法

- 未設定（システム管理・削除不可）
- 現金
- クレジットカード
- 電子マネー
- 銀行振込

## 必要環境

- Node.js 22.13以上
- npm 10以上
- iPhoneで利用する場合はSafari

## ローカル開発

```bash
npm install
npm run dev
```

表示されたローカルURLをブラウザで開いてください。

## 品質確認

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

本番ビルドの確認：

```bash
npm run preview
```

## IndexedDBの手動確認

1. `npm run dev`または`npm run preview`でアプリを開きます。
2. ブラウザの開発者ツールを開きます。
3. **Application > Storage > IndexedDB** を開きます。
4. `my-kakeibo`データベースが作成されていることを確認します。
5. `expenseCategories`、`incomeCategories`、`paymentMethods`、`appMetadata`などのテーブルを確認します。
6. ページを再読み込みしても、初期データが重複しないことを確認します。
7. 設定画面の保存方式が「IndexedDB（この端末）」になっていることを確認します。

SafariではMacのSafariからiPhoneをWebインスペクタで接続するか、同じコードをPCブラウザで開いて保存構造を確認してください。

## GitHub Pages

1. リポジトリの **Settings > Pages** を開きます。
2. **Build and deployment > Source** を **GitHub Actions** に設定します。
3. `main`ブランチへpushすると`.github/workflows/deploy-pages.yml`が実行されます。
4. lint、型検査、テスト、ビルドのどれかが失敗した場合は公開されません。

Viteの`base`、manifestの`start_url`と`scope`は、GitHub Actions上で`GITHUB_REPOSITORY`からリポジトリ名を取得して設定します。

## iPhoneのホーム画面へ追加

1. GitHub PagesのURLをSafariで開きます。
2. 共有ボタンをタップします。
3. **ホーム画面に追加**を選択します。
4. 名前を確認して**追加**をタップします。

初回アクセスより前、またはService Workerのキャッシュが作成される前は、オフラインで起動できません。

## 旧版データへのアクセス

React移行前の家計簿は、同じオリジンのLocalStorageに`kurashi-kakeibo-v1`として記録していました。Phase 2では、この旧版データを自動削除・自動変換しません。

新しいアプリの **設定 > 旧版データ > 旧版の家計簿を開く** から互換画面を開き、以前の記録を確認したりJSONとして書き出したりできます。旧版データのIndexedDBへの取り込みは、検証と復元手順を含めて別フェーズで実装するまで行いません。

## データ保存とプライバシー

新しい家計簿データの保存先は、iPhoneまたはブラウザ内のIndexedDBです。収支データをGitHubリポジトリや外部サーバーへ保存・送信しません。

公開リポジトリに含まれるのはアプリのソースコードと静的アセットだけです。ユーザーが入力する家計簿データは含まれません。

ブラウザのWebサイトデータを削除した場合、端末内の家計簿データも失われる可能性があります。Phase 6で実装するバックアップを定期的に作成することが重要です。
