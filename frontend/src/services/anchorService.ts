import JSZip from "jszip";
import html2canvas from "html2canvas";
import { config } from "../config";

export interface Flight {
  altitude?: number;
  created_time?: string;
  distance?: number;
  id?: string;
  name?: string;
  drone_type?: string;
  serial?: string;
  [key: string]: any;
}

export interface PositionPoint {
  latitude: number;
  longitude: number;
  altitude: number;
}

export interface AnchorData {
  time: string;
  positionCible: {
    lat: string;
    lon: string;
    alt: string;
  };
  positionVehicule: {
    lat: string;
    lon: string;
    alt: string;
  };
  type: string;
  siteId: string;
  comment: string;
  extra?: Record<string, any>;
}

export interface AnchorResponse {
  folder?: string;
  message?: string;
  [key: string]: any;
}

const DEBUG = config.debug || config.environment === "development";
const ANCHOR_URL = config.apiUrl + "/anchor";

function dlog(...args: any) {
  if (DEBUG) console.log(...args);
}

export const AnchorJsonModel = {
  type: "drone" as const,
  id: "",
  modele: "",
  "xtr5 serial number": "10900",
  created_time: "",
  positionCible: {
    latitude: 0,
    longitude: 0,
    altitude: 0,
    distance: 0,
  },
  positionVehicule: {
    latitude: 0,
    longitude: 0,
    altitude: 0,
  },
  comment: "",
  anchored_at: "",
};

// Construction du JSON principal sans trace
export function buildAnchorDataPrincipal(
  flight: Flight,
  comment = "",
  siteId = "3"
): AnchorData {
  const nowISO = new Date().toISOString();
  return {
    time: flight.created_time ? flight.created_time.toString() : nowISO,

    positionCible: {
      lat: (flight.latitude ?? 0).toString(),
      lon: (flight.longitude ?? 0).toString(),
      alt: (flight.altitude ?? 0).toString(),
    },
    positionVehicule: {
      lat: "0",
      lon: "0",
      alt: "0",
    },
    type: "2", // ex drone = "2"
    siteId,
    comment,
    extra: {
      id: flight.id,
      modele: flight.name || flight.drone_type,
      serialNumber: flight.serial || "",
      anchored_at: nowISO,
    },
  };
}

// La fonction pour construire la preuve avec toute la trace
export function buildRawData(flight: Flight, trace: PositionPoint[], comment = "") {
  // Exclure la trace dans l'objet vol pour éviter double-contenu
  const { trace: _excluded, ...flightSansTrace } = flight;
  return {
    flight: flightSansTrace,
    comment,
    anchored_at: new Date().toISOString(),
    trace,
  };
}

// Générateur ZIP avec preuve.json contenant la trace complète
export async function generateZipFromDataWithProof(mapImageBlob: Blob, rawData: any) {
  const zip = new JSZip();

  if (mapImageBlob && mapImageBlob.size > 0) {
    zip.file("carte.png", mapImageBlob);
    dlog("Image ajoutée au ZIP");
  } else {
    dlog("Aucune image fournie pour le ZIP");
  }

  zip.file("preuve.json", JSON.stringify(rawData, null, 2));
  dlog("Preuve JSON complète ajoutée au ZIP");

  return zip.generateAsync({ type: "blob" });
}
