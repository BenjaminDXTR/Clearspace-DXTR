const testDrone = {
  altitude: 0,
  attack_bands: [2400],
  blacklisted: false,
  confirmed: true,
  created_time: null,
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


const testDroneClone = {
  ...testDrone,
  id: "1748CLONEHMG924501040",
  name: "AUTEL Clone",
  direction: 60,
  speed: 10,
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

let currentStep = 0;
let cycleCount = 0;
let cycleCreatedTime = null;
let currentSimDrones = [];

function buildDrone(position, createdTime, now, base) {
  const d = JSON.parse(JSON.stringify(base));
  d.latitude = position[0];
  d.longitude = position[1];
  d.created_time = createdTime;
  d.lastseen_time = now;
  // Trace on drone will be assembled separately
  return d;
}

async function generateSimulationStep() {
  if (currentStep >= simulatedPath.length) {
    currentStep = 0;
    cycleCount++;
    currentSimDrones = [];

    // End of cycle: include empty detection
    currentSimDrones.push({ data: { drone: [] } });

    cycleCreatedTime = null;

    if (cycleCount > 3) {
      return; // stop
    }

    let delay = cycleCount === 1 ? 30000 : cycleCount === 2 ? 20000 : 10000;
    setTimeout(generateSimulationStep, delay);
    return;
  }

  if (!cycleCreatedTime) {
    cycleCreatedTime = new Date().toISOString();
  }
  const now = new Date().toISOString();
  const pos = simulatedPath[currentStep++];

  let drone = buildDrone(pos, cycleCreatedTime, now, testDrone);

  if (cycleCount === 3) {
    const clone = buildDrone([pos[0] + 0.0004, pos[1] + 0.0003], cycleCreatedTime, now, testDroneClone);
    currentSimDrones = currentSimDrones.filter(d => d.id !== drone.id && d.id !== clone.id);
    currentSimDrones.push(drone);
    currentSimDrones.push(clone);
  } else {
    currentSimDrones = currentSimDrones.filter(d => d.id !== drone.id);
    currentSimDrones.push(drone);
  }

  setTimeout(generateSimulationStep, 2000);
}

function getCurrentSimulationData() {
  // Return deep copy or fresh array of current state drones for poller
  return JSON.parse(JSON.stringify(currentSimDrones));
}

function startSimulation() {
  currentStep = 0;
  cycleCount = 0;
  cycleCreatedTime = null;
  currentSimDrones = [];
  generateSimulationStep();
}

module.exports = {
  startSimulation,
  getCurrentSimulationData,
};
