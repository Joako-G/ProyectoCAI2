import { useSearchParams } from 'react-router';
import { PaymentsView } from './PaymentsView';

/** Cobros at its address: `/cobros?dni=…` opens with that member already found. */
export function PaymentsRoute(props: { canCollect: boolean; canAnnul: boolean }) {
  const [params] = useSearchParams();
  return <PaymentsView {...props} initialDni={params.get('dni') ?? ''} />;
}
