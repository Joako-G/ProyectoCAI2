import { usePricingConfig } from '../hooks/usePricingConfig';
import { addTariff, deleteTariff, replaceProrationRule, replaceSurchargeTiers, replaceTariff } from '../services/pricing-api';
import { currentMonth } from '../utils/pricing-validation';
import { ProrationSection } from './ProrationSection';
import { SurchargeTiersSection } from './SurchargeTiersSection';
import { TariffsSection } from './TariffsSection';

/** Container of the pricing feature (RF-23): tariff history, surcharge tiers and proration rule. */
export function PricingView({ canWrite }: { canWrite: boolean }) {
  const { state, reload, refresh } = usePricingConfig();

  // Every write re-reads the configuration so the screen shows what the server stored.
  const then = (write: Promise<unknown>) => write.then(refresh);

  if (state.phase === 'loading') {
    return <section className="card members-page" aria-label="Precios"><p className="members-page__notice" role="status">Cargando precios…</p></section>;
  }

  if (state.phase === 'error') {
    return (
      <section className="card members-page" aria-label="Precios">
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p><strong>No se pudieron cargar los precios.</strong> {state.message}</p>
          <button type="button" className="button button--secondary" onClick={reload}>Reintentar</button>
        </div>
      </section>
    );
  }

  const { tariffs, surchargeTiers, prorationRule } = state.config;
  return (
    <div className="pricing-view">
      <TariffsSection
        tariffs={tariffs}
        month={currentMonth()}
        canWrite={canWrite}
        onAdd={(tariff) => then(addTariff(tariff))}
        onReplace={(tariff) => then(replaceTariff(tariff))}
        onDelete={(effectiveFrom) => then(deleteTariff(effectiveFrom))}
      />
      <SurchargeTiersSection tiers={surchargeTiers} canWrite={canWrite} onSave={(tiers) => then(replaceSurchargeTiers(tiers))} />
      <ProrationSection rule={prorationRule} canWrite={canWrite} onSave={(rule) => then(replaceProrationRule(rule))} />
    </div>
  );
}
