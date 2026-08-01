# My家計簿

iPhoneのSafariからホーム画面へ追加して使う、自分専用の家計簿PWAです。現在は **Phase 1（基盤）** まで実装しています。

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

収支登録、IndexedDB、集計、予算、通知、CSV、PDF、バックアップは後続フェーズで実装します。

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

## GitHub Pages

1. リポジトリの **Settings > Pages** を開きます。
2. **Build and deployment > Source** を **GitHub Actions** に設定します。
3. `main` ブランチへpushすると `.github/workflows/deploy-pages.yml` が実行されます。
4. lint、型検査、テスト、ビルドのどれかが失敗した場合は公開されません。

Viteの`base`、manifestの`start_url`と`scope`は、GitHub Actions上で`GITHUB_REPOSITORY`からリポジトリ名を取得して設定します。

## iPhoneのホーム画面へ追加

1. GitHub PagesのURLをSafariで開きます。
2. 共有ボタンをタップします。
3. **ホーム画面に追加**を選択します。
4. 名前を確認して**追加**をタップします。

初回アクセスより前、またはService Workerのキャッシュが作成される前は、オフラインで起動できません。

## 旧版データへのアクセス

React移行前の家計簿は、同じオリジンのLocalStorageに`kurashi-kakeibo-v1`として記録していました。Phase 1ではこのデータを自動削除・自動変換しません。

新しいアプリの **設定 > 旧版データ > 旧版の家計簿を開く** から互換画面を開き、以前の記録を確認したりJSONとして書き出したりできます。Phase 2以降でIndexedDBへの安全な移行方法を設計するまでは、旧版データを残してください。

## データ保存とプライバシー

家計簿データは後続フェーズでiPhoneのブラウザ内にあるIndexedDBへ保存します。収支データをGitHubリポジトリや外部サーバーへ保存・送信しない設計です。

公開リポジトリに含まれるのはアプリのソースコードと静的アセットだけです。ユーザーが入力する家計簿データは含まれません。

ブラウザのWebサイトデータを削除した場合、端末内の家計簿データも失われる可能性があります。Phase 6で実装するバックアップを定期的に作成することが重要です。
