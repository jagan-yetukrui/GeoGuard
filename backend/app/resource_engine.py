"""
Deterministic resource allocation from Resource_allocation_policy.json.
Computes resources required, shortages, deployment priority.
"""
from typing import Any

from app.patriotai_loader import get_resource_policy


def _zone_to_policy(zone_type: str) -> str:
    """Map GeoGuard zone levels to policy zoneType."""
    m = {"high": "red", "medium": "orange", "low": "green"}
    return m.get(zone_type, zone_type) if zone_type in m else zone_type


def _vulnerability_score(vuln: dict[str, float] | None) -> float:
    """Compute vulnerability_score from formula in policy."""
    if not vuln:
        return 0.0
    formula = "elderly_percent*0.25 + children_percent*0.2 + disability_percent*0.25 + poverty_index*0.15 + building_vulnerability_proxy*0.15"
    # Inputs: elderly_percent, children_percent, disability_percent, poverty_index, building_vulnerability_proxy
    e = vuln.get("elderly_percent", 0) or 0
    c = vuln.get("children_percent", 0) or 0
    d = vuln.get("disability_percent", 0) or 0
    p = vuln.get("poverty_index", 0) or 0
    b = vuln.get("building_vulnerability_proxy", 0) or 0
    return e * 0.25 + c * 0.2 + d * 0.25 + p * 0.15 + b * 0.15


def _vulnerability_level(score: float) -> str:
    """Map score to low/medium/high."""
    if score < 0.33:
        return "low"
    if score < 0.66:
        return "medium"
    return "high"


def _time_window(minutes: float) -> str:
    """Select deployment window key from time_since_event_minutes."""
    if minutes < 30:
        return "0_30_minutes"
    if minutes < 120:
        return "30_120_minutes"
    if minutes < 720:  # 12h
        return "2_12_hours"
    return "12_48_hours"


