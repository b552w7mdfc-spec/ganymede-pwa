import { useEffect, useState } from 'react';
import { Catalog } from './screens/Catalog';
import { Home } from './screens/Home';
import { Manage } from './screens/Manage';
import { Reader } from './screens/Reader';
import { useNavStore } from './store/navStore';
import { useUserStore } from './store/userStore';
import { Banner, BottomTabs, ConfirmDialog, ContextPill, ContextSheet, Toast } from './ui/components';
import { navigate, useRoute } from './ui/router';

function goBack(): void {
  if (window.history.length > 1) window.history.back();
  else navigate({ name: 'home' });
}

export function App() {
  const route = useRoute();
  const hydrated = useUserStore((s) => s.hydrated);
  const hydrate = useUserStore((s) => s.hydrate);
  const warning = useUserStore((s) => s.warning);
  const saveError = useUserStore((s) => s.saveError);
  const dismissWarning = useUserStore((s) => s.dismissWarning);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Ferme la feuille si on change d'écran ; la pile des sauts entre guides
  // n'a de sens que dans le lecteur.
  useEffect(() => {
    setSheetOpen(false);
    if (route.name !== 'guide') useNavStore.getState().clear();
  }, [route.name]);

  const reading = route.name === 'guide';

  return (
    <div className={`app${reading ? ' reading' : ''}`}>
      <header className="topbar">
        {reading ? (
          <button type="button" className="icon-btn" aria-label="Retour" onClick={goBack}>
            ‹
          </button>
        ) : (
          <strong style={{ paddingLeft: 8 }}>Guide Dofus</strong>
        )}
        <span className="spacer" />
        {hydrated ? <ContextPill onOpen={() => setSheetOpen(true)} /> : null}
      </header>

      {warning ? (
        <div className="screen" style={{ paddingBottom: 0 }}>
          <Banner kind="error">
            <span>{warning}</span>
            <button type="button" className="btn small" onClick={dismissWarning}>
              OK
            </button>
          </Banner>
        </div>
      ) : null}
      {saveError ? (
        <div className="screen" style={{ paddingBottom: 0 }}>
          <Banner kind="error">{saveError}</Banner>
        </div>
      ) : null}

      <main>
        {!hydrated ? (
          <div className="screen">
            <p className="muted">Chargement…</p>
          </div>
        ) : route.name === 'guide' ? (
          <Reader key={route.id} guideId={route.id} initialStep={route.step} />
        ) : route.name === 'catalog' ? (
          <Catalog />
        ) : route.name === 'manage' ? (
          <Manage />
        ) : (
          <Home />
        )}
      </main>

      {!reading ? (
        <div className="bottombar">
          <BottomTabs current={route.name} />
        </div>
      ) : null}

      {sheetOpen ? <ContextSheet onClose={() => setSheetOpen(false)} /> : null}
      <ConfirmDialog />
      <Toast />
    </div>
  );
}
