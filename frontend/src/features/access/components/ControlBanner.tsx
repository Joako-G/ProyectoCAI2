import type { ControlBanner as ControlBannerView } from '../utils/control-view';

/**
 * The result banner of the desk: the last control, whoever made it. It is announced politely as it changes, so the
 * wording always names the verdict and the color only reinforces it.
 */
export function ControlBanner({ banner }: { banner: ControlBannerView }) {
  return (
    <section className="control-banner" data-tone={banner.tone} role="status" aria-live="polite" aria-label="Último control">
      <div className="control-banner__main">
        <div className="control-banner__label">ÚLTIMO CONTROL</div>
        <h2 className="control-banner__title">{banner.title}</h2>
        <p className="control-banner__detail">{banner.detail}</p>
      </div>
      {banner.method ? (
        <div className="control-banner__method">
          <div className="control-banner__method-label">MÉTODO</div>
          <div className="control-banner__method-value">{banner.method}</div>
          {banner.time ? <div className="control-banner__time">{banner.time}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
