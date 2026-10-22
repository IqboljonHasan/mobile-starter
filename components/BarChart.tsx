import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { currentMonthKey, monthTitle } from "@/lib/date";
import { formatAmount } from "@/lib/money";
import type { PeriodTotal } from "@/lib/stats";
import type { TxType } from "@/lib/types";

/**
 * Income vs. expense per month, as paired vertical bars — plain `View`s
 * rather than a charting library, matching how every other bar in this app
 * (`StatRow`, a debt's progress bar) is drawn.
 *
 * Bar heights are relative to the tallest bar across the whole series, not to
 * each group's own total: reading "this month was bigger than that one" only
 * works if every group is measured against the same ruler.
 *
 * With `onSelect` every column is also a button: the chart is how the Stats
 * screen moves between months, and the picked one is highlighted in place.
 * Months still ahead (the rest of a running year) are drawn faded and can't
 * be picked — there's nothing to look at there yet.
 */
export default function BarChart({
	periods,
	unit,
	hideIncome = false,
	height = 120,
	focus = null,
	onFocusChange,
	selected = null,
	onSelect,
}: {
	/** Month keys, oldest first. */
	periods: PeriodTotal[];
	/** What the amounts are in — read out to screen readers, never drawn. */
	unit: string;
	hideIncome?: boolean;
	height?: number;
	/** Draws only this side. Null draws both. */
	focus?: TxType | null;
	/** Makes the legend tappable: a tap isolates that side, a second tap
	 *  brings the other back. */
	onFocusChange?: (focus: TxType | null) => void;
	/** The month to highlight. */
	selected?: string | null;
	/** Makes each column pick its month. */
	onSelect?: (key: string) => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const now = currentMonthKey();

	const showIncome = focus !== "expense";
	const showExpense = focus !== "income";
	// Measured against what is drawn, so an isolated side fills the chart
	// instead of staying as short as it was beside a taller neighbor.
	const peak = Math.max(
		1,
		...periods.flatMap((p) => [showIncome ? p.income : 0, showExpense ? p.expense : 0]),
	);
	const barWidth = (periods.length > 8 ? 5 : 8) * (focus ? 2 : 1);
	const toggle = (side: TxType) => onFocusChange?.(focus === side ? null : side);

	return (
		<View>
			<View className="flex-row items-end" style={{ gap: 2 }}>
				{periods.map((period) => {
					const active = period.key === selected;
					const ahead = period.key > now;
					const income = hideIncome ? "yashirilgan" : formatAmount(period.income, unit);
					return (
						<Pressable
							key={period.key}
							accessibilityRole={onSelect ? "button" : undefined}
							accessibilityState={onSelect ? { selected: active, disabled: ahead } : undefined}
							accessibilityLabel={`${monthTitle(period.key)}: kirim ${income}, chiqim ${formatAmount(period.expense, unit)}`}
							disabled={!onSelect || ahead}
							onPress={() => {
								Haptics.selectionAsync();
								onSelect?.(period.key);
							}}
							className="flex-1 items-center rounded-xl pt-2 pb-1.5 active:opacity-60"
							style={{ backgroundColor: active ? tc.primaryHighlight : "transparent" }}
						>
							<View className="flex-row items-end" style={{ height, gap: 2 }}>
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
								className={`mt-1.5 ${active ? "font-bold" : ""}`}
								style={{
									fontSize: tf.xs,
									color: active ? tc.primary : tc.mutedForeground,
									opacity: ahead ? 0.4 : 1,
								}}
								numberOfLines={1}
							>
								{period.label}
							</Text>
						</Pressable>
					);
				})}
			</View>
			<View className="flex-row items-center justify-center gap-4 mt-3">
				<Legend
					color={tc.success}
					label="Kirim"
					dimmed={!showIncome}
					onPress={onFocusChange ? () => toggle("income") : undefined}
				/>
				<Legend
					color={tc.danger}
					label="Chiqim"
					dimmed={!showExpense}
					onPress={onFocusChange ? () => toggle("expense") : undefined}
				/>
			</View>
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

function Legend({
	color,
	label,
	dimmed,
	onPress,
}: {
	color: string;
	label: string;
	dimmed: boolean;
	onPress?: () => void;
}) {
	const { tf } = useFont();
	return (
		<Pressable
			accessibilityRole={onPress ? "button" : "text"}
			accessibilityState={onPress ? { selected: !dimmed } : undefined}
			disabled={!onPress}
			onPress={onPress}
			hitSlop={8}
			className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${
				onPress ? "bg-muted active:opacity-60" : ""
			}`}
			style={{ opacity: dimmed ? 0.4 : 1 }}
		>
			<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
			<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
				{label}
			</Text>
		</Pressable>
	);
}
