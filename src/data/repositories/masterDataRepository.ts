import type {
  ExpenseCategory,
  IncomeCategory,
  PaymentMethod,
  PaymentMethodKind,
  Transaction,
} from '../../domain/models';
import { createEntityId, currentUtcIsoDateTime } from '../../domain/valueObjects';
import { appDatabase, type MyKakeiboDatabase } from '../database';
import { SYSTEM_UNSET_PAYMENT_METHOD_ID } from '../initialData';

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) throw new Error('名前を入力してください。');
  return normalized;
}

export class MasterDataRepository {
  constructor(private readonly database: MyKakeiboDatabase = appDatabase) {}

  async listExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
    const categories = await this.database.expenseCategories.toArray();
    return categories
      .filter((category) => includeInactive || category.isActive)
      .sort((left, right) => left.name.localeCompare(right.name, 'ja'));
  }

  async listIncomeCategories(includeInactive = false): Promise<IncomeCategory[]> {
    const categories = await this.database.incomeCategories.toArray();
    return categories
      .filter((category) => includeInactive || category.isActive)
      .sort((left, right) => left.name.localeCompare(right.name, 'ja'));
  }

  async listPaymentMethods(includeInactive = false): Promise<PaymentMethod[]> {
    const paymentMethods = await this.database.paymentMethods.toArray();
    return paymentMethods
      .filter((paymentMethod) => includeInactive || paymentMethod.isActive)
      .sort((left, right) => {
        if (left.isSystem !== right.isSystem) return left.isSystem ? -1 : 1;
        return left.name.localeCompare(right.name, 'ja');
      });
  }

  async createExpenseCategory(name: string): Promise<ExpenseCategory> {
    const normalizedName = normalizeName(name);
    const now = currentUtcIsoDateTime();
    const category: ExpenseCategory = {
      id: createEntityId(),
      name: normalizedName,
      usageCount: 0,
      isActive: true,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.database.expenseCategories.add(category);
    return category;
  }

  async createIncomeCategory(name: string): Promise<IncomeCategory> {
    const normalizedName = normalizeName(name);
    const now = currentUtcIsoDateTime();
    const category: IncomeCategory = {
      id: createEntityId(),
      name: normalizedName,
      usageCount: 0,
      isActive: true,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.database.incomeCategories.add(category);
    return category;
  }

  async createPaymentMethod(
    name: string,
    kind: Exclude<PaymentMethodKind, 'system-unset'> = 'other',
  ): Promise<PaymentMethod> {
    const normalizedName = normalizeName(name);
    const now = currentUtcIsoDateTime();
    const paymentMethod: PaymentMethod = {
      id: createEntityId(),
      name: normalizedName,
      kind,
      usageCount: 0,
      isActive: true,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.database.paymentMethods.add(paymentMethod);
    return paymentMethod;
  }

  async setExpenseCategoryActive(id: string, isActive: boolean): Promise<void> {
    const category = await this.database.expenseCategories.get(id);
    if (category === undefined) throw new Error('支出カテゴリが見つかりません。');
    if (category.isSystem) throw new Error('システム管理のカテゴリは変更できません。');
    await this.database.expenseCategories.update(id, {
      isActive,
      updatedAt: currentUtcIsoDateTime(),
    });
  }

  async setIncomeCategoryActive(id: string, isActive: boolean): Promise<void> {
    const category = await this.database.incomeCategories.get(id);
    if (category === undefined) throw new Error('収入カテゴリが見つかりません。');
    if (category.isSystem) throw new Error('システム管理のカテゴリは変更できません。');
    await this.database.incomeCategories.update(id, {
      isActive,
      updatedAt: currentUtcIsoDateTime(),
    });
  }

  async archiveExpenseCategory(id: string): Promise<void> {
    await this.setExpenseCategoryActive(id, false);
  }

  async archiveIncomeCategory(id: string): Promise<void> {
    await this.setIncomeCategoryActive(id, false);
  }

  async deletePaymentMethod(id: string): Promise<number> {
    const now = currentUtcIsoDateTime();

    return this.database.transaction(
      'rw',
      this.database.transactions,
      this.database.paymentMethods,
      async () => {
        const paymentMethod = await this.database.paymentMethods.get(id);
        if (paymentMethod === undefined) throw new Error('支払い方法が見つかりません。');
        if (paymentMethod.isSystem) {
          throw new Error('システム管理の支払い方法は削除できません。');
        }

        const unsetPaymentMethod = await this.database.paymentMethods.get(
          SYSTEM_UNSET_PAYMENT_METHOD_ID,
        );
        if (unsetPaymentMethod === undefined) {
          throw new Error('システム管理の「未設定」が見つかりません。');
        }

        const referencedTransactions = await this.database.transactions
          .where('paymentMethodId')
          .equals(id)
          .toArray();
        const expenses = referencedTransactions.filter(
          (transaction): transaction is Extract<Transaction, { type: 'expense' }> =>
            transaction.type === 'expense',
        );

        if (expenses.length > 0) {
          await this.database.transactions.bulkPut(
            expenses.map((transaction) => ({
              ...transaction,
              paymentMethodId: SYSTEM_UNSET_PAYMENT_METHOD_ID,
              updatedAt: now,
            })),
          );
          await this.database.paymentMethods.update(SYSTEM_UNSET_PAYMENT_METHOD_ID, {
            usageCount: unsetPaymentMethod.usageCount + expenses.length,
            updatedAt: now,
          });
        }

        await this.database.paymentMethods.delete(id);
        return expenses.length;
      },
    );
  }
}
