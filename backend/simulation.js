const baseDrone = {
  altitude: 20,
  attack_bands: [2400],
  blacklisted: false,
  confirmed: true,
  created_time: null,
  deleted_time: "0001-01-01T00:00:00Z",
  description: "",
  direction: 90,
  distance: 100,
  height: 5,
  id: "Simulation-1",
  initial_location: { lat: 49.53097720147358, lng: 0.09360614114544319 },
  lastseen: null,
  lastseen_time: null,
  latitude: 49.53097720147358,
  localization: null,
  longitude: 0.09360614114544319,
  name: "Drone simulé",
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

let stepIndex = 0;
let currentSimDrones = [];

function buildDrone(position, now, base) {
  const d = JSON.parse(JSON.stringify(base));
  d.latitude = position[0];
  d.longitude = position[1];
  d.created_time = now;
  d.lastseen_time = now;
  return d;
}

function sendSimulationStep() {
  const now = new Date().toISOString();

  if (stepIndex >= simulatedPath.length) {
    stepIndex = 0; // Recommence à la première position
  }

  const pos = simulatedPath[stepIndex];
  const drone = buildDrone(pos, now, baseDrone);

  currentSimDrones = [drone]; // Un seul drone à la fois
  stepIndex++;

  // Rappel du cycle toutes les 30 secondes
  setTimeout(sendSimulationStep, 30000);
}

function getCurrentSimulationData() {
  return JSON.parse(JSON.stringify(currentSimDrones));
}

function startSimulation() {
  stepIndex = 0;
  currentSimDrones = [];
  sendSimulationStep();
}

module.exports = {
  startSimulation,
  getCurrentSimulationData,
};
