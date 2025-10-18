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
  latitude?: number | string;
  longitude?: number | string;
  hash?: string;
  zipName?: string;
  anchored_at?: string;
  anchored_requested_at?: string;
  siteId?: string | number;
  extra?: any;
  [key: string]: any;
}

export interface PositionPoint {
  latitude: number;
  longitude: number;
  time: number; // Temps réel et non altitude
}

export interface RawData {
  flight: Flight;
  comment: string;
  anchored_at: string;
  trace: PositionPoint[];
  zipName?: string;
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

export function buildAnchorDataPrincipal(
  flight: Flight,
  comment = "",
  siteId = "3"
): any {
  const readableTime = flight.created_time
    ? new Date(flight.created_time).toLocaleString("fr-FR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : new Date().toLocaleString("fr-FR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

  const extra = {
    id: flight.id || "",
    modele: flight.name || flight.drone_type || "",
    created_time: flight.created_time || "",
    anchored_at: flight.anchored_at || "",
    anchored_requested_at: flight.anchored_requested_at || "",
    "xtr5 serial number": flight.serial || "",
    ...(flight.extra && typeof flight.extra === "object" ? flight.extra : {}),
  };

  return {
    time: readableTime,
    positionCible: {
      latitude: String(flight.latitude ?? ""),
      longitude: String(flight.longitude ?? ""),
      altitude: String(flight.altitude ?? ""),
    },
    positionVehicule: {
      latitude: "0",
      longitude: "0",
      altitude: "0",
    },
    type: "Drone",
    idSite: String(flight.siteId ?? siteId),
    hash: flight.hash || "",
    zipName: flight.zipName || "",
    comment: comment || "",
    extra,
  };
}

export function buildRawData(
  flight: Flight,
  trace: PositionPoint[],
  comment = ""
): RawData {
  const { trace: _excluded, ...flightSansTrace } = flight;
  return {
    flight: flightSansTrace,
    comment,
    anchored_at: new Date().toISOString(),
    trace,
  };
}

export async function generateZipFromDataWithProof(
  mapImageBlob: Blob,
  rawData: RawData
): Promise<Blob> {
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
