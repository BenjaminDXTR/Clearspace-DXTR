import JSZip from "jszip";
import html2canvas from "html2canvas";
import { config } from "../config";

export interface Flight {
  altitude?: number;
  created_time?: string | number;
  distance?: number;
  id?: string | number;
  latitude?: number;
  longitude?: number;
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
  id?: string | number;
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

function dlog(...args: any[]) {
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
  dlog("buildAnchorData: prepared for flight ", flight.id);
  return data;
}

export async function captureMapImage(
  mapDiv: HTMLElement | null = null,
  scale = 3,
  onUserError?: (msg: string) => void
): Promise<Blob | null> {
  if (!mapDiv) {
    mapDiv = document.querySelector(".leaflet-container");
  }
  if (!mapDiv) {
    const warning = "Carte introuvable (.leaflet-container)";
    if (DEBUG) console.warn("[captureMapImage]", warning);
    if (onUserError) onUserError(warning);
    return null;
  }
  try {
    dlog("[captureMapImage] Capture en cours...");
    const canvas = await html2canvas(mapDiv, {
      useCORS: true,
      backgroundColor: null,
      scale,
    } as any);
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob)));
  } catch (error) {
    const errorMsg = `[captureMapImage] Erreur capture: ${(error as Error).message}`;
    console.error(errorMsg);
    if (onUserError) onUserError("Erreur lors de la capture de la carte");
    return null;
  }
}

export async function generateAnchorZip(
  mapImageBlob: Blob | null,
  trace: PositionPoint[],
  imageName = "carte.png",
  positionsName = "positions.json",
  onUserWarning?: (msg: string) => void
): Promise<Blob> {
  const zip = new JSZip();

  if (mapImageBlob && mapImageBlob.size > 0) {
    zip.file(imageName, mapImageBlob);
    dlog("[generateAnchorZip] Image ajoutée au ZIP");
  } else {
    const warningMsg = "Pas d'image fournie, ZIP vide";
    console.warn("[generateAnchorZip]", warningMsg);
    if (onUserWarning) onUserWarning(warningMsg);
  }

  if (trace && Array.isArray(trace) && trace.length > 0) {
    zip.file(positionsName, JSON.stringify(trace, null, 2));
    dlog("[generateAnchorZip] Positions ajoutées au ZIP");
  } else {
    const warningMsg = "Positions vides ou non fournies";
    console.warn("[generateAnchorZip]", warningMsg);
    if (onUserWarning) onUserWarning(warningMsg);
  }

  return await zip.generateAsync({ type: "blob" });
}

export async function sendAnchorToBackend(
  anchorData: AnchorData,
  zipBlob: Blob,
  onUserError?: (msg: string) => void
): Promise<AnchorResponse> {
  if (!zipBlob || zipBlob.size === 0) {
    const errMsg = "Le fichier ZIP de preuve est vide ou invalide";
    if (onUserError) onUserError(errMsg);
    throw new Error(errMsg);
  }

  const safeId = String(anchorData.id ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `preuve_${safeId}_${Date.now()}.zip`;

  try {
    dlog("[sendAnchorToBackend] Envoi en cours vers:", ANCHOR_URL);
    const formData = new FormData();
    formData.append("anchorData", JSON.stringify(anchorData));
    formData.append("proofZip", zipBlob, fileName);

    const response = await fetch(ANCHOR_URL, { method: "POST", body: formData });

    if (!response.ok) {
      const errorText = await response.text();
      const errMsg = `Erreur serveur ${response.status} : ${errorText || response.statusText}`;
      if (onUserError) onUserError(errMsg);
      throw new Error(errMsg);
    }

    const result: AnchorResponse = await response.json();
    dlog("[sendAnchorToBackend] Réponse:", result);
    return result;
  } catch (error) {
    const errMsg = `[sendAnchorToBackend] Échec d’envoi: ${(error as Error).message}`;
    console.error(errMsg);
    if (onUserError) onUserError(errMsg);
    throw error;
  }
}
