import { describe, expect, it } from 'vitest';
import { resolveBasePath } from './basePath';

describe('resolveBasePath', () => {
  it('ローカル開発ではルートを使う', () => {
    expect(resolveBasePath({})).toBe('/');
  });

  it('GitHub Actionsではリポジトリ名をサブパスに使う', () => {
    expect(resolveBasePath({ githubActions: 'true', repository: 'owner/kakeibo-app' })).toBe('/kakeibo-app/');
  });
});
