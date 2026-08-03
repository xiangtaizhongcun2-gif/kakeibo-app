import { afterEach, describe, expect, it } from 'vitest';
import { MyKakeiboDatabase } from '../database';
import { initializeDatabase } from '../initializeDatabase';
import { SavingsRepository } from './savingsRepository';

const databases: MyKakeiboDatabase[] = [];

function createDatabase(): MyKakeiboDatabase {
  const database = new MyKakeiboDatabase(`savings-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (database) => {
      database.close();
      await database.delete();
    }),
  );
});

describe('SavingsRepository', () => {
  it('初期状態は残高0円・目標未設定', async () => {
    const database = createDatabase();
    await initializeDatabase(database);
    const repository = new SavingsRepository(database);

    await expect(repository.getSettings()).resolves.toMatchObject({
      id: 'savings-settings',
      balanceYen: 0,
      goalName: '',
      goalAmountYen: null,
    });
  });

  it('現在残高と1件の目標を保存する', async () => {
    const database = createDatabase();
    await initializeDatabase(database);
    const repository = new SavingsRepository(database);

    await expect(
      repository.updateSettings({
        balanceYen: 50000,
        goalName: '  旅行資金  ',
        goalAmountYen: 100000,
      }),
    ).resolves.toMatchObject({
      balanceYen: 50000,
      goalName: '旅行資金',
      goalAmountYen: 100000,
    });
  });

  it('目標名と目標金額の片方だけは保存しない', async () => {
    const database = createDatabase();
    await initializeDatabase(database);
    const repository = new SavingsRepository(database);

    await expect(
      repository.updateSettings({
        balanceYen: 50000,
        goalName: '旅行資金',
        goalAmountYen: null,
      }),
    ).rejects.toThrow('目標金額');

    await expect(
      repository.updateSettings({
        balanceYen: 50000,
        goalName: '',
        goalAmountYen: 100000,
      }),
    ).rejects.toThrow('目標名');
  });

  it('目標だけを削除し、現在の貯金額は維持する', async () => {
    const database = createDatabase();
    await initializeDatabase(database);
    const repository = new SavingsRepository(database);
    await repository.updateSettings({
      balanceYen: 75000,
      goalName: '引越し資金',
      goalAmountYen: 200000,
    });

    await expect(repository.clearGoal()).resolves.toMatchObject({
      balanceYen: 75000,
      goalName: '',
      goalAmountYen: null,
    });
  });
});
