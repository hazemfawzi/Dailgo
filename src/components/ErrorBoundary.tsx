import { Component } from 'react';
import type { ReactNode } from 'react';
import type { Translate } from '../lib/workspace';
export class ErrorBoundary extends Component<
  { t: Translate; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    const { t } = this.props;
    return this.state.failed ? (
      <section className="card scope-page" role="alert">
        <h1 dir="auto">{t('ui.thisViewCouldNotOpen.d19d25')}</h1>
        <p dir="auto">{t('ui.yourStoredDataHasNotBeenCleared.00e7d3')}</p>
        <button className="button" onClick={() => location.reload()}>
          {t('ui.reload.1ec0bd')}
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
