/**
 * Modern SVG icons for map markers (hospital, fire station, police, shelter, etc.).
 * Uses Lucide-style paths for a professional look. Each type has a distinct icon and color.
 */

const S = 24;
const STROKE = 2;

function icon(paths: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// Hospital (Lucide hospital)
export const HOSPITAL_ICON = icon(
  `<path d="M12 7v4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M14 9h-4"/><path d="M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/>`,
  "#dc2626"
);

// Fire station (Lucide flame)
export const FIRE_STATION_ICON = icon(
  `<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>`,
  "#ea580c"
);

// Police (Lucide shield)
export const POLICE_ICON = icon(
  `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`,
  "#1d4ed8"
);

// Shelter (Lucide tent – emergency shelter)
export const SHELTER_ICON = icon(
  `<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>`,
  "#059669"
);

// Park (Lucide tree-deciduous)
export const PARK_ICON = icon(
  `<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/>`,
  "#16a34a"
);

// Open area (Lucide grid-3x3)
export const OPEN_AREA_ICON = icon(
  `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>`,
  "#65a30d"
);

// Default / other
export const DEFAULT_ICON = icon(
  `<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4 12h4M16 12h4"/>`,
  "#64748b"
);

export const INFRA_ICONS: Record<string, string> = {
  hospital: HOSPITAL_ICON,
  clinic: HOSPITAL_ICON,
  ambulance: HOSPITAL_ICON,
  fire_station: FIRE_STATION_ICON,
  police: POLICE_ICON,
  shelter: SHELTER_ICON,
  park: PARK_ICON,
  open_area: OPEN_AREA_ICON,
};

/** Station types from recommend.py (medical, shelter, comms, supply) and types.ts (command) */
export const STATION_ICON_MAP: Record<string, string> = {
  medical: HOSPITAL_ICON,
  shelter: SHELTER_ICON,
  comms: POLICE_ICON,
  command: POLICE_ICON,
  supply: DEFAULT_ICON,
  hospital: HOSPITAL_ICON,
};

export function getInfraIcon(type: string): string {
  const t = (type || "").toLowerCase().replace(/\s+/g, "_");
  return INFRA_ICONS[t] ?? STATION_ICON_MAP[t] ?? DEFAULT_ICON;
}
