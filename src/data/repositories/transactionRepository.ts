import type {
  ExpenseTransaction,
  IncomeTransaction,
  MonthKey,
  Transaction,
  UtcIsoDateTime,
} from '../../domain/models';
import {
  assertNonNegativeInteger,
  createEntityId,
  currentUtcIsoDateTime,
  toLocalDate,
  toMonthKey,
  toPositiveMoneyYen,
} from '../../domain/valueObjects';
import { appDatabase, type MyKakeiboDatabase } from '../database';
import { recalculateMonthlyBudgets } from './budgetRepository';

export type NewExpenseTransaction = Omit<ExpenseTransaction, 'id' | 'createdAt' | 'updatedAt'>;
export type NewIncomeTransaction = Omit<IncomeTransaction, 'id' | 'createdAt' | 'updatedAt'>;
export type NewTransaction = NewExpenseTransaction | NewIncomeTransaction;

function validateInput(input: NewTransaction): void {
  toPositiveMoneyYen(input.amountYen);
  toLocalDate(input.date);
}

export class TransactionRepository {
  constructor(private readonly database: MyKakeiboDatabase = appDatabase) {}

  async listAll(): Promise<Transaction[]> {
    const transactions = await this.database.transactions.toArray();
    return transactions.sort(
      (left, right) =>
        right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt),
    );
  }

  async listByMonth(monthKey: MonthKey): Promise<Transaction[]> {
    const validMonthKey = toMonthKey(monthKey);
    const transactions = await this.database.transactions
      .where('date')
      .between(`${validMonthKey}-01`, `${validMonthKey}-31`, true, true)
      .toArray();

    return transactions.sort(
      (left, right) =>
        right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt),
    );
  }

  async getById(id: string): Promise<Transaction | undefined> {
    return this.database.transactions.get(id);
  }

  async create(input: NewTransaction): Promise<Transaction> {
    validateInput(input);
    const now = currentUtcIsoDateTime();
    const transaction = this.toStoredTransaction(input, createEntityId(), now, now);

    await this.database.transaction(
      'rw',
      [
        this.database.transactions,
        this.database.expenseCategories,
        this.database.incomeCategories,
        this.database.paymentMethods,
        this.database.monthlyBudgets,
        this.database.budgetSettings,
      ],
      async () => {
        await this.assertReferencesAreUsable(transaction);
        await this.database.transactions.add(transaction);
        await this.changeUsageCounts(transaction, 1, now);
        if (transaction.type === 'expense') {
          await recalculateMonthlyBudgets(this.database, now);
        }
      },
    );

    return transaction;
  }

  async replace(id: string, input: NewTransaction): Promise<Transaction> {
    validateInput(input);
    const now = currentUtcIsoDateTime();

    return this.database.transaction(
      'rw',
      [
        this.database.transactions,
        this.database.expenseCategories,
        this.database.incomeCategories,
        this.database.paymentMethods,
        this.database.monthlyBudgets,
        this.database.budgetSettings,
      ],
      async () => {
        const existing = await this.database.transactions.get(id);
        if (existing === undefined) throw new Error('更新対象の収支が見つかりません。');

        const replacement = this.toStoredTransaction(input, id, existing.createdAt, now);
        await this.assertReferencesAreUsable(replacement);
        await this.changeUsageCounts(existing, -1, now);
        await this.database.transactions.put(replacement);
        await this.changeUsageCounts(replacement, 1, now);
        if (existing.type === 'expense' || replacement.type === 'expense') {
          await recalculateMonthlyBudgets(this.database, now);
        }
        return replacement;
      },
    );
  }

  async delete(id: string): Promise<boolean> {
    const now = currentUtcIsoDateTime();

    return this.database.transaction(
      'rw',
      [
        this.database.transactions,
        this.database.expenseCategories,
        this.database.incomeCategories,
        this.database.paymentMethods,
        this.database.monthlyBudgets,
        this.database.budgetSettings,
      ],
      async () => {
        const existing = await this.database.transactions.get(id);
        if (existing === undefined) return false;

        await this.database.transactions.delete(id);
        await this.changeUsageCounts(existing, -1, now);
        if (existing.type === 'expense') {
          await recalculateMonthlyBudgets(this.database, now);
        }
        return true;
      },
    );
  }

  private toStoredTransaction(
    input: NewTransaction,
    id: string,
    createdAt: UtcIsoDateTime,
    updatedAt: UtcIsoDateTime,
  ): Transaction {
    if (input.type === 'expense') return { ...input, id, createdAt, updatedAt };
    return { ...input, id, createdAt, updatedAt };
  }

  private async assertReferencesAreUsable(transaction: Transaction): Promise<void> {
    if (transaction.type === 'expense') {
      const [category, paymentMethod] = await Promise.all([
        this.database.expenseCategories.get(transaction.expenseCategoryId),
        this.database.paymentMethods.get(transaction.paymentMethodId),
      ]);

      if (category === undefined || !category.isActive) {
        throw new Error('利用できる支出カテゴリを指定してください。');
      }
      if (paymentMethod === undefined || !paymentMethod.isActive) {
        throw new Error('利用できる支払い方法を指定してください。');
      }
      return;
    }

    const category = await this.database.incomeCategories.get(transaction.incomeCategoryId);
    if (category === undefined || !category.isActive) {
      throw new Error('利用できる収入カテゴリを指定してください。');
    }
  }

  private async changeUsageCounts(
    transaction: Transaction,
    delta: 1 | -1,
    updatedAt: UtcIsoDateTime,
  ): Promise<void> {
    if (transaction.type === 'expense') {
      const category = await this.database.expenseCategories.get(transaction.expenseCategoryId);
      const paymentMethod = await this.database.paymentMethods.get(transaction.paymentMethodId);
      if (category === undefined || paymentMethod === undefined) {
        throw new Error('収支が参照しているマスターデータが見つかりません。');
      }

      const categoryUsageCount = category.usageCount + delta;
      const paymentUsageCount = paymentMethod.usageCount + delta;
      assertNonNegativeInteger(categoryUsageCount, '支出カテゴリの使用回数');
      assertNonNegativeInteger(paymentUsageCount, '支払い方法の使用回数');

      await this.database.expenseCategories.update(category.id, {
        usageCount: categoryUsageCount,
        updatedAt,
      });
      await this.database.paymentMethods.update(paymentMethod.id, {
        usageCount: paymentUsageCount,
        updatedAt,
      });
      return;
    }

    const category = await this.database.incomeCategories.get(transaction.incomeCategoryId);
    if (category === undefined) {
      throw new Error('収支が参照している収入カテゴリが見つかりません。');
    }

    const usageCount = category.usageCount + delta;
    assertNonNegativeInteger(usageCount, '収入カテゴリの使用回数');
    await this.database.incomeCategories.update(category.id, { usageCount, updatedAt });
  }
}
