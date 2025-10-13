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
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

export interface PositionPoint {
  latitude: number;
  longitude: number;
  altitude: number;
}

export interface AnchorData {
  _id?: string; // facultatif mais peut être ajouté si disponible
  id?: string;
  type: string;
  created_time?: string;
  time?: string;
  anchored_at?: string;
  positionCible: {
    latitude: string | number;
    longitude: string | number;
    altitude: string | number;
    localisation?: string; // ajouté par backend si dispo
    distance?: number;
  };
  positionVehicule: {
    latitude: string | number;
    longitude: string | number;
    altitude: string | number;
    localisation?: string; // ajouté par backend si dispo
  };
  idSite?: string;
  siteId?: string;
  modele?: string;
  "xtr5 serial number"?: string;
  comment?: string;
  transactionHash?: string;
  [key: string]: any; // champs additionnels optionnels
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

// Construction du JSON principal sans trace, avec ordre et noms stricts respectés
export function buildAnchorDataPrincipal(
  flight: Flight,
  comment = "",
  siteId = "3"
): AnchorData {
  const nowISO = new Date().toISOString();

  // Conversion lisible, exemple format français localisé
  const readableTime = flight.created_time
    ? new Date(flight.created_time).toLocaleString("fr-FR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : new Date(nowISO).toLocaleString("fr-FR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

  return {
    _id: flight._id,
    id: flight.id,
    type: "Drone",
    created_time: flight.created_time || nowISO,
    time: readableTime,
    anchored_at: nowISO,
    positionCible: {
      latitude: flight.latitude ?? 0,
      longitude: flight.longitude ?? 0,
      altitude: flight.altitude ?? 0,
      distance: flight.distance,
    },
    positionVehicule: {
      latitude: 0,
      longitude: 0,
      altitude: 0,
    },
    idSite: flight.siteId,
    siteId: flight.siteId || siteId,
    modele: flight.name || flight.drone_type,
    "xtr5 serial number": flight.serial || "",
    comment,
  };
}


// Construction de la preuve complète avec trace (hors ordre fixe)
export function buildRawData(flight: Flight, trace: PositionPoint[], comment = "") {
  const { trace: _excluded, ...flightSansTrace } = flight;
  return {
    flight: flightSansTrace,
    comment,
    anchored_at: new Date().toISOString(),
    trace,
  };
}

// Génération ZIP incluant preuve.json et image carte optionnelle
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
