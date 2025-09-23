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
  created_time?: string | number;
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

/** Flag debug centralisé */
const DEBUG = config.debug || config.environment === "development";
/** URL d'API pour l'ancrage centralisée */
const ANCHOR_URL = config.apiUrl + "/anchor";

/** Log conditionnel */
function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

/**
 * Prépare les données complètes d’ancrage au format attendu,
 * à partir d’un vol, d’un commentaire et d'un tracé GPS complet.
 *
 * @param flight Vol drone
 * @param comment Commentaire utilisateur
 * @param trace Trace complète au format tableau PositionPoint
 * @param positionVehicule Position du véhicule (optionnelle)
 * @returns Objet AnchorData complet prêt à sérialiser
 */
export function buildAnchorData(
  flight: Flight,
  comment = "",
  trace: PositionPoint[] = [],
  positionVehicule = { latitude: 0, longitude: 0, altitude: 0 }
): AnchorData {
  const anchorData: AnchorData = {
    type: "drone",
    id: flight.id,
    modele: flight.name || flight.drone_type || "Inconnu",
    "xtr5 serial number": flight.serial || "",
    created_time: flight.created_time,
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
  dlog("[buildAnchorData] Préparé pour vol ID:", flight.id);
  return anchorData;
}

/**
 * Capture une image PNG de la carte Leaflet.
 */
export async function captureMapImage(
  mapDiv: HTMLElement | null = null,
  scale = 3
): Promise<Blob | null> {
  if (!mapDiv) {
    mapDiv = document.querySelector(".leaflet-container");
  }
  if (!mapDiv) {
    if (DEBUG) console.warn("[captureMapImage] Carte introuvable (.leaflet-container)");
    return null;
  }
  try {
    dlog("[captureMapImage] Capture en cours...");
    const canvas = await html2canvas(mapDiv, {
      useCORS: true,
      backgroundColor: null,
      scale,
    } as any);
    return await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
  } catch (error) {
    console.error("[captureMapImage] Erreur capture:", error);
    return null;
  }
}

/**
 * Crée un fichier ZIP contenant l’image de la carte et le fichier des positions.
 *
 * @param mapImageBlob Image PNG de la carte
 * @param trace Trace complète au format PositionPoint[]
 * @param imageName Nom du fichier image dans ZIP (par défaut "carte.png")
 * @param positionsName Nom du fichier des positions dans ZIP (par défaut "positions.json")
 * @returns Blob ZIP
 */
export async function generateAnchorZip(
  mapImageBlob: Blob | null,
  trace: PositionPoint[],
  imageName = "carte.png",
  positionsName = "positions.json"
): Promise<Blob> {
  const zip = new JSZip();

  if (mapImageBlob && mapImageBlob.size > 0) {
    zip.file(imageName, mapImageBlob);
    dlog("[generateAnchorZip] Image ajoutée au ZIP");
  } else {
    console.warn("[generateAnchorZip] Pas d'image fournie, ZIP vide");
  }

  if (trace && Array.isArray(trace) && trace.length > 0) {
    zip.file(positionsName, JSON.stringify(trace, null, 2));
    dlog("[generateAnchorZip] Positions ajoutées au ZIP");
  } else {
    console.warn("[generateAnchorZip] Positions vides ou non fournies");
  }

  return await zip.generateAsync({ type: "blob" });
}

/**
 * Envoie les données d’ancrage et le fichier ZIP au backend.
 * @throws {Error} si le fichier ZIP est vide ou en cas d'échec réseau
 */
export async function sendAnchorToBackend(
  anchorData: AnchorData,
  zipBlob: Blob
): Promise<AnchorResponse> {
  if (!zipBlob || zipBlob.size === 0) {
    throw new Error("Le fichier ZIP de preuve est vide ou invalide");
  }

  const safeId = String(anchorData.id ?? "unknown").replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );
  const fileName = `preuve_${safeId}_${Date.now()}.zip`;

  try {
    dlog("[sendAnchorToBackend] Envoi en cours vers:", ANCHOR_URL);
    const formData = new FormData();
    formData.append("anchorData", JSON.stringify(anchorData));
    formData.append("proofZip", zipBlob, fileName);

    const response = await fetch(ANCHOR_URL, { method: "POST", body: formData });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Erreur serveur ${response.status} : ${errorText || response.statusText}`
      );
    }

    const result: AnchorResponse = await response.json();
    dlog("[sendAnchorToBackend] Réponse:", result);
    return result;
  } catch (error) {
    console.error("[sendAnchorToBackend] Échec d’envoi:", error);
    throw error;
  }
}
