import { apiClient } from "./client";

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: "BEVANDE" | "CIBO" | "SERVIZI" | "DECORAZIONI" | "ALTRO";
  paymentMethod: string;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  income: number;
  expenses: number;
  balance: number;
  personCount: number;
}

export interface BalancesReport {
  balances: PaymentMethodBalance[];
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
}

export interface CreateExpenseDto {
  description: string;
  amount: number;
  category: "BEVANDE" | "CIBO" | "SERVIZI" | "DECORAZIONI" | "ALTRO";
  paymentMethod: string;
  date?: string;
  notes?: string;
}

export interface UpdateExpenseDto {
  description?: string;
  amount?: number;
  category?: "BEVANDE" | "CIBO" | "SERVIZI" | "DECORAZIONI" | "ALTRO";
  paymentMethod?: string;
  date?: string;
  notes?: string;
}

export const fetchExpenses = async (eventId: string, params?: {
  category?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Expense[]> => {
  const response = await apiClient.get<Expense[]>(`/events/${eventId}/expenses`, { params });
  return response.data;
};

export const fetchExpenseStats = async (eventId: string, params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExpenseStats> => {
  const response = await apiClient.get<ExpenseStats>(`/events/${eventId}/expenses/stats`, { params });
  return response.data;
};

export const fetchBalances = async (eventId: string): Promise<BalancesReport> => {
  const response = await apiClient.get<BalancesReport>(`/events/${eventId}/expenses/balances`);
  return response.data;
};

export const fetchExpenseById = async (eventId: string, id: string): Promise<Expense> => {
  const response = await apiClient.get<Expense>(`/events/${eventId}/expenses/${id}`);
  return response.data;
};

export const createExpense = async (eventId: string, data: CreateExpenseDto): Promise<Expense> => {
  const response = await apiClient.post<Expense>(`/events/${eventId}/expenses`, data);
  return response.data;
};

export const updateExpense = async (eventId: string, id: string, data: UpdateExpenseDto): Promise<Expense> => {
  const response = await apiClient.patch<Expense>(`/events/${eventId}/expenses/${id}`, data);
  return response.data;
};

export const deleteExpense = async (eventId: string, id: string): Promise<void> => {
  await apiClient.delete(`/events/${eventId}/expenses/${id}`);
};
