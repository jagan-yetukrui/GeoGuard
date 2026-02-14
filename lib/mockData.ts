import type {
  QuakeEvent,
  RiskZone,
  Station,
  Route,
  ResponsePlan,
} from "./types";

export const mockQuakeEvent: QuakeEvent = {
  id: "quake-1",
  magnitude: 6.2,
  depth: 10,
  locationName: "Pacific Coast, 45 km SW of San Francisco",
  timestamp: "2025-02-14T08:32:00.000Z",
  coordinates: { lat: 37.6542, lng: -122.5134 },
};

export const mockRiskZones: RiskZone[] = [
  {
    id: "zone-1",
    level: "high",
    label: "Epicenter radius",
    description: "Within 15 km of epicenter. Structural damage likely.",
    radiusKm: 15,
    bounds: {
      ne: { lat: 37.75, lng: -122.35 },
      sw: { lat: 37.55, lng: -122.65 },
    },
  },
  {
    id: "zone-2",
    level: "medium",
    label: "Strong shaking",
    description: "15–40 km from epicenter. Non-structural damage possible.",
    radiusKm: 40,
    bounds: {
      ne: { lat: 37.9, lng: -122.2 },
      sw: { lat: 37.4, lng: -122.8 },
    },
  },
  {
    id: "zone-3",
    level: "low",
    label: "Felt area",
    description: "40+ km. Light shaking, minimal impact.",
    radiusKm: 70,
    bounds: {
      ne: { lat: 38.1, lng: -122.0 },
      sw: { lat: 37.2, lng: -123.0 },
    },
  },
];

export const mockStations: Station[] = [
  {
    id: "st-1",
    name: "County General Hospital",
    type: "hospital",
    coordinates: { lat: 37.7212, lng: -122.4789 },
    distanceKm: 8.2,
  },
  {
    id: "st-2",
    name: "West Bay Supply Depot",
    type: "supply",
    coordinates: { lat: 37.6891, lng: -122.4012 },
    distanceKm: 12.1,
  },
  {
    id: "st-3",
    name: "Civic Center Shelter",
    type: "shelter",
    coordinates: { lat: 37.7792, lng: -122.4194 },
    distanceKm: 14.5,
  },
  {
    id: "st-4",
    name: "Regional EOC",
    type: "command",
    coordinates: { lat: 37.8021, lng: -122.4362 },
    distanceKm: 16.0,
  },
];

export const mockRoutes: Route[] = [
  {
    id: "route-1",
    name: "Epicenter to Hospital",
    from: "Epicenter",
    to: "County General Hospital",
    waypoints: [
      mockQuakeEvent.coordinates,
      mockStations[0].coordinates,
    ],
    durationMinutes: 18,
    distanceKm: 8.2,
  },
  {
    id: "route-2",
    name: "Supply run to Shelter",
    from: "West Bay Supply Depot",
    to: "Civic Center Shelter",
    waypoints: [
      mockStations[1].coordinates,
      mockStations[2].coordinates,
    ],
    durationMinutes: 22,
    distanceKm: 11.3,
  },
  {
    id: "route-3",
    name: "EOC to Epicenter zone",
    from: "Regional EOC",
    to: "Epicenter (staging)",
    waypoints: [
      mockStations[3].coordinates,
      mockQuakeEvent.coordinates,
    ],
    durationMinutes: 28,
    distanceKm: 16.0,
  },
];

export const mockResponsePlan: ResponsePlan = {
  summary:
    "Moderate shallow quake 45 km SW of San Francisco. High-risk zone within 15 km; prioritize evacuation and triage. Three response routes and four support stations identified.",
  riskZones: mockRiskZones,
  stations: mockStations,
  routes: mockRoutes,
  priorityActions: [
    "Activate emergency ops and establish incident command at EOC",
    "Dispatch medical teams to County General; open Civic Center Shelter",
    "Secure West Bay Supply Depot and begin distribution along Route 2",
    "Set up triage at epicenter perimeter; avoid entering high-risk zone until stable",
    "Verify communications and power at all stations within 2 hours",
  ],
};
