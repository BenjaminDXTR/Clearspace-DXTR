// src/App.tsx

import React from "react";
import "./App.css";

import { DronesProvider } from "./contexts/DronesContext";

import Header from "./components/layout/Header";
import MapLayout from "./components/layout/MapLayout";
import TablesLayout from "./components/layout/TablesLayout";
import AnchorModalLayout from "./components/layout/AnchorModalLayout";
import ErrorPanel from "./components/common/ErrorPanel";

import { LIVE_FIELDS, LIVE_DETAILS } from "./utils/constants";
import useAppLogic from "./hooks/useAppLogic";

function AppContent() {
  const logic = useAppLogic();

  return (
    <div>
      <Header />

      <ErrorPanel
        errors={logic.errors}
        criticalErrors={logic.criticalErrors}
        onDismiss={logic.dismissError}
        showHistoryToggle={true}
        errorHistory={logic.errorHistory}
      />

      <div className="container-detections">
        <MapLayout
          selectedTracePoints={logic.selectedTracePoints}
          selectedTraceRaw={logic.selectedTraceRaw}
          selected={logic.selected}
          detailFields={logic.detailFields}
          exportObj={logic.exportSelectedAsAnchorJson}
          flyToTrigger={logic.flyToTrigger}
        />

        <TablesLayout
          drones={[...logic.localFlights, ...logic.liveFlights]}
          LIVE_FIELDS={LIVE_FIELDS}
          localPage={logic.localPage}
          localMaxPage={logic.localMaxPage}
          setLocalPage={logic.setLocalPage}
          localPageData={logic.localPageData}
          isAnchored={logic.isAnchoredFn}
          renderAnchorCell={logic.renderAnchorCell}
          handleSelect={logic.handleSelect}
          debug={logic.debug}
        />

      </div>

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

// enroule AppContent dans DronesProvider
export default function App() {
  return (
    <React.StrictMode>
      <DronesProvider>
        <AppContent />
      </DronesProvider>
    </React.StrictMode>
  );
}

