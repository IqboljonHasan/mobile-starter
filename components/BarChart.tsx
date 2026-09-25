import { Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import type { PeriodTotal } from "@/lib/stats";
import type { TxType } from "@/lib/types";

/**
 * Income vs. expense per period, as paired vertical bars — plain `View`s
 * rather than a charting library, matching how every other bar in this app
 * (`CategoryBreakdown`, a debt's progress bar) is drawn.
 *
 * Bar heights are relative to the tallest bar across the whole series, not to
 * each group's own total: reading "this month was bigger than that one" only
 * works if every group is measured against the same ruler.
 *
 * `only` draws a single series — a subcategory's trend has just one side to
 * show, and a row of empty partner bars would read as missing data.
 */
export default function BarChart({
	periods,
	height = 120,
	only,
}: {
	periods: PeriodTotal[];
	height?: number;
	only?: TxType;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();

	const showIncome = only !== "expense";
	const showExpense = only !== "income";
	const peak = Math.max(
		1,
		...periods.flatMap((p) => [showIncome ? p.income : 0, showExpense ? p.expense : 0]),
	);
	const barWidth = (periods.length > 8 ? 5 : 8) * (only ? 2 : 1);

	return (
		<View>
			<View
				className="flex-row items-end justify-between"
				style={{ height: height + 22 }}
			>
				{periods.map((period) => (
					<View key={period.key} className="items-center" style={{ flex: 1 }}>
						<View
							className="flex-row items-end"
							style={{ height, gap: 2 }}
							accessibilityLabel={`${period.label}: ${
								only === "income" ? "kirim" : only === "expense" ? "chiqim" : "kirim, chiqim"
							}`}
						>
							{showIncome && (
								<Bar
									value={period.income}
									peak={peak}
									height={height}
									width={barWidth}
									color={tc.success}
								/>
							)}
							{showExpense && (
								<Bar
									value={period.expense}
									peak={peak}
									height={height}
									width={barWidth}
									color={tc.danger}
								/>
							)}
						</View>
						<Text
							className="text-muted-foreground mt-1.5"
							style={{ fontSize: tf.xs }}
							numberOfLines={1}
						>
							{period.label}
						</Text>
					</View>
				))}
			</View>
			{!only && (
				<View className="flex-row items-center justify-center gap-4 mt-3">
					<Legend color={tc.success} label="Kirim" />
					<Legend color={tc.danger} label="Chiqim" />
				</View>
			)}
		</View>
	);
}

function Bar({
	value,
	peak,
	height,
	width,
	color,
}: {
	value: number;
	peak: number;
	height: number;
	width: number;
	color: string;
}) {
	// A real, nonzero value stays visible as a hairline even when it's tiny next
	// to the period's peak — a bar that vanishes reads as "no data", not "small".
	const barHeight = value > 0 ? Math.max((value / peak) * height, 3) : 0;
	return (
		<View
			style={{
				width,
				height: barHeight,
				borderRadius: width / 2,
				backgroundColor: color,
			}}
		/>
	);
}

function Legend({ color, label }: { color: string; label: string }) {
	const { tf } = useFont();
	return (
		<View className="flex-row items-center gap-1.5">
			<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
			<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
				{label}
			</Text>
		</View>
	);
}