def calculate(
    zone_type: str,
    population_estimated: float,
    population_confidence: str,
    infra_counts: dict[str, int],
    hospital_beds_estimated: float,
    shelter_capacity_estimated: float,
    routes_available: int,
    damage_score: float,
    hotspot_score: float,
    time_since_event_minutes: float,
    vulnerability: dict[str, float] | None = None,
) -> dict[str, Any]:
    """
    Deterministic resource allocation from policy.
    Returns: resources_required, resources_available_proxy, shortages,
             recommended_actions, deployment_priority, confidence, uncertainty_notes
    """
    policy = get_resource_policy()
    alloc = policy.get("allocation_config", {})
    zone_mults = policy.get("zone_multipliers", {})
    vuln_adj = policy.get("vulnerability_adjustments", {})
    shortage_rules = policy.get("shortage_rules", {})
    deploy_rules = policy.get("deployment_prioritization_rules", {})

    zone_key = _zone_to_policy(zone_type)
    zm = zone_mults.get(zone_key, 1.0)

    vuln_score = _vulnerability_score(vulnerability)
    vuln_level = _vulnerability_level(vuln_score)
    vuln_mults = vuln_adj.get("multipliers", {})
    vm = vuln_mults.get(vuln_level, 1.0)

    pop = max(0, population_estimated)
    mult = zm * vm

    # Base allocation (per person/day or per N people)
    water = int(pop * (alloc.get("water_liters_per_person_per_day", 3) or 3) * mult)
    calories = int(pop * (alloc.get("calories_per_person_per_day", 2100) or 2100) * mult)
    medical_kits = max(1, int(pop / (alloc.get("medical_kits_per_people", 50) or 50)) * mult)
    blankets = max(1, int(pop / (alloc.get("blankets_per_people", 2) or 2)) * mult)
    shelter_spaces = int(pop * (alloc.get("shelter_space_per_person", 1) or 1) * mult)
    mobile_chargers = max(1, int(pop / (alloc.get("mobile_chargers_per_people", 100) or 100)) * mult)
    radios = max(1, int(pop / (alloc.get("radios_per_people", 250) or 250)) * mult)
    rescue_teams = max(1, int(pop / (alloc.get("rescue_teams_per_people", 5000) or 5000)) * mult)
    ambulances = max(1, int(pop / (alloc.get("ambulances_per_people", 20000) or 20000)) * mult)

    resources_required = {
        "water_liters_per_day": water,
        "calories_per_day": calories,
        "medical_kits": medical_kits,
        "blankets": blankets,
        "shelter_spaces": shelter_spaces,
        "mobile_chargers": mobile_chargers,
        "radios": radios,
        "rescue_teams": rescue_teams,
        "ambulances": ambulances,
    }

    # Resources available proxy: utilization = demand/capacity
    hospital_beds = max(0, hospital_beds_estimated)
    shelter_cap = max(0, shelter_capacity_estimated)
    # Demand proxy: ~2% injured need beds; shelter demand = shelter_spaces
    beds_demand = max(1, pop * 0.02)
    beds_util = beds_demand / hospital_beds if hospital_beds > 0 else 999.0
    shelter_util = shelter_spaces / shelter_cap if shelter_cap > 0 else 999.0

    def _avail(util: float, threshold: float) -> str:
        """util = demand/capacity. Over threshold = overflow/shortage."""
        if util <= 0:
            return "adequate"
        if util < threshold:
            return "adequate"
        if util < 1.0:
            return "moderate"
        return "insufficient"

    hosp_thresh = shortage_rules.get("hospital_overflow_threshold", 0.85) or 0.85
    shel_thresh = shortage_rules.get("shelter_overflow_threshold", 0.9) or 0.9

    resources_available_proxy = {
        "hospital_beds": _avail(beds_util, hosp_thresh) if hospital_beds > 0 else "unknown",
        "shelter_capacity": _avail(shelter_util, shel_thresh) if shelter_cap > 0 else "unknown",
        "routes_available": routes_available,
    }

    # Shortages: overflow when utilization exceeds threshold
    hosp_overflow = hospital_beds > 0 and beds_util > hosp_thresh
    shelter_overflow = shelter_cap > 0 and shelter_util > shel_thresh

    shortages = {
        "medical": hosp_overflow or (hospital_beds == 0 and pop > 0),
        "shelter": shelter_overflow or (shelter_cap == 0 and shelter_spaces > 0),
    }

    # Recommended actions
    recommended_actions: list[str] = []
    if shortages.get("medical"):
        recommended_actions.extend(
            shortage_rules.get("actions_on_hospital_overflow", [])
        )
    if shortages.get("shelter"):
        recommended_actions.extend(
            shortage_rules.get("actions_on_shelter_overflow", [])
        )
    if not recommended_actions:
        recommended_actions = ["monitor_conditions", "support_adjacent_zones_if_requested"]

    # Deployment priority
    window = _time_window(time_since_event_minutes)
    deployment_priority = deploy_rules.get(window, deploy_rules.get("12_48_hours", []))

    # Confidence
    conf_map = {"low": "low", "medium": "medium", "high": "high"}
    confidence = conf_map.get(population_confidence, "medium")

    # Uncertainty notes
    notes = []
    if population_confidence == "low":
        notes.append("Population estimates have high uncertainty.")
    if damage_score > 0.7:
        notes.append("Damage extent uncertain; infrastructure status may change.")
    if hotspot_score > 0.7:
        notes.append("Hotspot areas may require additional resources.")
    if not notes:
        notes.append("Moderate confidence in estimates.")

    main_keys = ["water_liters_per_day", "medical_kits", "shelter_spaces"]
    secondary_keys = ["calories_per_day", "blankets", "mobile_chargers", "radios", "rescue_teams", "ambulances"]

    return {
        "resources_required": resources_required,
        "main_needs": [k for k in main_keys if k in resources_required],
        "secondary_needs": [k for k in secondary_keys if k in resources_required],
        "resources_available_proxy": resources_available_proxy,
        "shortages": shortages,
        "recommended_actions": list(dict.fromkeys(recommended_actions)),
        "deployment_priority": deployment_priority,
        "confidence": confidence,
        "uncertainty_notes": " ".join(notes),
        "population_estimated": int(pop),
    }
