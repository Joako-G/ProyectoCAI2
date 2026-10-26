import { usePricingConfig } from '../hooks/usePricingConfig';
import { addTariff, deleteTariff, replaceProrationRule, replaceSurchargeTiers, replaceTariff } from '../services/pricing-api';
import { isAmbiguousWriteFailure } from '../utils/pricing-format';
import { currentMonth } from '../utils/pricing-validation';
import { ProrationSection } from './ProrationSection';
import { SurchargeTiersSection } from './SurchargeTiersSection';
import { TariffsSection } from './TariffsSection';

/** Container of the pricing feature (RF-23): tariff history, surcharge tiers and proration rule. */
export function PricingView({ canWrite }: { canWrite: boolean }) {
  const { state, stale, reload, refresh } = usePricingConfig();

  // Every write re-reads the configuration so the screen shows what the server stored. A failed write
  // whose outcome is unknown or stale is re-read too, and its error still reaches the section.
  const writeAndRefresh = (write: Promise<unknown>) =>
    write.then(refresh, async (error: unknown) => {
      if (isAmbiguousWriteFailure(error)) await refresh();
      throw error;
    });

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
      {stale ? (
        <div className="form-alert pricing-stale" role="alert">
          <p>El cambio se guardó, pero no se pudo actualizar la lista. Reintentá para ver los datos al día.</p>
          <button type="button" className="button button--secondary" onClick={refresh}>Reintentar</button>
        </div>
      ) : null}
      <TariffsSection
        tariffs={tariffs}
        month={currentMonth()}
        canWrite={canWrite}
        onAdd={(tariff) => writeAndRefresh(addTariff(tariff))}
        onReplace={(tariff) => writeAndRefresh(replaceTariff(tariff))}
        onDelete={(effectiveFrom) => writeAndRefresh(deleteTariff(effectiveFrom))}
      />
      <SurchargeTiersSection tiers={surchargeTiers} canWrite={canWrite} onSave={(tiers) => writeAndRefresh(replaceSurchargeTiers(tiers))} />
      <ProrationSection rule={prorationRule} canWrite={canWrite} onSave={(rule) => writeAndRefresh(replaceProrationRule(rule))} />
    </div>
  );
}
