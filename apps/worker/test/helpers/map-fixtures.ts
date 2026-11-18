// Builders for map test fixtures: a district grid point and an air station.
import type { ConditionsPoint, NormalizedStation } from "../../src/types";

/** A district grid point with its weather. */
export const pt = (
  name: string,
  lat: number,
  lon: number,
  wx: ConditionsPoint["wx"],
  state?: string,
): ConditionsPoint => ({
  id: name,
  name,
  level: "district",
  source_layer: "x",
  lat,
  lon,
  state,
  wx,
});

/** An air station with its band and AQI. */
export const st = (id: string, lat: number, lon: number, band: NormalizedStation["band"], aqi: number) =>
  ({ id, name: id, city: id, lat, lon, band, aqi, pollutants: {}, provider: "cpcb" }) as unknown as NormalizedStation;
