from app.utils import clamp


def compute_zoning(
    magnitude: float,
    depth_km: float,
    plate_distance_km: float | None,
    center_lat: float,
    center_lng: float,
    plate_motion_proxy_mm_yr: float | None = None,
) -> tuple[int, list[dict], str, dict]:
    mag_factor = clamp((magnitude - 3.5) / 4.0, 0.0, 1.0)
    shallow_factor = clamp((70.0 - depth_km) / 70.0, 0.0, 1.0)
    if plate_distance_km is None:
        plate_factor = 0.5
    else:
        plate_factor = clamp((200.0 - plate_distance_km) / 200.0, 0.0, 1.0)

    raw = 0.55 * mag_factor + 0.30 * shallow_factor + 0.15 * plate_factor
    damage_score = round(100.0 * raw)

    base_high = 2.0 + 6.0 * mag_factor
    base_med = 8.0 + 18.0 * mag_factor
    base_low = 20.0 + 45.0 * mag_factor
    amp = 0.75 + 0.35 * shallow_factor + 0.20 * plate_factor
    high_km = clamp(round(base_high * amp, 1), 0.1, 25.0)
    med_km = clamp(round(base_med * amp, 1), 0.1, 80.0)
    low_km = clamp(round(base_low * amp, 1), 0.1, 180.0)

    plate_plausible = plate_distance_km is not None and plate_distance_km <= 2000.0
    if plate_plausible and magnitude >= 5.5 and (plate_distance_km is None or plate_distance_km <= 1000.0):
        confidence = "high"
    elif magnitude >= 4.5:
        confidence = "medium"
    else:
        confidence = "low"

    center = {"lat": center_lat, "lng": center_lng}
    zones = [
        {"level": "high", "radius_km": high_km, "center": center},
        {"level": "medium", "radius_km": med_km, "center": center},
        {"level": "low", "radius_km": low_km, "center": center},
    ]

    factors = []
    if mag_factor > 0.5:
        factors.append("high magnitude")
    if shallow_factor > 0.5:
        factors.append("shallow depth")
    if plate_distance_km is not None and plate_factor > 0.5:
        factors.append("proximity to plate boundary")
    if not factors:
        factors.append("baseline parameters")

    motion_note = ""
    if plate_motion_proxy_mm_yr is not None:
        motion_note = f" Relative plate motion proxy ~{plate_motion_proxy_mm_yr:.0f} mm/yr (near boundary)."
    why_radii = (
        f"Zone radii are derived from magnitude (M{magnitude:.1f}), "
        f"depth ({depth_km:.0f} km), and plate boundary proximity.{motion_note} "
        f"Amplification factor {amp:.2f} applied for shallow and plate effects."
    )
    caveat = (
        "Heuristic risk zones—not from full seismology models. "
        "Uncertainty is inherent; validate against official seismic hazard products (e.g. ShakeMap)."
    )

    explanation = {
        "why_radii": why_radii,
        "key_factors": factors,
        "caveat": caveat,
    }
    return damage_score, zones, confidence, explanation
