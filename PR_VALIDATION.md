# PR前の検証ガイド

コードをPRする前に、以下のチェックを実行してください。

## クイックチェック

```bash
# 型チェックのみ（軽量・高速）
npm run lint:types

# またはビルド確認込み（推奨）
npm run verify
```

## 各コマンドの説明

| コマンド | 説明 | 実行時間 |
|---------|------|--------|
| `npm run lint:types` | TypeScript型チェックのみ | 数秒 |
| `npm run check` | TypeScript型チェック（同じ） | 数秒 |
| `npm run build` | フルビルドテスト | 10-30秒 |
| `npm run verify` | 型チェック + ビルド | 10-30秒 |

## PR前チェックリスト

### ✅ 必須

- [ ] `npm run verify` で型エラーなし
- [ ] 新規ファイルを追加した場合、型定義を確認
- [ ] インポートパスが正しいか確認
- [ ] 使用する型が定義されているか確認

### 📝 よくあるエラーパターン

**エラー：「型が存在しない」**
```
error TS2339: Property 'store_open_time' does not exist on type 'StoreSettings'.
```
→ `client/src/lib/booking-api.ts` の `StoreSettings` インターフェースを確認・修正

**エラー：「モジュールが見つからない」**
```
error TS2307: Cannot find module '@/components/ui/button'.
```
→ インポートパスまたはファイルの存在確認

**エラー：「関数に引数が不足」**
```
error TS2554: Expected 2 arguments, but got 1.
```
→ 関数のシグネチャを確認し、すべての必須引数を渡す

## 自動検証（Git Pre-commit Hook）

`.husky/pre-commit` が設定されており、コミット時に自動的に `npm run verify` が実行されます。

### フックを無視する場合
```bash
git commit --no-verify
```
⚠️ ※ 非推奨。問題がある場合は修正が優先です。

## トラブルシューティング

### `npm run verify` が失敗する

1. **キャッシュをクリア**
   ```bash
   rm -r dist node_modules/.vite
   npm run verify
   ```

2. **TypeScript をリセット**
   ```bash
   rm -r node_modules/typescript
   npm install
   npm run verify
   ```

3. **詳細なエラー情報**
   ```bash
   npm run lint:types -- --listFiles
   ```

## まとめ

**ローカル環境が動かない場合でも、PR前に実行：**
```bash
npm run verify
```

