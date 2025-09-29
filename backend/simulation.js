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
    },
  ],
  speed: 0,
  tracing: {
    lastlen: 0,
    origin: { lat: 0, lng: 0 },
    points: [],
  },
  whitelisted: false,
};

// Tracé simulé (liste de coordonnees)
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
let cycleCreatedTime = null; // Date constante pendant un cycle
let simulationTimeout = null;

/**
 * Envoie un message JSON indiquant la fin de détection (empty array).
 */
function sendEmptyDetection() {
  broadcastFn({ data: { drone: [] } });
  console.log("[TestSim] Envoi JSON vide pour fin de détection");
}

/**
 * Génère périodiquement des positions simulées, appelle backend pour mise à jour trace,
 * puis diffuse aux clients le point simulé.
 */
async function generateSimulatedDetection() {
  if (currentStep >= simulatedPath.length) {
    currentStep = 0;
    cycleCount++;
    console.log(`[TestSim] Cycle terminé #${cycleCount}`);

    sendEmptyDetection();

    // Nouvelle date de création pour nouveau cycle de vol
    cycleCreatedTime = new Date().toISOString();

    if (cycleCount >= 3) {
      console.log("[TestSim] Simulation terminée après 3 cycles");
      return;
    }

    const delay = cycleCount === 1 ? 9000 : 16000;

    clearTimeout(simulationTimeout);
    simulationTimeout = setTimeout(generateSimulatedDetection, delay);
    return;
  }

  if (!cycleCreatedTime) {
    cycleCreatedTime = new Date().toISOString();
  }

  const [lat, lng] = simulatedPath[currentStep];
  currentStep++;

  const partialDroneUpdate = {
    ...testDrone, // Copier toutes les données initiales
    latitude: lat,
    longitude: lng,
    lastseen_time: new Date().toISOString(),
    created_time: cycleCreatedTime,
    type: 'live',
  };

  // Mise à jour backend
  updateFlightTraceFn(partialDroneUpdate);

  // Diffusion aux clients
  broadcastFn([partialDroneUpdate]);

  console.log(`[TestSim] Point simulé ajouté: (${lat}, ${lng})`);

  clearTimeout(simulationTimeout);
  simulationTimeout = setTimeout(generateSimulatedDetection, 2000);
}

/**
 * Lance la simulation en initialisant l'état initial.
 */
function startTestSimulation() {
  currentStep = 0;
  cycleCount = 0;
  cycleCreatedTime = new Date().toISOString();
  console.log("[TestSim] Démarrage simulation drone avec données réalistes");
  generateSimulatedDetection();
}

module.exports = {
  startTestSimulation,
  setBroadcast,
  setUpdateFlightTrace,
};
