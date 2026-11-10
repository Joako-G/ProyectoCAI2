import { receiptPdfUrl } from '../services/payments-api';

interface ReceiptPdfLinkProps {
  paymentId: string;
  /** Id of a hint that explains what to do with the file. */
  describedBy?: string;
}

/** Downloads the receipt as a PDF. A plain link: the server answers with an attachment, so the browser saves the file. */
export function ReceiptPdfLink({ paymentId, describedBy }: ReceiptPdfLinkProps) {
  return (
    <a className="button button--secondary" href={receiptPdfUrl(paymentId)} download aria-describedby={describedBy}>
      Descargar PDF
    </a>
  );
}
