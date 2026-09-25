import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import BarChart from "@/components/BarChart";
import MonthSwitcher from "@/components/MonthSwitcher";
import YearSwitcher from "@/components/YearSwitcher";
import { SegmentedControl } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { currentMonthKey, currentYearKey, lastMonthKeys, lastYearKeys } from "@/lib/date";
import { inMonth, inYear, ofType } from "@/lib/ledger";
import { formatAmount, maskAmount } from "@/lib/money";
import {
	subcategoryBreakdown,
	subcategoryTrend,
	TREND_MONTHS,
	TREND_YEARS,
	type SubcategorySlice,
} from "@/lib/stats";
import type { Category, Transaction, TxType } from "@/lib/types";

type Span = "month" | "year";

/** Rows shown before the list asks to be expanded. */
const COLLAPSED_ROWS = 10;

/**
 * Every subcategory across every category, ranked by what it took in one
 * month or year — flat, so "Taksi" and "Non" compete directly instead of each
 * hiding inside its category's total. Tapping a row opens its trend over the
 * trailing months (or years) ending at the picked period, right under the row,
 * so whether a line of spending is growing is one tap from spotting it.
 *
 * `transactions` arrives already scoped to one unit and filtered for debts;
 * the period and type are chosen here.
 */
export default function SubcategoryStats({
	transactions,
	categories,
	unit,
	hideIncome,
}: {
	transactions: Transaction[];
	categories: Category[];
	unit: string;
	hideIncome: boolean;
}) {
	const { tf } = useFont();

	const [span, setSpan] = useState<Span>("month");
	const [month, setMonth] = useState(currentMonthKey);
	const [year, setYear] = useState(currentYearKey);
	const [type, setType] = useState<TxType>("expense");
	const [selected, setSelected] = useState<string | null>(null);
	const [expanded, setExpanded] = useState(false);

	const typed = useMemo(() => ofType(transactions, type), [transactions, type]);
	const rows = useMemo(() => {
		const inPeriod = span === "month" ? inMonth(typed, month) : inYear(typed, year);
		return subcategoryBreakdown(inPeriod, categories);
	}, [typed, span, month, year, categories]);

	// Ends at the picked period rather than today, so stepping back through
	// the months keeps the chart about the period being looked at.
	const periodKeys = useMemo(
		() => (span === "month" ? lastMonthKeys(TREND_MONTHS, month) : lastYearKeys(TREND_YEARS, year)),
		[span, month, year],
	);
	const trend = useMemo(
		() =>
			selected
				? subcategoryTrend(typed, categories, selected, span, periodKeys, type)
				: [],
		[typed, categories, selected, span, periodKeys, type],
	);

	const mask = type === "income" && hideIncome;
	const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
	const hiddenCount = rows.length - visible.length;

	return (
		<View>
			<SegmentedControl
				items={[
					{ key: "month", label: "Oylik" },
					{ key: "year", label: "Yillik" },
				]}
				value={span}
				onChange={(key) => setSpan(key as Span)}
				className="bg-muted mb-3"
			/>
			{span === "month" ? (
				<MonthSwitcher value={month} onChange={setMonth} />
			) : (
				<YearSwitcher value={year} onChange={setYear} />
			)}
			<SegmentedControl
				items={[
					{ key: "expense", label: "Chiqim" },
					{ key: "income", label: "Kirim" },
				]}
				value={type}
				onChange={(key) => {
					setType(key as TxType);
					setSelected(null);
				}}
				className="bg-muted mt-4 mb-4"
			/>

			{rows.length === 0 ? (
				<Text
					className="text-muted-foreground text-center py-6"
					style={{ fontSize: tf.base }}
				>
					{span === "month" ? "Bu oyda yozuv yo'q." : "Bu yilda yozuv yo'q."}
				</Text>
			) : (
				<View className="gap-3">
					{visible.map((row) => (
						<View key={row.key}>
							<Row
								row={row}
								unit={unit}
								mask={mask}
								active={row.key === selected}
								onPress={() => setSelected((prev) => (prev === row.key ? null : row.key))}
							/>
							{row.key === selected && (
								<Trend
									periods={trend}
									span={span}
									type={type}
									unit={unit}
									mask={mask}
								/>
							)}
						</View>
					))}
					{rows.length > COLLAPSED_ROWS && (
						<Pressable
							accessibilityRole="button"
							onPress={() => setExpanded((prev) => !prev)}
							className="items-center py-1 active:opacity-60"
						>
							<Text className="font-semibold text-primary" style={{ fontSize: tf.sm }}>
								{expanded ? "Kamroq ko'rsatish" : `Yana ${hiddenCount} tasini ko'rsatish`}
							</Text>
						</Pressable>
					)}
				</View>
			)}
		</View>
	);
}

