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

let cycleIndex = 0;
let stepIndex = 0;
let cycleCreatedTime = null;
let currentSimDrones = [];
let interruptionTimeout = null;

function buildDrone(position, createdTime, now, base) {
  const d = JSON.parse(JSON.stringify(base));
  d.latitude = position[0];
  d.longitude = position[1];
  d.created_time = createdTime;
  d.lastseen_time = now;
  return d;
}

function sendSimulationStep() {
  const now = new Date().toISOString();

  // Reset cycle and step if needed
  if (stepIndex >= simulatedPath.length) {
    stepIndex = 0;
    cycleIndex = (cycleIndex + 1) % 4; // 4 cycles total
    cycleCreatedTime = null;
    currentSimDrones = [];

    // Send empty detection to indicate end of cycle
    currentSimDrones.push({ data: { drone: [] } });

    // Delay between cycles depends on cycle
    let delayAfterCycle = cycleIndex === 0 ? 15000 : 10000;
    setTimeout(sendSimulationStep, delayAfterCycle);
    return;
  }

  if (!cycleCreatedTime) {
    cycleCreatedTime = new Date().toISOString();
  }

  const pos = simulatedPath[stepIndex];

  switch (cycleIndex) {
    case 0:
      // Cycle 1: un seul vol suivi, puis pause 15s (done above)
      {
        let drone = buildDrone(pos, cycleCreatedTime, now, testDrone);
        currentSimDrones = currentSimDrones.filter((d) => d.id !== drone.id);
        currentSimDrones.push(drone);
        stepIndex++;
        setTimeout(sendSimulationStep, 2000);
      }
      break;

    case 1:
      // Cycle 2: vol coupé pendant 5 sec (envoie vide)
      {
        // Interruption simulée sur 2 steps (~ 4 sec)
        if (stepIndex === 5) {
          // Pause: send empty drone list
          currentSimDrones = [{ data: { drone: [] } }];
          stepIndex++; // Still increment to move past interruption
          interruptionTimeout = setTimeout(() => {
            interruptionTimeout = null;
            sendSimulationStep();
          }, 5000);
          return;
        } else if (stepIndex === 6 && interruptionTimeout) {
          // waiting interruption time so do nothing
          return;
        }

        let drone = buildDrone(pos, cycleCreatedTime, now, testDrone);
        currentSimDrones = currentSimDrones.filter((d) => d.id !== drone.id);
        currentSimDrones.push(drone);
        stepIndex++;
        setTimeout(sendSimulationStep, 2000);
      }
      break;

    case 2:
      // Cycle 3: deux vols parallèles, départs/arrêts non synchronisés
      {
        let drone1 = buildDrone(pos, cycleCreatedTime, now, testDrone);
        let clonePosIndex = (stepIndex + 3) % simulatedPath.length;
        let posClone = simulatedPath[clonePosIndex];
        let drone2 = buildDrone(posClone, cycleCreatedTime, now, testDroneClone);

        // Simuler arrêt du drone 1 au step 7
        if (stepIndex === 7) {
          currentSimDrones = currentSimDrones.filter((d) => d.id !== drone1.id);
        } else {
          currentSimDrones = currentSimDrones.filter((d) => d.id !== drone1.id);
          currentSimDrones.push(drone1);
        }
        // Drone 2 continue sans pause
        currentSimDrones = currentSimDrones.filter((d) => d.id !== drone2.id);
        currentSimDrones.push(drone2);

        stepIndex++;
        setTimeout(sendSimulationStep, 2000);
      }
      break;

    case 3:
      // Cycle 4: plusieurs vols, l'un avec interruption 5s sur trajectoire
      {
        let drone1;
        // Interruption pour drone1 entre step 4-6 (envoie vide)
        if (stepIndex >= 4 && stepIndex <= 6) {
          currentSimDrones = currentSimDrones.filter((d) => d.id !== testDrone.id);
        } else {
          drone1 = buildDrone(pos, cycleCreatedTime, now, testDrone);
          currentSimDrones = currentSimDrones.filter((d) => d.id !== drone1.id);
          if (drone1) currentSimDrones.push(drone1);
        }

        // Drone clone suit sans interruption
        let clonePosIndex = (stepIndex + 2) % simulatedPath.length;
        let posClone = simulatedPath[clonePosIndex];
        let drone2 = buildDrone(posClone, cycleCreatedTime, now, testDroneClone);

        currentSimDrones = currentSimDrones.filter((d) => d.id !== drone2.id);
        currentSimDrones.push(drone2);

        stepIndex++;
        setTimeout(sendSimulationStep, 2000);
      }
      break;

    default:
      stepIndex++;
      setTimeout(sendSimulationStep, 2000);
      break;
  }
}

function getCurrentSimulationData() {
  return JSON.parse(JSON.stringify(currentSimDrones));
}

function startSimulation() {
  stepIndex = 0;
  cycleIndex = 0;
  cycleCreatedTime = null;
  currentSimDrones = [];
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
