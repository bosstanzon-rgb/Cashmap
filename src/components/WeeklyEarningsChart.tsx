import { View } from "react-native";

/** Single row for Victory — y-values normalized 0–100 so earnings + km share one axis. */
export type WeeklyChartDatum = {
  i: number;
  dayLabel: string;
  e: number;
  k: number;
};

type Props = {
  data: WeeklyChartDatum[];
  /** Chart canvas height (labels live outside in parent). */
  height?: number;
};

/**
 * Weekly bar chart fallback using plain RN views (stable across Android builds).
 * Green = earnings index, teal = km index (same 0–100 scale).
 */
export function WeeklyEarningsVictoryChart({ data, height = 200 }: Props) {
  if (data.length === 0) return null;

  const bars = data.slice(0, 7);
  const rowHeight = Math.max(14, Math.floor((height - 16) / bars.length));

  return (
    <View style={{ height, width: "100%", gap: 4, paddingTop: 4 }}>
      {bars.map((d) => {
        const eFlex = Math.max(0.02, Math.min(1, d.e / 100));
        const kFlex = Math.max(0.02, Math.min(1, d.k / 100));
        return (
          <View key={d.i} style={{ height: rowHeight, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                flex: 1,
                height: Math.max(8, rowHeight - 4),
                borderRadius: 999,
                backgroundColor: "#242424",
                overflow: "hidden",
                flexDirection: "row",
              }}
            >
              <View style={{ flex: eFlex, backgroundColor: "rgba(0, 255, 157, 0.9)", borderRadius: 999 }} />
              <View style={{ flex: Math.max(0.02, 1 - eFlex) }} />
            </View>
            <View
              style={{
                flex: 1,
                height: Math.max(8, rowHeight - 4),
                borderRadius: 999,
                backgroundColor: "#242424",
                overflow: "hidden",
                flexDirection: "row",
              }}
            >
              <View style={{ flex: kFlex, backgroundColor: "rgba(0, 229, 255, 0.88)", borderRadius: 999 }} />
              <View style={{ flex: Math.max(0.02, 1 - kFlex) }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
