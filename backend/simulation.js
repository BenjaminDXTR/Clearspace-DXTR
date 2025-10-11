// Initialisation de variables globales
let situationIndex = 0; // 0 ou 1 pour alterner entre deux trajectoires
let stepIndex = 0; // Indice de la position dans la trajectoire en cours
let cycleCreatedTime = null; // Date fixe pour la situation courante
let currentSimDrones = []; // Stocke la ou les drones simulés
let interruptionTimeout = null; // Pour gérer les pauses entre situations
let droneCounter = 1; // Compteur pour générer ID unique

// Données de trajectoires simulées
const simulatedPath1 = [
  [49.5300, 0.0900], [49.5302, 0.0903], [49.5304, 0.0907], [49.5306, 0.0910],
  [49.5308, 0.0913], [49.5310, 0.0915], [49.5312, 0.0917], [49.5315, 0.0918],
  [49.5317, 0.0917], [49.5320, 0.0914], [49.5323, 0.0910], [49.5325, 0.0905],
  [49.5327, 0.0900], [49.5329, 0.0895], [49.5330, 0.0890], [49.5330, 0.0885],
  [49.5328, 0.0880], [49.5325, 0.0877], [49.5322, 0.0875], [49.5319, 0.0874],
  [49.5315, 0.0875], [49.5312, 0.0877], [49.5309, 0.0879], [49.5306, 0.0881],
  [49.5303, 0.0883], [49.5301, 0.0886], [49.5300, 0.0890]
];
const simulatedPath2 = [
  [49.5295, 0.0930], [49.5298, 0.0932], [49.5301, 0.0936], [49.5304, 0.0940],
  [49.5308, 0.0943], [49.5311, 0.0947], [49.5315, 0.0950], [49.5318, 0.0952],
  [49.5322, 0.0953], [49.5325, 0.0952], [49.5328, 0.0950], [49.5330, 0.0947],
  [49.5333, 0.0943], [49.5335, 0.0938], [49.5336, 0.0933], [49.5337, 0.0928],
  [49.5337, 0.0922], [49.5336, 0.0917], [49.5332, 0.0914], [49.5329, 0.0912],
  [49.5326, 0.0911], [49.5321, 0.0912], [49.5317, 0.0914], [49.5313, 0.0917],
  [49.5309, 0.0920], [49.5305, 0.0922], [49.5301, 0.0924], [49.5298, 0.0926]
];


// Modèle de drone simulé
const testDrone = {
  altitude: 100,
  attack_bands: [2400],
  blacklisted: false,
  confirmed: true,
  created_time: null,
  deleted_time: "0001-01-01T00:00:00Z",
  description: "Simulated drone flight - test data",
  direction: 0,
  distance: 0,
  height: 100,
  id: "SIM_DRONE_001",
  initial_location: { lat: 0, lng: 0 },
  lastseen: null,
  lastseen_time: null,
  latitude: 0,
  localization: null,
  longitude: 0,
  name: "SIMULATED DRONE",
  rc_location: { lat: 0, lng: 0 },
  seen_sensor: [
    {
      bandwidth_khz: 20000,
      detected_freq_khz: 2437000,
      noise_dbm: 0,
      port: "rf",
      sensor_id: "SIM_SENSOR_01",
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

// Fonction construction drone simulé à une position donnée,
// Reçoit une date créée fixe unique par cycle
function buildDrone(position, createdTime, now, base, idSuffix) {
  const d = JSON.parse(JSON.stringify(base));
  d.latitude = position[0];
  d.longitude = position[1];
  d.created_time = createdTime;  // Date fixe pour ce vol simulé
  d.lastseen_time = now;         // Date récente à chaque étape
  d.id = `SIM_DRONE_${idSuffix.toString().padStart(3, '0')}`;
  d.name = `SIMULATED DRONE ${idSuffix}`;
  return d;
}

function sendSimulationStep() {
  const now = new Date().toISOString();

  const currentPath = situationIndex === 0 ? simulatedPath1 : simulatedPath2;

  // Initialisation de la date créée fixe au démarrage du vol
  if (!cycleCreatedTime) {
    cycleCreatedTime = new Date().toISOString();
  }

  if (stepIndex >= currentPath.length) {
    stepIndex = 0;
    // Pause 30s avant un nouveau vol (nouvelle trajectoire)
    setTimeout(() => {
      situationIndex = (situationIndex + 1) % 2; // Change trajectoire
      droneCounter++;          // Nouveau drone ID
      cycleCreatedTime = null; // Réinitialiser la date créée fixe
      currentSimDrones = [];   // Réinitialiser la liste des drones
      sendSimulationStep();    // Lancer nouvelle simulation
    }, 30000);

    // Envoyer tableau vide pour signaler pause/détection nulle
    currentSimDrones = [{ data: { drone: [] } }];
    return;
  }

  const pos = currentPath[stepIndex];
  // Constructeur avec date créée fixe et date actuelle pour lastseen
  let drone = buildDrone(pos, cycleCreatedTime, now, testDrone, droneCounter);

  // Remplacer entrée drone précédente par la nouvelle
  currentSimDrones = currentSimDrones.filter(d => d.id !== drone.id);
  currentSimDrones.push(drone);

  stepIndex++;
  setTimeout(sendSimulationStep, 1000); // 1 secondes entre étapes
}

function getCurrentSimulationData() {
  return { data: { drone: currentSimDrones } };
}

function startSimulation() {
  situationIndex = 0;
  stepIndex = 0;
  cycleCreatedTime = null;
  currentSimDrones = [];
  droneCounter = 1;

  if (interruptionTimeout) {
    clearTimeout(interruptionTimeout);
    interruptionTimeout = null;
  }
  sendSimulationStep();
}

module.exports = {
  startSimulation,
  getCurrentSimulationData,
};
