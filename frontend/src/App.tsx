import React from "react";
import "./App.css";

import { DronesProvider } from "./contexts/DronesContext";
import Header from "./components/layout/Header";
import MapLayout from "./components/layout/MapLayout";
import TablesLive from "./components/layout/TablesLive";
import TablesLocal from "./components/layout/TablesLocal";
import AnchorModalLayout from "./components/layout/AnchorModalLayout";
import ErrorPanel from "./components/common/ErrorPanel";
import HistoryFileSelector from "./components/common/HistoryFileSelector";
import DetailsPanel from "./components/flights/DetailsPanel";

import { LIVE_FIELDS, LOCAL_FIELDS, LIVE_DETAILS } from "./utils/constants";
import useAppLogic from "./hooks/useAppLogic";

function AppContent() {
  const logic = useAppLogic();

  return (
    <div>
      <Header />
      <div className="container-main">
        <div className="left-column">
          <div className="map-container">
            <MapLayout
              selectedTracePoints={logic.selectedTracePoints}
              selectedTraceRaw={logic.selectedTraceRaw}
              selected={logic.selected}
              exportObj={logic.exportSelectedAsAnchorJson}
              flyToTrigger={logic.flyToTrigger}
            />
          </div>
          <div className="info-details">
            <DetailsPanel
              selected={logic.selected}
              detailFields={logic.detailFields}
              exportObj={logic.exportSelectedAsAnchorJson}
              selectedTraceRaw={logic.selectedTraceRaw}
              selectedTracePoints={logic.selectedTracePoints}
              debug={logic.debug}
            />
          </div>
        </div>

        <div className="right-column">
          <div className="error-container">
            <ErrorPanel
              errors={logic.errors}
              criticalErrors={logic.criticalErrors}
              onDismiss={logic.dismissError}
              showHistoryToggle={true}
              errorHistory={logic.errorHistory}
            />
          </div>

          <TablesLive
            drones={logic.liveFlights}
            LIVE_FIELDS={LIVE_FIELDS}
            isAnchored={logic.isAnchoredFn}
            renderAnchorCell={logic.renderAnchorCell}
            handleSelect={logic.handleSelect}
            debug={logic.debug}
          />

          <div className="history-selector-container">
            <HistoryFileSelector
              historyFiles={logic.historyFiles}
              currentFile={logic.currentHistoryFile}
              onSelectFile={logic.setCurrentHistoryFile}
            />
          </div>

          <TablesLocal
            localPage={logic.localPage}
            setLocalPage={logic.setLocalPage}
            localMaxPage={logic.localMaxPage}
            localPageData={logic.localPageData}
            LOCAL_FIELDS={LOCAL_FIELDS}
            isAnchored={logic.isAnchoredFn}
            renderAnchorCell={logic.renderAnchorCell}
            handleSelect={logic.handleSelect}
            debug={logic.debug}
          />
        </div>
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
        </AnchorModalLayout>
      )}
    </div>
  );
}

export default function App() {
  return (
    <React.StrictMode>
      <DronesProvider>
        <AppContent />
      </DronesProvider>
    </React.StrictMode>
  );
}
