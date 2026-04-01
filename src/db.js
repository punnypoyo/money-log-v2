import Dexie from 'dexie';

export const db = new Dexie('MoneyLogDB');

db.version(1).stores({
  transactions: '++id, date, amount, type, categoryId, accountId, note', // type: 'income' | 'expense' | 'refund'
  categories: '++id, name, type, icon, color',
  accounts: '++id, name, type, parentCardId, limit, color' // type: 'cash' | 'bank' | 'credit'
});

export async function initDb() {
  const accountCount = await db.accounts.count();
  if (accountCount === 0) {
    // Default accounts
    await db.accounts.bulkAdd([
      { name: 'Cash', type: 'cash', color: '#10b981' },
      { name: 'Mobile Bank (Main)', type: 'bank', color: '#3b82f6' }
    ]);
  }

  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    // Default categories based on the prompt's examples (e.g. food_and_drink, groceries, housing, etc.)
    await db.categories.bulkAdd([
      { name: 'Food & Drink', type: 'expense', icon: 'pizza', color: '#f59e0b' },
      { name: 'Groceries', type: 'expense', icon: 'shopping-cart', color: '#ec4899' },
      { name: 'Housing', type: 'expense', icon: 'house', color: '#6366f1' },
      { name: 'Utilities', type: 'expense', icon: 'lightning', color: '#8b5cf6' },
      { name: 'Other', type: 'expense', icon: 'dots-three-circle', color: '#64748b' },
      { name: 'Refund', type: 'income', icon: 'arrow-u-down-left', color: '#14b8a6' },
      { name: 'Salary', type: 'income', icon: 'briefcase', color: '#10b981' }
    ]);
  }
}
