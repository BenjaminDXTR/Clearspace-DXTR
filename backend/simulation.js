const { saveFlightToHistory } = require('./flightsHistoryManager');

let broadcastFn = () => {};
function setBroadcast(fn) { broadcastFn = fn; }

const testDrone = {
  altitude: 0,
  attack_bands: [2400],
  blacklisted: false,
  confirmed: true,
  created_time: new Date().toISOString(),
  deleted_time: "0001-01-01T00:00:00Z",
  description: "",
  direction: 90,
  distance: 9000000,
  height: 0,
  id: "1748FEV3HMG924501040",
  initial_location: { lat: 49.53097720147358, lng: 0.09360614114544319 },
  lastseen: null,
  lastseen_time: new Date().toISOString(),
  latitude: 49.53097720147358,
  localization: null,
  longitude: 0.09360614114544319,
  name: "AUTEL RemoteID",
  rc_location: { lat: 210, lng: 210 },
  seen_sensor: [
    {
      bandwidth_khz: 20000,
      detected_freq_khz: 2437000,
      noise_dbm: 0,
      port: "rf",
      sensor_id: "178",
      signal_dbm: 0,
      snr_dB: 0,
    }
  ],
  speed: 0,
  tracing: { 
    lastlen: 0,
    origin: { lat: 0, lng: 0 },
    points: [],
  },
  whitelisted: false,
};

const simulatedPath = [
  [49.5310, 0.0936],
  [49.5311, 0.0937],
  [49.5312, 0.0939],
  [49.5313, 0.0941],
  [49.5314, 0.0940],
  [49.53145, 0.0938],
  [49.5314, 0.0936],
  [49.5313, 0.0934],
  [49.5312, 0.0933],
  [49.5311, 0.0934],
  [49.5310, 0.0935],
  [49.53095, 0.0936],
];

let currentStep = 0;
let cycleCount = 0;
let simulationTimeout;

function sendEmptyDetection() {
  // Envoie un JSON vide simulant fin de détection
  broadcastFn({ data: { drone: [] } });
  console.log("[TestSim] Envoi JSON vide pour fin de détection");
}

async function generateSimulatedDetection() {
  if (currentStep >= simulatedPath.length) {
    currentStep = 0; // reset pour nouveau cycle
    cycleCount++;
    console.log(`[TestSim] Cycle terminé #${cycleCount}`);

    sendEmptyDetection();

    // Définir le délai avant le prochain cycle
    const delay = cycleCount === 1 ? 9000 : 16000; // 9s la 1ère fois, puis 16s

    if (cycleCount >= 3) {
      console.log("[TestSim] Simulation terminée après 3 cycles");
      return;
    }

    clearTimeout(simulationTimeout);
    simulationTimeout = setTimeout(generateSimulatedDetection, delay);
    return;
  }

  const [lat, lng] = simulatedPath[currentStep];
  currentStep++;

  const detection = JSON.parse(JSON.stringify(testDrone));
  detection.latitude = lat;
  detection.longitude = lng;
  detection.lastseen_time = new Date().toISOString();

  await saveFlightToHistory(detection);
  broadcastFn([detection]);

  console.log(`[TestSim] Point simulé ajouté: (${lat}, ${lng})`);

  clearTimeout(simulationTimeout);
  simulationTimeout = setTimeout(generateSimulatedDetection, 2000);
}

function startTestSimulation() {
  currentStep = 0;
  cycleCount = 0;
  console.log("[TestSim] Démarrage simulation drone avec données réalistes");
  generateSimulatedDetection();
}

module.exports = { startTestSimulation, setBroadcast };
