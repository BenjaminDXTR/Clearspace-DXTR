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
  type: "drone";
  id?: string;
  modele?: string;
  "xtr5 serial number"?: string;
  created_time?: string;
  positionCible: {
    latitude: number;
    longitude: number;
    altitude: number;
    distance: number;
  };
  positionVehicule: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  comment: string;
  anchored_at: string;
  trace?: PositionPoint[];
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

export function buildAnchorData(
  flight: Flight,
  comment = "",
  trace: PositionPoint[] = [],
  positionVehicule = { latitude: 0, longitude: 0, altitude: 0 }
): AnchorData {
  const data: AnchorData = {
    type: "drone",
    id: flight.id,
    modele: flight.name || flight.drone_type || "Inconnu",
    "xtr5 serial number": flight.serial || "",
    created_time: flight.created_time ? flight.created_time.toString() : undefined,
    positionCible: {
      latitude: flight.latitude ?? 0,
      longitude: flight.longitude ?? 0,
      altitude: flight.altitude ?? 0,
      distance: flight.distance ?? 0,
    },
    positionVehicule,
    comment,
    anchored_at: new Date().toISOString(),
    trace,
  };
  dlog("buildAnchorData: prepared for flight", flight.id);
  return data;
}

export async function generateZipFromData(
  mapImageBlob: Blob,
  trace: PositionPoint[]
) {
  const zip = new JSZip();

  if (mapImageBlob && mapImageBlob.size > 0) {
    zip.file("carte.png", mapImageBlob);
    dlog("Image added to ZIP");
  } else {
    dlog("No image provided to ZIP");
  }

  if (trace && trace.length > 0) {
    zip.file("trace.json", JSON.stringify(trace, null, 2));
    dlog("Trace added to ZIP");
  }

  return zip.generateAsync({ type: "blob" });
}
