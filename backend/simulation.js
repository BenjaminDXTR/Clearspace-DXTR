let broadcastFn = () => {};
let updateFlightTraceFn = () => {};

/**
 * Définit la fonction de broadcast (envoi aux clients front)
 * @param {function} fn fonction appelée pour diffuser les données
 */
function setBroadcast(fn) {
  broadcastFn = fn;
}

/**
 * Définit la fonction de mise à jour des traces appelée lors de simulation
 * @param {function} fn fonction pour mettre à jour la trace dans backend
 */
function setUpdateFlightTrace(fn) {
  updateFlightTraceFn = fn;
}

// Drone test complet avec données initiales
const testDrone = {
  altitude: 0,
  attack_bands: [2400],
  blacklisted: false,
  confirmed: true,
  created_time: null, // sera fixé au début du cycle
  deleted_time: "0001-01-01T00:00:00Z",
  description: "",
  direction: 90,
  distance: 9000000,
  height: 0,
  id: "1748FEV3HMG924501040",
  initial_location: { lat: 49.53097720147358, lng: 0.09360614114544319 },
  lastseen: null,
  lastseen_time: null,
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
    },
  ],
  speed: 0,
  tracing: { lastlen: 0, origin: { lat: 0, lng: 0 }, points: [] },
  whitelisted: false,
};

// Drone clone pour détection simultanée au cycle 3
const testDroneClone = {
  ...testDrone,
  id: "1748CLONEHMG924501040",
  name: "AUTEL Clone",
};

// Liste étendue de positions simulées
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
  [49.5309, 0.0937],
  [49.53085, 0.0938],
  [49.5308, 0.0939],
];

let currentStep = 0;
let cycleCount = 0;
let cycleCreatedTime = null;
let simulationTimeout = null;

/**
 * Envoie un message JSON vide pour indiquer fin de détection.
 */
function sendEmptyDetection() {
  broadcastFn({ data: { drone: [] } });
  console.log("[TestSim] Envoi JSON vide pour fin de détection");
}

/**
 * Génère périodiquement les positions simulées,
 * appelle backend pour mise à jour trace,
 * diffuse aux clients les drones détectés,
 * supporte cycle double détection.
 */
async function generateSimulatedDetection() {
  if (currentStep >= simulatedPath.length) {
    currentStep = 0;
    cycleCount++;
    console.log(`[TestSim] Cycle terminé #${cycleCount}`);

    sendEmptyDetection();

    cycleCreatedTime = null;

    if (cycleCount > 3) {
      console.log("[TestSim] Fin simulation après 3 cycles");
      return;
    }

    // Pause longue après cycle 1 (12s), plus courte après autres (5s)
    const delay = cycleCount === 1 ? 12000 : 5000;

    clearTimeout(simulationTimeout);
    simulationTimeout = setTimeout(generateSimulatedDetection, delay);
    return;
  }

  if (!cycleCreatedTime) {
    cycleCreatedTime = new Date().toISOString();
  }

  const [lat, lng] = simulatedPath[currentStep++];
  const now = new Date().toISOString();

  // Drone principal
  const droneData = JSON.parse(JSON.stringify(testDrone));
  droneData.latitude = lat;
  droneData.longitude = lng;
  droneData.lastseen_time = now;
  droneData.created_time = cycleCreatedTime;

  // Au cycle 3, détection simultanée d’un second drone clone
  if (cycleCount === 3) {
    const cloneData = JSON.parse(JSON.stringify(testDroneClone));
    cloneData.latitude = lat + 0.0002;
    cloneData.longitude = lng + 0.0002;
    cloneData.lastseen_time = now;
    cloneData.created_time = cycleCreatedTime;

    updateFlightTraceFn(droneData);
    updateFlightTraceFn(cloneData);
    broadcastFn([droneData, cloneData]);
    console.log(`[TestSim] Cycle 3: deux drones détectés simultanément en points (${lat},${lng}) et (${cloneData.latitude},${cloneData.longitude})`);
  } else {
    updateFlightTraceFn(droneData);
    broadcastFn([droneData]);
    console.log(`[TestSim] Point simulé ajouté: (${lat}, ${lng})`);
  }

  clearTimeout(simulationTimeout);
  simulationTimeout = setTimeout(generateSimulatedDetection, 2000);
}

/**
 * Démarre la simulation en initialisant l’état.
 */
function startTestSimulation() {
  currentStep = 0;
  cycleCount = 0;
  cycleCreatedTime = null;
  console.log("[TestSim] Démarrage simulation drone avec cycle double et pause timeout");
  generateSimulatedDetection();
}

module.exports = {
  startTestSimulation,
  setBroadcast,
  setUpdateFlightTrace,
};
