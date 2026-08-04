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

export type CategoryMoveDirection = 'up' | 'down';

type OrderedMasterItem = ExpenseCategory | IncomeCategory | PaymentMethod;

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) throw new Error('名前を入力してください。');
  return normalized;
}

function sortOrderedItems<T extends OrderedMasterItem>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftOrder = left.sortOrder;
    const rightOrder = right.sortOrder;

    if (leftOrder !== undefined && rightOrder !== undefined && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined && rightOrder === undefined) return -1;
    if (leftOrder === undefined && rightOrder !== undefined) return 1;
    return left.name.localeCompare(right.name, 'ja');
  });
}

function nextSortOrder(items: OrderedMasterItem[]): number {
  return items.reduce(
    (maximum, item, index) => Math.max(maximum, item.sortOrder ?? index),
    -1,
  ) + 1;
}

function moveOrderedItem<T extends OrderedMasterItem>(
  items: T[],
  id: string,
  direction: CategoryMoveDirection,
  notFoundMessage: string,
): T[] | null {
  const currentIndex = items.findIndex((item) => item.id === id);
  if (currentIndex < 0) throw new Error(notFoundMessage);

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return null;

  const next = [...items];
  const currentItem = next[currentIndex];
  const targetItem = next[targetIndex];
  if (currentItem === undefined || targetItem === undefined) {
    throw new Error('順番を変更できませんでした。');
  }
  next[currentIndex] = targetItem;
  next[targetIndex] = currentItem;
  return next;
}

export class MasterDataRepository {
  constructor(private readonly database: MyKakeiboDatabase = appDatabase) {}

  async listExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
    const categories = await this.database.expenseCategories.toArray();
    return sortOrderedItems(
      categories.filter((category) => includeInactive || category.isActive),
    );
  }

  async listIncomeCategories(includeInactive = false): Promise<IncomeCategory[]> {
    const categories = await this.database.incomeCategories.toArray();
    return sortOrderedItems(
      categories.filter((category) => includeInactive || category.isActive),
    );
  }

  async listPaymentMethods(includeInactive = false): Promise<PaymentMethod[]> {
    const paymentMethods = (await this.database.paymentMethods.toArray()).filter(
      (paymentMethod) => includeInactive || paymentMethod.isActive,
    );
    const systemMethods = paymentMethods
      .filter((paymentMethod) => paymentMethod.isSystem)
      .sort((left, right) => left.name.localeCompare(right.name, 'ja'));
    const userMethods = sortOrderedItems(
      paymentMethods.filter((paymentMethod) => !paymentMethod.isSystem),
    );
    return [...systemMethods, ...userMethods];
  }

  async createExpenseCategory(name: string): Promise<ExpenseCategory> {
    const normalizedName = normalizeName(name);
    const existingCategories = await this.listExpenseCategories(true);
    const now = currentUtcIsoDateTime();
    const category: ExpenseCategory = {
      id: createEntityId(),
      name: normalizedName,
      usageCount: 0,
      isActive: true,
      isSystem: false,
      sortOrder: nextSortOrder(existingCategories),
      createdAt: now,
      updatedAt: now,
    };
    await this.database.expenseCategories.add(category);
    return category;
  }

  async createIncomeCategory(name: string): Promise<IncomeCategory> {
    const normalizedName = normalizeName(name);
    const existingCategories = await this.listIncomeCategories(true);
    const now = currentUtcIsoDateTime();
    const category: IncomeCategory = {
      id: createEntityId(),
      name: normalizedName,
      usageCount: 0,
      isActive: true,
      isSystem: false,
      sortOrder: nextSortOrder(existingCategories),
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
    const existingPaymentMethods = (await this.listPaymentMethods(true)).filter(
      (paymentMethod) => !paymentMethod.isSystem,
    );
    const now = currentUtcIsoDateTime();
    const paymentMethod: PaymentMethod = {
      id: createEntityId(),
      name: normalizedName,
      kind,
      usageCount: 0,
      isActive: true,
      isSystem: false,
      sortOrder: nextSortOrder(existingPaymentMethods),
      createdAt: now,
      updatedAt: now,
    };
    await this.database.paymentMethods.add(paymentMethod);
    return paymentMethod;
  }

  async moveExpenseCategory(id: string, direction: CategoryMoveDirection): Promise<void> {
    const categories = await this.listExpenseCategories(true);
    const next = moveOrderedItem(
      categories,
      id,
      direction,
      '支出カテゴリが見つかりません。',
    );
    if (next === null) return;

    const now = currentUtcIsoDateTime();
    await this.database.expenseCategories.bulkPut(
      next.map((category, index) => ({
        ...category,
        sortOrder: index,
        updatedAt: now,
      })),
    );
  }

  async moveIncomeCategory(id: string, direction: CategoryMoveDirection): Promise<void> {
    const categories = await this.listIncomeCategories(true);
    const next = moveOrderedItem(
      categories,
      id,
      direction,
      '収入カテゴリが見つかりません。',
    );
    if (next === null) return;

    const now = currentUtcIsoDateTime();
    await this.database.incomeCategories.bulkPut(
      next.map((category, index) => ({
        ...category,
        sortOrder: index,
        updatedAt: now,
      })),
    );
  }

  async movePaymentMethod(id: string, direction: CategoryMoveDirection): Promise<void> {
    const paymentMethods = (await this.listPaymentMethods(true)).filter(
      (paymentMethod) => !paymentMethod.isSystem,
    );
    const next = moveOrderedItem(
      paymentMethods,
      id,
      direction,
      '支払い方法が見つかりません。',
    );
    if (next === null) return;

    const now = currentUtcIsoDateTime();
    await this.database.paymentMethods.bulkPut(
      next.map((paymentMethod, index) => ({
        ...paymentMethod,
        sortOrder: index,
        updatedAt: now,
      })),
    );
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
