import { useState } from 'react';
import type { Discipline } from '../../disciplines/types/discipline';
import type { Member } from '../../members/types/member';
import { WelcomeSend } from '../../notices/components/WelcomeSend';
import { ReceiptView } from '../../payments/components/ReceiptView';
import type { Payment } from '../../payments/types/payment';

interface EnrollmentDoneProps {
  member: Member;
  payment: Payment;
  disciplines: Discipline[];
  onFinish: () => void;
}

/** Last step of the enrollment: the member exists and paid; the secretary can show the receipt and send the welcome. */
export function EnrollmentDone({ member, payment, disciplines, onFinish }: EnrollmentDoneProps) {
  const [showReceipt, setShowReceipt] = useState(false);
  return (
    <section className="card member-form-card" aria-label="Alta de socio">
      <h2 className="member-form__title">Socio dado de alta</h2>
      <p className="member-form__hint">
        {member.firstName} {member.lastName} quedó registrado con el N° {member.memberNumber}.
      </p>
      <WelcomeSend paymentId={payment.id} />
      <div className="member-detail__actions">
        <button type="button" className="button button--secondary" onClick={() => setShowReceipt(true)}>Ver comprobante</button>
        <button type="button" className="button button--primary" onClick={onFinish}>Finalizar</button>
      </div>
      {showReceipt ? <ReceiptView payment={payment} member={member} disciplines={disciplines} onClose={() => setShowReceipt(false)} /> : null}
    </section>
  );
}
