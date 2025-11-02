import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchExpenses,
  fetchExpenseStats,
  fetchBalances,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../api/expenses";
import type { Expense, CreateExpenseDto } from "../api/expenses";
import "./ExpensesPage.css";

const CATEGORIES = [
  { value: "BEVANDE", label: "Bevande", emoji: "🍺" },
  { value: "CIBO", label: "Cibo", emoji: "🍕" },
  { value: "SERVIZI", label: "Servizi", emoji: "🎵" },
  { value: "DECORAZIONI", label: "Decorazioni", emoji: "🎈" },
  { value: "ALTRO", label: "Altro", emoji: "📦" },
];

const PAYMENT_METHODS = [
  { value: "paypal", label: "PayPal", emoji: "💳" },
  { value: "contanti", label: "Contanti", emoji: "💵" },
  { value: "p2p", label: "P2P (Satispay, ecc.)", emoji: "📱" },
  { value: "bonifico", label: "Bonifico", emoji: "🏦" },
];

export default function ExpensesPage() {
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [formData, setFormData] = useState<CreateExpenseDto>({
    description: "",
    amount: 0,
    category: "ALTRO",
    paymentMethod: "contanti",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Query expenses
  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["expenses", categoryFilter],
    queryFn: () =>
      fetchExpenses(categoryFilter !== "ALL" ? { category: categoryFilter } : undefined),
  });

  // Query stats
  const { data: stats } = useQuery({
    queryKey: ["expenses-stats"],
    queryFn: () => fetchExpenseStats(),
  });

  // Query balances
  const { data: balances } = useQuery({
    queryKey: ["expenses-balances"],
    queryFn: () => fetchBalances(),
  });

  // Mutation: create
  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-stats"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-balances"] });
      setShowAddForm(false);
      resetForm();
    },
  });

  // Mutation: update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateExpenseDto> }) =>
      updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-stats"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-balances"] });
      setEditingExpense(null);
      resetForm();
    },
  });

  // Mutation: delete
  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-stats"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-balances"] });
    },
  });

  const resetForm = () => {
    setFormData({
      description: "",
      amount: 0,
      category: "ALTRO",
      paymentMethod: "contanti",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim() || formData.amount <= 0) {
      alert("Inserisci descrizione e importo valido");
      return;
    }

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      paymentMethod: expense.paymentMethod,
      date: expense.date.split("T")[0],
      notes: expense.notes || "",
    });
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingExpense(null);
    setShowAddForm(false);
    resetForm();
  };

  const handleDelete = (id: string, description: string) => {
    if (window.confirm(`Eliminare la spesa "${description}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const getCategoryEmoji = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.emoji || "📦";
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const getPaymentMethodLabel = (method: string) => {
    return PAYMENT_METHODS.find((m) => m.value === method.toLowerCase())?.label || method;
  };

  const getPaymentMethodEmoji = (method: string) => {
    return PAYMENT_METHODS.find((m) => m.value === method.toLowerCase())?.emoji || "💰";
  };

  // Filtra spese in base alla ricerca e alla categoria
  const filteredExpenses = expenses.filter((exp) => {
    // Filtro categoria
    const matchesCategory = categoryFilter === "ALL" || exp.category === categoryFilter;

    // Filtro ricerca
    const matchesSearch = !searchQuery.trim() || (() => {
      const query = searchQuery.toLowerCase();
      return (
        exp.description.toLowerCase().includes(query) ||
        getCategoryLabel(exp.category).toLowerCase().includes(query) ||
        getPaymentMethodLabel(exp.paymentMethod).toLowerCase().includes(query) ||
        (exp.notes && exp.notes.toLowerCase().includes(query))
      );
    })();

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="expenses-page">
      <div className="expenses-container">
        <header className="expenses-header">
          <h1>Gestione Spese</h1>
          <p className="subtitle">Traccia tutte le spese della festa</p>
        </header>

        {/* Balances by Payment Method */}
        {balances && (
          <div className="balances-section">
            <h2>Saldi per Metodo di Pagamento</h2>
            <div className="balances-grid">
              {balances.balances.map((balance) => (
                <div key={balance.method} className="balance-card">
                  <div className="balance-header">
                    <span className="balance-emoji">{getPaymentMethodEmoji(balance.method)}</span>
                    <h3>{getPaymentMethodLabel(balance.method)}</h3>
                  </div>
                  <div className="balance-stats">
                    <div className="balance-stat">
                      <span className="balance-label">Persone</span>
                      <span className="balance-value">{balance.personCount}</span>
                    </div>
                    <div className="balance-stat income">
                      <span className="balance-label">Entrate</span>
                      <span className="balance-value">+{formatCurrency(balance.income)}</span>
                    </div>
                    <div className="balance-stat expense">
                      <span className="balance-label">Spese</span>
                      <span className="balance-value">-{formatCurrency(balance.expenses)}</span>
                    </div>
                    <div className={`balance-stat total ${balance.balance >= 0 ? 'positive' : 'negative'}`}>
                      <span className="balance-label">Saldo</span>
                      <span className="balance-value">{formatCurrency(balance.balance)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="total-balance-card">
              <div className="total-balance-content">
                <div className="total-balance-stat">
                  <span className="total-balance-label">Entrate Totali</span>
                  <span className="total-balance-value income">+{formatCurrency(balances.totalIncome)}</span>
                </div>
                <div className="total-balance-stat">
                  <span className="total-balance-label">Spese Totali</span>
                  <span className="total-balance-value expense">-{formatCurrency(balances.totalExpenses)}</span>
                </div>
                <div className="total-balance-stat">
                  <span className="total-balance-label">Saldo Totale</span>
                  <span className={`total-balance-value ${balances.totalBalance >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(balances.totalBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card total">
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <p className="stat-label">Totale Spese</p>
                <p className="stat-value">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
            <div className="stat-card count">
              <div className="stat-icon">📝</div>
              <div className="stat-info">
                <p className="stat-label">Numero Spese</p>
                <p className="stat-value">{stats.totalCount}</p>
              </div>
            </div>
            <div className="stat-card average">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <p className="stat-label">Media per Spesa</p>
                <p className="stat-value">
                  {stats.totalCount > 0
                    ? formatCurrency(stats.totalAmount / stats.totalCount)
                    : formatCurrency(0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {stats && stats.byCategory.length > 0 && (
          <div className="category-breakdown">
            <h2>Spese per Categoria</h2>
            <div className="category-grid">
              {stats.byCategory.map((cat) => (
                <div key={cat.category} className="category-card">
                  <div className="category-icon">{getCategoryEmoji(cat.category)}</div>
                  <div className="category-info">
                    <p className="category-name">{getCategoryLabel(cat.category)}</p>
                    <p className="category-amount">{formatCurrency(cat.amount)}</p>
                    <p className="category-count">{cat.count} spese</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Expense Button */}
        <div className="actions">
          <button
            className="btn-primary"
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (showAddForm) handleCancelEdit();
            }}
          >
            {showAddForm ? "Annulla" : "+ Aggiungi Spesa"}
          </button>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="add-form-card">
            <h3>{editingExpense ? "Modifica Spesa" : "Nuova Spesa"}</h3>
            <form onSubmit={handleSubmit} className="expense-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Descrizione *</label>
                  <input
                    type="text"
                    placeholder="Es: Birre, DJ, Decorazioni..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Importo (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formData.amount || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Categoria *</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value as any,
                      })
                    }
                    required
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.emoji} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Metodo Pagamento *</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentMethod: e.target.value })
                    }
                    required
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.emoji} {method.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Data</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Note (opzionale)</label>
                <textarea
                  placeholder="Note aggiuntive..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit">
                  {editingExpense ? "Salva Modifiche" : "Aggiungi Spesa"}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleCancelEdit}
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search Bar */}
        <div className="search-container">
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Cerca per descrizione, categoria, metodo pagamento o note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search"
                onClick={() => setSearchQuery("")}
                aria-label="Cancella ricerca"
              >
                ✕
              </button>
            )}
          </div>
          {expenses.length > 0 && (
            <div className="search-results">
              Mostrando {filteredExpenses.length} di {expenses.length} spese
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="filter-section">
          <label>Filtra per categoria:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">Tutte le categorie</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.emoji} {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Expenses List */}
        <div className="expenses-list">
          <h2>Lista Spese</h2>
          {expenses.length === 0 ? (
            <div className="empty-state">
              <p>Nessuna spesa registrata</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="empty-state">
              <p>Nessuna spesa corrisponde ai criteri di ricerca</p>
            </div>
          ) : (
            <div className="expenses-table">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrizione</th>
                    <th>Categoria</th>
                    <th>Metodo Pag.</th>
                    <th>Importo</th>
                    <th>Note</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td data-label="Data">
                        {new Date(expense.date).toLocaleDateString("it-IT")}
                      </td>
                      <td data-label="Descrizione">
                        <strong>{expense.description}</strong>
                      </td>
                      <td data-label="Categoria">
                        <span className="category-badge">
                          {getCategoryEmoji(expense.category)}{" "}
                          {getCategoryLabel(expense.category)}
                        </span>
                      </td>
                      <td data-label="Metodo Pag.">
                        <span className="payment-badge">
                          {getPaymentMethodEmoji(expense.paymentMethod)}{" "}
                          {getPaymentMethodLabel(expense.paymentMethod)}
                        </span>
                      </td>
                      <td data-label="Importo">
                        <strong className="amount">{formatCurrency(expense.amount)}</strong>
                      </td>
                      <td data-label="Note">
                        <span className="notes">{expense.notes || "-"}</span>
                      </td>
                      <td data-label="Azioni">
                        <div className="action-buttons">
                          <button
                            className="btn-edit"
                            onClick={() => handleEdit(expense)}
                            title="Modifica"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() =>
                              handleDelete(expense.id, expense.description)
                            }
                            title="Elimina"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