function Row({
	row,
	unit,
	mask,
	active,
	onPress,
}: {
	row: SubcategorySlice;
	unit: string;
	mask: boolean;
	active: boolean;
	onPress: () => void;
}) {
	const { isDark } = useTheme();
	const { tf } = useFont();
	const hex = categoryColorValue(row.color, isDark);
	const percent = row.share < 0.01 ? "<1%" : `${Math.round(row.share * 100)}%`;
	const amountText = mask ? maskAmount(unit) : formatAmount(row.amount, unit);
	// Unfiled entries are named after their category, so the second line says
	// why they're here instead of repeating the name.
	const context = row.subcategoryId ? row.categoryName : "subkategoriyasiz";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ expanded: active }}
			accessibilityLabel={`${row.name}, ${context}, ${
				mask ? "yashirilgan" : formatAmount(row.amount, unit)
			}, ${percent}`}
			onPress={onPress}
			className="active:opacity-70"
		>
			<View className="flex-row items-center gap-2">
				<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hex }} />
				<View className="flex-1">
					<Text
						className={`font-medium ${active ? "text-primary" : "text-foreground"}`}
						style={{ fontSize: tf.base }}
						numberOfLines={1}
					>
						{row.name}
					</Text>
					<Text
						className="text-muted-foreground"
						style={{ fontSize: tf.xs }}
						numberOfLines={1}
					>
						{`${context} · ${row.count} ta`}
					</Text>
				</View>
				<Text
					className="font-semibold text-foreground"
					style={{ fontSize: tf.base }}
					numberOfLines={1}
				>
					{amountText}
				</Text>
			</View>
			<View className="flex-row items-center gap-2 mt-1.5">
				<View className="flex-1 rounded-full bg-muted overflow-hidden" style={{ height: 8 }}>
					<View
						style={{
							width: `${Math.max(row.share * 100, 1.5)}%`,
							height: 8,
							borderRadius: 4,
							backgroundColor: hex,
						}}
					/>
				</View>
				<Text
					className="text-muted-foreground text-right"
					style={{ fontSize: tf.xs, width: 38 }}
				>
					{percent}
				</Text>
			</View>
		</Pressable>
	);
}

function Trend({
	periods,
	span,
	type,
	unit,
	mask,
}: {
	periods: ReturnType<typeof subcategoryTrend>;
	span: Span;
	type: TxType;
	unit: string;
	mask: boolean;
}) {
	const { tf } = useFont();
	const values = periods.map((p) => (type === "income" ? p.income : p.expense));
	const total = values.reduce((acc, v) => acc + v, 0);
	// Averaged over every plotted period, empty ones included — a line of
	// spending that skips months really does cost less per month.
	const average = periods.length > 0 ? total / periods.length : 0;
	const show = (amount: number) => (mask ? maskAmount(unit) : formatAmount(amount, unit));
	const per = span === "month" ? "oyiga" : "yiliga";
	const across = span === "month" ? `${periods.length} oyda` : `${periods.length} yilda`;

	return (
		<View className="mt-3 p-3 rounded-2xl bg-muted">
			<BarChart periods={periods} only={type} height={90} />
			<View className="flex-row mt-3">
				<View className="flex-1">
					<Text className="text-muted-foreground" style={{ fontSize: tf.xs }}>
						{`Jami, ${across}`}
					</Text>
					<Text className="font-semibold text-foreground" style={{ fontSize: tf.sm }}>
						{show(total)}
					</Text>
				</View>
				<View className="flex-1 items-end">
					<Text className="text-muted-foreground" style={{ fontSize: tf.xs }}>
						{`O'rtacha ${per}`}
					</Text>
					<Text className="font-semibold text-foreground" style={{ fontSize: tf.sm }}>
						{show(average)}
					</Text>
				</View>
			</View>
		</View>
	);
}
