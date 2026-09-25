import { Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import type { StackedPeriod } from "@/lib/stats";

/**
 * One stacked column per period, a segment per tracked row, bottom-up in rank
 * order — plain `View`s like `BarChart`, and measured against one ruler (the
 * tallest column in the series) for the same reason.
 *
 * `focus` draws a single row's segments alone, rescaled to that row's own
 * peak: a small line of spending would otherwise be a sliver at the foot of
 * every column, too thin to show whether it's growing.
 */
export default function StackedBarChart({
	periods,
	colors,
	focus = null,
	height = 120,
}: {
	periods: StackedPeriod[];
	/** Resolved color per segment key. */
	colors: Record<string, string>;
	focus?: string | null;
	height?: number;
}) {
	const { tf } = useFont();

	const visible = periods.map((period) =>
		focus ? period.segments.filter((s) => s.key === focus) : period.segments,
	);
	const peak = Math.max(1, ...visible.map((segments) => total(segments)));
	const barWidth = periods.length > 8 ? 12 : 20;

	return (
		<View className="flex-row items-end justify-between" style={{ height: height + 22 }}>
			{periods.map((period, i) => {
				const segments = visible[i];
				const columnTotal = total(segments);
				// A real, nonzero total stays visible as a hairline next to the
				// peak — a column that vanishes reads as "no data", not "small".
				const columnHeight = columnTotal > 0 ? Math.max((columnTotal / peak) * height, 3) : 0;

				return (
					<View key={period.key} className="items-center" style={{ flex: 1 }}>
						<View style={{ height, justifyContent: "flex-end" }}>
							<View
								accessibilityLabel={period.label}
								style={{
									width: barWidth,
									height: columnHeight,
									borderTopLeftRadius: 4,
									borderTopRightRadius: 4,
									overflow: "hidden",
									// Column-reverse puts the first (largest) row at the bottom,
									// where the eye compares columns from.
									flexDirection: "column-reverse",
								}}
							>
								{segments.map((segment) =>
									segment.amount > 0 ? (
										<View
											key={segment.key}
											style={{
												flexGrow: segment.amount,
												flexBasis: 0,
												backgroundColor: colors[segment.key],
											}}
										/>
									) : null,
								)}
							</View>
						</View>
						<Text
							className="text-muted-foreground mt-1.5"
							style={{ fontSize: tf.xs }}
							numberOfLines={1}
						>
							{period.label}
						</Text>
					</View>
				);
			})}
		</View>
	);
}

function total(segments: { amount: number }[]): number {
	return segments.reduce((acc, s) => acc + s.amount, 0);
}
