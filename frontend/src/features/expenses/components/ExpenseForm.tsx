import { useState } from 'react';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseInput } from '../types/expense';
import { CATEGORY_LABELS, MAX_DESCRIPTION_LENGTH, parseAmount, todayIso } from '../utils/expense-format';

interface ExpenseFormProps {
  saving: boolean;
  error?: string;
  /** Resolves true when the expense was saved. */
  onSave: (input: ExpenseInput) => Promise<boolean>;
}

/** The date, amount, category and description of a new expense; it clears itself only after a successful save. */
export function ExpenseForm({ saving, error, onSave }: ExpenseFormProps) {
  const [date, setDate] = useState(todayIso());
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [description, setDescription] = useState('');
  const amount = parseAmount(amountText);
  const text = description.trim();

  async function submit() {
    if (amount === null || date === '' || text === '') return;
    if (await onSave({ date, amount, category, description: text })) {
      setAmountText('');
      setDescription('');
    }
  }

  return (
    <form className="arqueo-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="form-field">
        <label htmlFor="expense-date" className="form-field__label">Fecha</label>
        <input id="expense-date" type="date" value={date} max={todayIso()} disabled={saving} onChange={(event) => setDate(event.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="expense-amount" className="form-field__label">Monto</label>
        <input id="expense-amount" type="text" inputMode="numeric" autoComplete="off" value={amountText} disabled={saving}
          onChange={(event) => setAmountText(event.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="expense-category" className="form-field__label">Categoría</label>
        <select id="expense-category" value={category} disabled={saving} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}>
          {EXPENSE_CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="expense-description" className="form-field__label">Descripción</label>
        <input id="expense-description" type="text" maxLength={MAX_DESCRIPTION_LENGTH} value={description} disabled={saving}
          onChange={(event) => setDescription(event.target.value)} />
      </div>

      {error ? <p className="form-field__error" role="alert">{error}</p> : null}

      <button type="submit" className="button button--primary" disabled={amount === null || date === '' || text === '' || saving}>Registrar gasto</button>
    </form>
  );
}
