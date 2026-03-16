import { prisma } from "../lib/prisma";
import { ExpenseCategory } from "@prisma/client";

export interface CreateExpenseDto {
  description: string;
  amount: number;
  category: ExpenseCategory;
  paymentMethod: string; // paypal, contanti, p2p, bonifico
  date?: Date;
  notes?: string;
}

export interface UpdateExpenseDto {
  description?: string;
  amount?: number;
  category?: ExpenseCategory;
  paymentMethod?: string;
  date?: Date;
  notes?: string;
}

export interface ExpenseStats {
  totalAmount: number;
  totalCount: number;
  byCategory: {
    category: string;
    amount: number;
    count: number;
  }[];
}

export interface PaymentMethodBalance {
  method: string;
  income: number;      // Entrate (persone × 15€)
  expenses: number;    // Totale spese
  balance: number;     // income - expenses
  personCount: number; // Numero persone che hanno pagato con questo metodo
}

export interface BalancesReport {
  balances: PaymentMethodBalance[];
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
}

// Ottieni tutte le spese con opzione di filtro per categoria e intervallo date
export const fetchExpenses = async (eventId: string, categoryFilter?: string, startDate?: Date, endDate?: Date) => {
  const where: any = { eventId };

  if (categoryFilter && categoryFilter !== "ALL") {
    where.category = categoryFilter;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = startDate;
    if (endDate) where.date.lte = endDate;
  }

  return prisma.expense.findMany({
    where,
    orderBy: [
      { date: "desc" },
      { createdAt: "desc" },
    ],
  });
};

// Ottieni statistiche spese
export const fetchExpenseStats = async (eventId: string, startDate?: Date, endDate?: Date): Promise<ExpenseStats> => {
  const where: any = { eventId };

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = startDate;
    if (endDate) where.date.lte = endDate;
  }

  const expenses = await prisma.expense.findMany({ where });

  const totalAmount = expenses.reduce((sum: number, exp) => sum + exp.amount, 0);
  const totalCount = expenses.length;

  // Raggruppa per categoria
  const categoryMap = new Map<string, { amount: number; count: number }>();

  for (const exp of expenses) {
    const existing = categoryMap.get(exp.category) || { amount: 0, count: 0 };
    categoryMap.set(exp.category, {
      amount: existing.amount + exp.amount,
      count: existing.count + 1,
    });
  }

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount); // Ordina per importo decrescente

  return {
    totalAmount,
    totalCount,
    byCategory,
  };
};

// Calcola saldi per metodo di pagamento
export const fetchBalances = async (eventId: string): Promise<BalancesReport> => {
  const PRICE_PER_PERSON = 15;
  const PAYMENT_METHODS = ["paypal", "contanti", "p2p", "bonifico"];

  // Conta persone per metodo di pagamento (solo PAGANTI nell'evento)
  const invitees = await prisma.invitee.findMany({
    where: { eventId, listType: "PAGANTE" },
    select: { paymentType: true },
  });

  // Mappa: metodo → numero persone
  const personCountMap = new Map<string, number>();
  for (const method of PAYMENT_METHODS) {
    personCountMap.set(method, 0);
  }

  for (const inv of invitees) {
    const method = inv.paymentType?.toLowerCase();
    if (method && personCountMap.has(method)) {
      personCountMap.set(method, (personCountMap.get(method) || 0) + 1);
    }
  }

  // Conta spese per metodo di pagamento (nell'evento)
  const expenses = await prisma.expense.findMany({ where: { eventId } });
  const expensesByMethod = new Map<string, number>();
  for (const method of PAYMENT_METHODS) {
    expensesByMethod.set(method, 0);
  }

  for (const exp of expenses) {
    const method = exp.paymentMethod.toLowerCase();
    if (expensesByMethod.has(method)) {
      expensesByMethod.set(method, (expensesByMethod.get(method) || 0) + exp.amount);
    }
  }

  // Calcola saldi
  const balances: PaymentMethodBalance[] = [];
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const method of PAYMENT_METHODS) {
    const personCount = personCountMap.get(method) || 0;
    const income = personCount * PRICE_PER_PERSON;
    const expensesAmount = expensesByMethod.get(method) || 0;
    const balance = income - expensesAmount;

    balances.push({
      method,
      income,
      expenses: expensesAmount,
      balance,
      personCount,
    });

    totalIncome += income;
    totalExpenses += expensesAmount;
  }

  return {
    balances,
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
  };
};

// Crea nuova spesa
export const createExpense = async (data: CreateExpenseDto, eventId: string) => {
  return prisma.expense.create({
    data: {
      description: data.description.trim(),
      amount: data.amount,
      category: data.category,
      paymentMethod: data.paymentMethod.toLowerCase(),
      date: data.date || new Date(),
      notes: data.notes?.trim() || null,
      eventId,
    },
  });
};

// Aggiorna spesa esistente
export const updateExpense = async (id: string, data: UpdateExpenseDto) => {
  const updateData: any = {};

  if (data.description !== undefined) updateData.description = data.description.trim();
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod.toLowerCase();
  if (data.date !== undefined) updateData.date = data.date;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

  return prisma.expense.update({
    where: { id },
    data: updateData,
  });
};

// Elimina spesa
export const deleteExpense = async (id: string) => {
  await prisma.expense.delete({ where: { id } });
};

// Ottieni spesa singola
export const fetchExpenseById = async (id: string) => {
  return prisma.expense.findUnique({ where: { id } });
};
