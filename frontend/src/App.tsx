import React, { useRef, useMemo } from "react";
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

import { LIVE_FIELDS, LOCAL_FIELDS } from "./utils/constants";
import useAppLogic from "./hooks/useAppLogic";

function AppContent() {
  const logic = useAppLogic();

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const memoAnchorModal = useMemo(() => logic.anchorModal, [logic.anchorModal?.flight?.id]);

  /*
  if (logic.loadingAccess) {
    return <div>Chargement...</div>;
  }

  if (logic.accessDenied && logic.errorHtml) {
    return <div dangerouslySetInnerHTML={{ __html: logic.errorHtml }} />;
  }
*/
  return (
    <div>
      <Header />
      <div className="container-main">
        <div className="left-column">
          <div className="map-container">
            <MapLayout
              selected={logic.selected}
              selectedTracePoints={logic.selectedTracePoints}
              selectedTraceRaw={logic.selectedTraceRaw}
              exportObj={logic.exportSelectedAsJson}
              flyToTrigger={logic.flyTrigger}
            />
          </div>
          <div className="info-details">
            <DetailsPanel
              selected={logic.selected}
              detailFields={logic.detailFields}
              exportObj={logic.exportSelectedAsJson}
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
            isAnchored={logic.getAnchorState}
            getTraceForFlight={logic.getTraceForFlight}
            openModal={logic.openModal}
            handleSelect={logic.handleSelect}
            debug={logic.debug}
          />
        </div>
      </div>

      {memoAnchorModal && (
        <AnchorModalLayout
          anchorModal={memoAnchorModal}
          anchorDataPreview={logic.anchorDataPreview}
          anchorDescription={logic.anchorDescription}
          setAnchorDescription={logic.setAnchorDescription}
          getFlightTrace={logic.getTraceForFlight}
          isZipping={logic.isZipping}
          onValidate={logic.onValidate}
          onCancel={logic.onCancel}
          mapDivRef={mapDivRef}
          mapReady={logic.mapReady}
          setMapReady={logic.setMapReady}
          setMapContainer={logic.setMapContainer}
          message={logic.message}
          key={memoAnchorModal?.flight?.id}
        />
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
