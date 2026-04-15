/**
 * CashMap MVP — what Pro unlocks vs Free.
 * Used for paywall copy and in-app teasers; keep in sync with `proStore` + `locationTasks` + `alerts`.
 */
export const PRO_FEATURES = {
  /** Exact driver counts on map markers & zone details */
  exactDriverCounts: "exact_driver_counts",
  /** Min–max R/hr on map and prediction cards */
  detailedRphPredictions: "detailed_rph",
  /** Zone, weather, battery, app-switch alerts — higher daily cap */
  smartAlerts: "smart_alerts",
  /** “vs other drivers” style benchmarks on Earnings */
  benchmarking: "benchmarking",
  /** Background GPS mileage when “I’m Working” is on */
  autoMileageTracking: "auto_mileage",
} as const;

/** Free tier: rough heatmap zones, limited prediction rows, manual shift logging, basic alerts cap. */
export const FREE_TIER_SUMMARY =
  "Free: basic heatmap, rough zones, manual earnings logging, limited alerts.";
