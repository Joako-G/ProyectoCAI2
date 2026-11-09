import { useState } from 'react';
import { MoneyField } from '../../../components/desk/MoneyField';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseInput } from '../types/expense';
import { todayInClub } from '../../members/utils/member-format';
import { CATEGORY_LABELS, MAX_DESCRIPTION_LENGTH, parseAmount } from '../utils/expense-format';

interface ExpenseFormProps {
  saving: boolean;
  error?: string;
  /** Resolves true when the expense was saved. */
  onSave: (input: ExpenseInput) => Promise<boolean>;
}

/** The date, amount, category and description of a new expense; it clears itself only after a successful save. */
export function ExpenseForm({ saving, error, onSave }: ExpenseFormProps) {
  const [date, setDate] = useState(todayInClub());
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [description, setDescription] = useState('');
  const today = todayInClub();
  const amount = parseAmount(amountText);
  const text = description.trim();
  // A date typed by hand can still be empty or in the future, whatever the picker's `max` says.
  const dateError = date === '' ? 'Elegí la fecha del gasto.' : date > today ? 'La fecha no puede ser futura.' : undefined;
  const amountError = amountText !== '' && amount === null ? 'Ingresá un monto entero mayor a cero.' : undefined;

  async function submit() {
    if (amount === null || dateError || text === '') return;
    if (await onSave({ date, amount, category, description: text })) {
      setAmountText('');
      setDescription('');
    }
  }

  return (
    <form className="desk-form" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="desk-field">
        <label htmlFor="expense-date" className="desk-field__label">Fecha</label>
        <input id="expense-date" className="desk-input desk-input--text" type="date" value={date} max={today} disabled={saving}
          aria-invalid={dateError ? true : undefined} aria-describedby={dateError ? 'expense-date-error' : undefined}
          onChange={(event) => setDate(event.target.value)} />
        {dateError ? <p id="expense-date-error" className="desk-field__error">{dateError}</p> : null}
      </div>
      <MoneyField label="Monto" value={amountText} disabled={saving} {...(amountError ? { error: amountError } : {})} onChange={setAmountText} />
      <div className="desk-field">
        <label htmlFor="expense-category" className="desk-field__label">Categoría</label>
        <select id="expense-category" className="desk-input desk-input--text" value={category} disabled={saving} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}>
          {EXPENSE_CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}
        </select>
      </div>
      <div className="desk-field">
        <label htmlFor="expense-description" className="desk-field__label">Descripción</label>
        <input id="expense-description" className="desk-input desk-input--text" type="text" maxLength={MAX_DESCRIPTION_LENGTH} value={description} disabled={saving}
          onChange={(event) => setDescription(event.target.value)} />
        <p className="desk-field__count" aria-hidden="true">{description.length}/{MAX_DESCRIPTION_LENGTH}</p>
      </div>

      {error ? <p className="desk-field__error" role="alert">{error}</p> : null}

      <button type="submit" className="desk-primary" disabled={amount === null || dateError !== undefined || text === '' || saving}>Registrar gasto</button>
    </form>
  );
}
