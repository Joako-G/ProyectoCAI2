/** The receipt number as printed on documents: at least four digits, e.g. 12 becomes "0012". */
export function formatReceiptNumber(receiptNumber: number): string {
  return String(receiptNumber).padStart(4, '0');
}

/** `YYYY-MM-DD` as `DD/MM/YYYY`. */
export function formatClubDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

const pesos = new Intl.NumberFormat('es-AR');

/** Whole pesos as "$ 45.000". */
export function formatPesos(amount: number): string {
  return `$ ${pesos.format(amount)}`;
}
