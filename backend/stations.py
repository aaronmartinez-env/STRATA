"""
stations.py
-----------
Valencia RVVCCA station registry, shared by the FastAPI proxy.

This is intentionally kept in sync with src/rvvcca_ingestion_hourly.py's
VALENCIA_STATIONS — same station codes, names, and coordinates, verified
against rvvcca.pica.gva.es/es/estacion/ pages. If the pipeline's station
list changes, update both places (or, as a later refactor, have the
pipeline import from here instead of duplicating).
"""

VALENCIA_STATIONS = {
    "46250047": {"name": "Avda. Francia",   "lat": 39.45750, "lon": -0.34270},
    "46250046": {"name": "Politecnico",     "lat": 39.47962, "lon": -0.33741},
    "46250030": {"name": "Pista Silla",     "lat": 39.45806, "lon": -0.37665},
    "46250043": {"name": "Viveros",         "lat": 39.47949, "lon": -0.36955},
    "46250048": {"name": "Molino del Sol",  "lat": 39.48114, "lon": -0.40856},
    "46250050": {"name": "Bulevar Sur",     "lat": 39.45038, "lon": -0.39631},
    "46250301": {"name": "Puerto Moll Trans. Ponent", "lat": 39.4510, "lon": -0.3190},
}


def station_list() -> list[dict]:
    """Return stations as a JSON-friendly list for the /api/stations endpoint."""
    return [
        {"code": code, **info}
        for code, info in VALENCIA_STATIONS.items()
    ]
