import { Router } from 'express';
import { isAdmin } from '../middleware/auth';
import * as expenseService from '../services/expenseService';
import { ExpenseCategory } from '@prisma/client';

const router = Router();

const VALID_PAYMENT_METHODS = ['paypal', 'contanti', 'p2p', 'bonifico'];

// GET /api/expenses/balances - Saldi per metodo pagamento (solo admin)
router.get('/balances', isAdmin, async (req, res) => {
  try {
    const balances = await expenseService.fetchBalances();
    res.json(balances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/expenses - Lista spese (solo admin)
router.get('/', isAdmin, async (req, res) => {
  try {
    const { category, startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const expenses = await expenseService.fetchExpenses(
      category as string | undefined,
      start,
      end
    );

    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/expenses/stats - Statistiche spese (solo admin)
router.get('/stats', isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const stats = await expenseService.fetchExpenseStats(start, end);

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/expenses/:id - Singola spesa (solo admin)
router.get('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await expenseService.fetchExpenseById(id);

    if (!expense) {
      return res.status(404).json({ error: 'Spesa non trovata' });
    }

    return res.json(expense);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/expenses - Crea nuova spesa (solo admin)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { description, amount, category, paymentMethod, date, notes } = req.body;

    // Validazione
    if (!description || !amount || !category || !paymentMethod) {
      return res.status(400).json({ error: 'Descrizione, importo, categoria e metodo pagamento sono obbligatori' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'L\'importo deve essere maggiore di zero' });
    }

    if (!Object.values(ExpenseCategory).includes(category)) {
      return res.status(400).json({ error: 'Categoria non valida' });
    }

    if (!VALID_PAYMENT_METHODS.includes(paymentMethod.toLowerCase())) {
      return res.status(400).json({ error: 'Metodo di pagamento non valido. Usa: paypal, contanti, p2p, bonifico' });
    }

    const expense = await expenseService.createExpense({
      description,
      amount: parseFloat(amount),
      category,
      paymentMethod,
      date: date ? new Date(date) : undefined,
      notes
    });

    return res.status(201).json(expense);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/expenses/:id - Aggiorna spesa (solo admin)
router.patch('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount, category, paymentMethod, date, notes } = req.body;

    // Validazione importo se presente
    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ error: 'L\'importo deve essere maggiore di zero' });
    }

    // Validazione categoria se presente
    if (category !== undefined && !Object.values(ExpenseCategory).includes(category)) {
      return res.status(400).json({ error: 'Categoria non valida' });
    }

    // Validazione metodo pagamento se presente
    if (paymentMethod !== undefined && !VALID_PAYMENT_METHODS.includes(paymentMethod.toLowerCase())) {
      return res.status(400).json({ error: 'Metodo di pagamento non valido. Usa: paypal, contanti, p2p, bonifico' });
    }

    const updateData: any = {};
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (category !== undefined) updateData.category = category;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (date !== undefined) updateData.date = new Date(date);
    if (notes !== undefined) updateData.notes = notes;

    const expense = await expenseService.updateExpense(id, updateData);

    return res.json(expense);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Spesa non trovata' });
    }
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/expenses/:id - Elimina spesa (solo admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await expenseService.deleteExpense(id);
    return res.json({ message: 'Spesa eliminata con successo' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Spesa non trovata' });
    }
    return res.status(500).json({ error: error.message });
  }
});

export default router;
