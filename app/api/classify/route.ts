import { NextResponse } from "next/server";
import { classifyInfrastructureByZone } from "@/services/zoneClassifier";
import type {
  EarthquakeEvent,
  ZonePolygons,
  InfrastructureNode,
} from "@/services/zoneClassifier.types";

export interface ClassifyRequestBody {
  quake: EarthquakeEvent;
  zonePolygons: ZonePolygons;
  infrastructure: InfrastructureNode[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClassifyRequestBody;
    const { quake, zonePolygons, infrastructure } = body;
    if (!quake?.quake_id || !zonePolygons?.red || !zonePolygons?.orange || !zonePolygons?.green || !Array.isArray(infrastructure)) {
      return NextResponse.json(
        { error: "Missing or invalid quake, zonePolygons (red, orange, green), or infrastructure" },
        { status: 400 }
      );
    }
    const result = classifyInfrastructureByZone(quake, zonePolygons, infrastructure);
    return NextResponse.json(result);
  } catch (err) {
    console.error("classify error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Classification failed" },
      { status: 500 }
    );
  }
}
