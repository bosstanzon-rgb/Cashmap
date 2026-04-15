import { View, Text } from "react-native";

/** Single row for the chart — y-values normalized 0–100 so earnings + km share one axis. */
export type WeeklyChartDatum = {
  i: number;
  dayLabel: string;
  e: number;
  k: number;
};

type Props = {
  data: WeeklyChartDatum[];
  height?: number;
};

/**
 * Modern vertical grouped bar chart.
 * Green = earnings index, cyan = km index (both 0–100 scale).
 */
export function WeeklyEarningsVictoryChart({ data, height = 200 }: Props) {
  if (data.length === 0) return null;

  const bars = data.slice(0, 7);
  const chartHeight = height - 28;

  return (
    <View style={{ height, width: "100%", paddingTop: 8 }}>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          height: chartHeight,
          paddingHorizontal: 2,
        }}
      >
        {bars.map((d) => {
          const eH = Math.max(4, (d.e / 100) * chartHeight);
          const kH = Math.max(4, (d.k / 100) * chartHeight);
          const isToday = d.i === bars.length - 1;
          return (
            <View
              key={d.i}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-end",
                height: chartHeight,
                marginHorizontal: 2,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, width: "100%", justifyContent: "center" }}>
                <View
                  style={{
                    flex: 1,
                    height: eH,
                    borderRadius: 4,
                    backgroundColor: isToday ? "rgba(0,255,157,1)" : "rgba(0,255,157,0.65)",
                    shadowColor: "#00FF9D",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: isToday ? 0.7 : 0,
                    shadowRadius: 10,
                    elevation: isToday ? 4 : 0,
                  }}
                />
                <View
                  style={{
                    flex: 1,
                    height: kH,
                    borderRadius: 4,
                    backgroundColor: isToday ? "rgba(0,229,255,1)" : "rgba(0,229,255,0.55)",
                    shadowColor: "#00E5FF",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: isToday ? 0.6 : 0,
                    shadowRadius: 10,
                    elevation: isToday ? 3 : 0,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "rgba(0,255,157,0.9)" }} />
          <Text style={{ fontSize: 11, color: "#AAAAAA" }}>Earnings</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "rgba(0,229,255,0.85)" }} />
          <Text style={{ fontSize: 11, color: "#AAAAAA" }}>Km driven</Text>
        </View>
      </View>
    </View>
  );
}
