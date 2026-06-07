"""
events.py
---------
Event detection for Strata — adapted for daily resolution data.

Two event types:
  1. Calima (Saharan dust intrusion) — dual criterion, 7-day rolling window
  2. DANA (flood-derived terrestrial dust) — targets Oct 29 – Dec 15 2024

Resolution note:
  - 2021-2022: hourly data, 72-hour rolling window
  - 2024:      daily averages, 7-day rolling window (longer window needed
               because daily data has fewer points and more gaps per station;
               min_periods=3 ensures baseline forms even with some NaN days)

Fix applied 2026-06-07:
  - Increased window from 3 to 7 days and min_periods from 2 to 3
  - Added absolute PM10 threshold fallback (> 50 µg/m³ daily avg) so extreme
    events like the 162 µg/m³ Centro reading are not missed when the rolling
    baseline is suppressed by data gaps
  - DANA detection now has its own PM10 spike criterion independent of
    calima's pm10_spike column, so it fires even when calima does not
"""

import pandas as pd
import numpy as np


def detect_calima_events(df: pd.DataFrame, window: int = 7) -> pd.DataFrame:
    """
    Detect Saharan dust (calima) intrusion events.

    Dual criterion per station-day:
      1. Rolling spike: PM10 > (7-day rolling mean + 1.5σ)
         OR absolute threshold: PM10 > 50 µg/m³ daily average
         (WHO 24h guideline is 45 µg/m³ — 50 is a conservative event threshold)
      2. Dust ratio: PM10 / PM2.5 > 3.0

    Both must be true simultaneously.

    Parameters
    ----------
    df     : DataFrame with pm10, pm25, datetime, station columns
    window : Rolling baseline window in days (default 7)
    """
    df = df.copy()
    df = df.sort_values(["station", "datetime"]).reset_index(drop=True)

    # Dust ratio — handle missing PM2.5 gracefully
    df["dust_ratio"] = df["pm10"] / (df["pm25"].fillna(df["pm10"] * 0.4) + 1e-6)

    # Rolling baseline per station
    grp = df.groupby("station")["pm10"]
    df["_pm10_roll_mean"] = grp.transform(
        lambda x: x.rolling(window=window, min_periods=3).mean()
    )
    df["_pm10_roll_std"] = grp.transform(
        lambda x: x.rolling(window=window, min_periods=3).std().fillna(3.0)
    )

    # Rolling spike criterion
    roll_threshold = df["_pm10_roll_mean"] + 1.5 * df["_pm10_roll_std"]
    rolling_spike  = df["pm10"] > roll_threshold

    # Absolute threshold fallback — catches extreme events when rolling
    # baseline hasn't stabilised (e.g. data gaps, start of series)
    absolute_spike = df["pm10"] > 50.0

    df["pm10_spike"]   = rolling_spike | absolute_spike
    df["dust_event"]   = df["dust_ratio"] > 3.0
    df["calima_event"] = df["pm10_spike"] & df["dust_event"]

    df.drop(columns=["_pm10_roll_mean", "_pm10_roll_std"], inplace=True)

    n_events = int(df["calima_event"].sum())
    n_days   = int(df[df["calima_event"]]["datetime"].dt.date.nunique()) if n_events > 0 else 0
    print(f"  Calima events detected: {n_events} station-days "
          f"({n_days} unique dates, {n_events/len(df)*100:.1f}% of records)")

    if n_events > 0:
        top = (df[df["calima_event"]]
               .groupby(df[df["calima_event"]]["datetime"].dt.date)["pm10"]
               .max().nlargest(3))
        for date, pm10 in top.items():
            print(f"    {date}: max PM10 = {pm10:.1f} µg/m³")

    return df


def detect_dana_events(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detect DANA (Depresión Aislada en Niveles Altos) flood-derived dust events.

    The October 29, 2024 DANA flood created a distinct dust resuspension
    signature from flood-derived terrestrial sediment — different from Saharan
    calima in origin and wind pattern, but similar in PM10 spike + dust ratio.

    Detection criterion (independent of calima pm10_spike):
      - Date within Oct 29 – Dec 15, 2024
      - PM10 > 30 µg/m³ daily average (lower threshold than calima — flood
        resuspension may be less intense than peak Saharan events)
      - PM10 / PM2.5 > 2.5 (slightly relaxed vs calima's 3.0)
      - NOT already classified as calima (Saharan takes precedence)

    Parameters
    ----------
    df : DataFrame with pm10, pm25, datetime, calima_event columns
    """
    df = df.copy()

    DANA_START = pd.Timestamp("2024-10-29")
    DANA_END   = pd.Timestamp("2024-12-15")

    if "datetime" not in df.columns:
        df["dana_event"] = False
        return df

    dt = pd.to_datetime(df["datetime"])
    in_window = (dt >= DANA_START) & (dt <= DANA_END)

    # Independent dust ratio — don't rely on calima's pm10_spike
    pm25_fill  = df["pm25"].fillna(df["pm10"] * 0.4)
    dust_ratio = df["pm10"] / (pm25_fill + 1e-6)

    elevated_pm10 = df["pm10"] > 30.0
    high_ratio    = dust_ratio > 2.5
    not_calima    = ~df["calima_event"] if "calima_event" in df.columns else pd.Series(True, index=df.index)

    df["dana_event"] = in_window & elevated_pm10 & high_ratio & not_calima

    n_dana = int(df["dana_event"].sum())
    if n_dana > 0:
        dana_dates = df[df["dana_event"]]["datetime"].dt.date.unique()
        print(f"  DANA events detected: {n_dana} station-days "
              f"({len(dana_dates)} unique dates)")
        print(f"    Window: {DANA_START.date()} → {DANA_END.date()}")
        top = (df[df["dana_event"]]
               .groupby(df[df["dana_event"]]["datetime"].dt.date)["pm10"]
               .max().nlargest(3))
        for date, pm10 in top.items():
            print(f"    {date}: max PM10 = {pm10:.1f} µg/m³")
    else:
        # Report what we actually saw in the DANA window to help diagnose
        window_data = df[in_window]
        if len(window_data) > 0:
            pm10_in_window = window_data["pm10"].dropna()
            print(f"  DANA events: 0 detected")
            print(f"    Window had {len(window_data)} station-days · "
                  f"PM10 range: {pm10_in_window.min():.1f}–{pm10_in_window.max():.1f} µg/m³")
            print(f"    Rows with PM10 > 30: {(pm10_in_window > 30).sum()}")
        else:
            print(f"  DANA events: 0 — no data in Oct 29–Dec 15 window")

    return df
