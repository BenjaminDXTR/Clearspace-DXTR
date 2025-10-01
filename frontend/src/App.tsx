// src/App.tsx

import React from "react";
import "./App.css";

import Header from "./components/layout/Header";
import MapLayout from "./components/layout/MapLayout";
import TablesLayout from "./components/layout/TablesLayout";
import AnchorModalLayout from "./components/layout/AnchorModalLayout";
import ErrorPanel from "./components/common/ErrorPanel";

import { LIVE_FIELDS, LIVE_DETAILS } from "./utils/constants";

import useAppLogic from "./hooks/useAppLogic";

function AppContent() {
  // Récupère toute la logique métier et les états via le hook personnalisé
  const logic = useAppLogic();

  return (
    <div>
      {/* Entête principale de la page */}
      <Header />

      {/* Affiche le panneau d'erreurs si des erreurs présentes */}
      {logic.errors.length > 0 && <ErrorPanel errors={logic.errors} onDismiss={logic.dismissError} />}

      <div className="container-detections">
        {/* Composant carte avec traces sélectionnées et contrôle export */}
        <MapLayout
          selectedTracePoints={logic.selectedTracePoints}
          selectedTraceRaw={logic.selectedTraceRaw}
          selected={logic.selected}
          detailFields={logic.detailFields}
          exportObj={logic.exportSelectedAsAnchorJson}
          flyToTrigger={logic.flyToTrigger}
        />

        {/* Tableaux listant tous les drones (live + locaux) paginés */}
        <TablesLayout
          // Affiche les erreurs combinées drones et historique local
          error={logic.dronesError || logic.localHistoryError || null}
          
          drones={[...logic.localFlights, ...logic.liveFlights]}
          LIVE_FIELDS={LIVE_FIELDS}

          // Pagination locale
          localPage={logic.localPage}
          localMaxPage={logic.localMaxPage}
          setLocalPage={logic.setLocalPage}
          localPageData={logic.localPageData}

          // Indique si un vol local est ancré (pour le rendu d’icônes)
          isAnchored={logic.isAnchoredFn}

          // Bouton ancrage dans tableau des vols
          renderAnchorCell={logic.renderAnchorCell}

          // Sélection de drone déclenche mise à jour état sélection
          handleSelect={logic.handleSelect}

          // Flag debug pour composants enfants
          debug={logic.debug}
        />
      </div>

      {/* Modal ancrage lorsque activée */}
      {logic.anchorModal && (
        <AnchorModalLayout
          anchorModal={logic.anchorModal}
          anchorDataPreview={logic.anchorDataPreview}
          anchorDescription={logic.anchorDescription}
          setAnchorDescription={logic.setAnchorDescription}
          getFlightTrace={logic.getTraceForFlight}
          isZipping={logic.isZipping}
          onValidate={logic.handleAnchorValidate}
          onCancel={logic.handleAnchorCancel}
        >
          <div className="modal-map-capture" />
        </AnchorModalLayout>
      )}
    </div>
  );
}

// Export principal App, utilisant React.StrictMode pour dev
export default function App() {
  return (
    <React.StrictMode>
      <AppContent />
    </React.StrictMode>
  );
}
