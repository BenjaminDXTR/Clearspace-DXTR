export function getFitForTrace(
  trace: [number, number][] | [number, number, number][],
  minZoom: number = 10
): { center: [number, number]; zoom: number } {
  if (!trace || trace.length === 0) {
    return { center: [48.8584, 2.2945], zoom: 15 };
  }
  const lats = trace.map(t => t[0]);
  const lngs = trace.map(t => t[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const center: [number, number] = [
    (minLat + maxLat) / 2,
    (minLng + maxLng) / 2,
  ];

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const areaDegree = Math.max(latSpan, lngSpan);

  let zoom = 15;
  if (areaDegree > 1) zoom = 7;
  else if (areaDegree > 0.5) zoom = 9;
  else if (areaDegree > 0.2) zoom = 12;
  else if (areaDegree > 0.07) zoom = 14;
  else if (areaDegree > 0.01) zoom = 16;
  else zoom = 18;

  zoom = Math.max(zoom, minZoom);

  return { center, zoom };
}
