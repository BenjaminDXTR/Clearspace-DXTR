const { addDetectionToHistory } = require('./flightsHistoryManager');

// Drone simulé avec identifiants et properties spécifiques
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
  initial_location: { lat: 49.53103341423189, lng: 0.09355105847764378 },
  lastseen: null,
  lastseen_time: new Date().toISOString(),
  latitude: 49.53098338874404,
  localization: null,
  longitude: 0.093592370478504,
  name: "AUTEL RemoteID",
  rc_location: { lat: 210, lng: 210 },
  seen_sensor: [{
    bandwidth_khz: 20000,
    detected_freq_khz: 2437000,
    noise_dbm: 0,
    port: "rf",
    sensor_id: "178",
    signal_dbm: 0,
    snr_dB: 0,
  }],
  speed: 0,
  tracing: {
    lastlen: 49,
    origin: { lat: 49.191048, lng: -123.146 },
    points: []
  },
  whitelisted: false
};

// Trajectoire GPS simulée progressive (ex de points autour de initial_location)
const simulatedPath = [
  [49.5309, 0.0936],
  [49.5310, 0.0937],
  [49.5311, 0.0938],
  [49.5312, 0.09385],
  [49.53125, 0.0939],
];

let currentStep = 0;
let simulationInterval;

/**
 * Génère une détection conforme au format attendu + mise à jour de position
 */
function generateSimulatedDetection() {
  if (currentStep >= simulatedPath.length) {
    clearInterval(simulationInterval);
    console.log("[TestSim] Vol simulé terminé.");
    return;
  }

  const [lat, lng] = simulatedPath[currentStep];
  currentStep++;

  // Copie drone et mise à jour position + trace à jour
  const detection = JSON.parse(JSON.stringify(testDrone)); // clonage simple
  detection.latitude = lat;
  detection.longitude = lng;
  detection.lastseen_time = new Date().toISOString();

  // Mise à jour tracé progressif (array de points [lat,lng])
  if (!Array.isArray(detection.tracing.points)) {
    detection.tracing.points = [];
  }
  detection.tracing.points.push([lat, lng]);
  detection.tracing.lastlen = detection.tracing.points.length;

  // Le champ tracing ici simplifié pour .addDetectionToHistory peut s’attendre à un tableau
  // Si nécessaire adapter addDetectionToHistory pour accepter cet objet
  detection.tracing = detection.tracing.points;

  addDetectionToHistory(detection);
  console.log(`[TestSim] Point simulé ajouté: (${lat}, ${lng}), total points: ${detection.tracing.length}`);
}

/**
 * Démarre la simulation avec intervalle paramétrable
 */
function startTestSimulation(intervalMs = 2000) {
  console.log("[TestSim] Démarrage simulation drone avec données réalistes");
  simulationInterval = setInterval(generateSimulatedDetection, intervalMs);
}

module.exports = { startTestSimulation };
