import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import AmountText from "@/components/AmountText";
import { Card } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { withAlpha } from "@/lib/categoryColors";
import { formatAmount } from "@/lib/money";
import type { PeriodSummary as Summary, Span } from "@/lib/stats";
import type { TxType } from "@/lib/types";

/**
 * Spending past this share of the income leaves less than a fifth of it
 * saved — the meter turns amber there, and red once spending passes income.
 */
const WARN_SHARE = 0.8;

/**
 * A month or a year in one card: what came in and went out, how much of the
 * income the spending took, what was left, and how it moved against the period
 * before. Home and Stats draw the same card, so the two can never disagree
 * about what a month did.
 *
 * Hidden income masks everything worked out from it — the net, the meter and
 * the income change — not just the income figure itself.
 */
export default function PeriodSummary({
	summary,
	unit,
	span,
	hideIncome,
	header,
	onPressSide,
}: {
	summary: Summary;
	unit: string;
	span: Span;
	hideIncome: boolean;
	/** Drawn above the totals — Home puts its month switcher here. */
	header?: ReactNode;
	/** Makes the income and expense tiles tappable. */
	onPressSide?: (type: TxType) => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { income, expense } = summary;
	const net = income - expense;
	const periodWord = span === "month" ? "oy" : "yil";
	const empty = summary.incomeCount + summary.expenseCount === 0;
	const average = span === "month" ? expense / summary.days : expense / summary.months;
	const compared =
		summary.expenseChange !== null || (!hideIncome && summary.incomeChange !== null);

	return (
		<Card>
			{header}
			<View className={`flex-row gap-3 ${header ? "mt-3" : ""}`}>
				<SideTile
					type="income"
					amount={income}
					count={summary.incomeCount}
					change={hideIncome ? null : summary.incomeChange}
					unit={unit}
					mask={hideIncome}
					onPress={onPressSide ? () => onPressSide("income") : undefined}
				/>
				<SideTile
					type="expense"
					amount={expense}
					count={summary.expenseCount}
					change={summary.expenseChange}
					unit={unit}
					mask={false}
					onPress={onPressSide ? () => onPressSide("expense") : undefined}
				/>
			</View>

			{empty ? (
				<Text className="text-muted-foreground text-center mt-4" style={{ fontSize: tf.sm }}>
					{`Bu ${periodWord}da hali yozuv yo'q`}
				</Text>
			) : (
				!hideIncome && income > 0 && <SpendMeter income={income} expense={expense} unit={unit} />
			)}

			<View className="h-px bg-border my-4" />

			<View className="gap-2.5">
				<View className="flex-row items-center justify-between gap-3">
					<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
						Sof qoldiq
					</Text>
					<AmountText
						amount={net}
						unit={unit}
						size={tf.lg}
						mask={hideIncome}
						signed
						color={hideIncome || net === 0 ? undefined : net > 0 ? tc.success : tc.danger}
					/>
				</View>
				<View className="flex-row items-center justify-between gap-3">
					<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
						{span === "month" ? "Kunlik o'rtacha chiqim" : "Oylik o'rtacha chiqim"}
					</Text>
					<AmountText amount={average} unit={unit} size={tf.base} />
				</View>
			</View>

			{compared && (
				<Text className="text-muted-foreground mt-3" style={{ fontSize: tf.xs }}>
					{summary.running
						? `Foizlar o'tgan ${periodWord}ning shu davriga nisbatan`
						: `Foizlar o'tgan ${periodWord}ga nisbatan`}
				</Text>
			)}
		</Card>
	);
}

function SideTile({
	type,
	amount,
	count,
	change,
	unit,
	mask,
	onPress,
}: {
	type: TxType;
	amount: number;
	count: number;
	change: number | null;
	unit: string;
	mask: boolean;
	onPress?: () => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const income = type === "income";
	const label = income ? "Kirim" : "Chiqim";
	const description = `${label}, ${mask ? "yashirilgan" : formatAmount(amount, unit)}, ${count} ta yozuv`;

	const body = (
		<>
			<View className="flex-row items-center gap-1.5">
				<Ionicons
					name={income ? "arrow-down-circle" : "arrow-up-circle"}
					size={18}
					color={income ? tc.success : tc.danger}
				/>
				<Text
					className="flex-1 font-medium text-muted-foreground"
					style={{ fontSize: tf.sm }}
					numberOfLines={1}
				>
					{label}
				</Text>
				{!!onPress && <Ionicons name="chevron-forward" size={14} color={tc.mutedForeground} />}
			</View>
			<AmountText
				amount={amount}
				unit={unit}
				size={tf.xl}
				mask={mask}
				fit
				style={{ marginTop: 6 }}
			/>
			<View className="flex-row items-center gap-2 mt-1.5">
				{change !== null && <ChangeBadge change={change} goodWhenUp={income} />}
				<Text
					className="flex-1 text-muted-foreground"
					style={{ fontSize: tf.xs }}
					numberOfLines={1}
				>
					{`${count} ta yozuv`}
				</Text>
			</View>
		</>
	);

	// A plain View when there's nothing to open: a disabled Pressable is
	// announced as a disabled button, which this isn't.
	return onPress ? (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={description}
			onPress={onPress}
			className="flex-1 rounded-xl bg-background p-3 active:opacity-70"
		>
			{body}
		</Pressable>
	) : (
		<View accessible accessibilityLabel={description} className="flex-1 rounded-xl bg-background p-3">
			{body}
		</View>
	);
}

/**
 * How a total moved, as an arrow and a percentage. Its color says whether
 * that's good news — more income is, more spending isn't — and the arrow
 * carries the direction on its own, so the color is never read alone.
 */
function ChangeBadge({ change, goodWhenUp }: { change: number; goodWhenUp: boolean }) {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const percent = Math.round(Math.abs(change) * 100);
	const flat = percent === 0;
	const up = change > 0;
	const color = flat ? tc.mutedForeground : up === goodWhenUp ? tc.success : tc.danger;

	return (
		<View
			accessibilityLabel={flat ? "o'zgarishsiz" : `${percent}% ${up ? "ko'proq" : "kamroq"}`}
			className="flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5"
			style={{ backgroundColor: withAlpha(color, isDark ? 0.22 : 0.14) }}
		>
			{!flat && <Ionicons name={up ? "arrow-up" : "arrow-down"} size={10} color={color} />}
			<Text className="font-semibold" style={{ fontSize: tf.xs, color }}>
				{percent > 999 ? "999+%" : `${percent}%`}
			</Text>
		</View>
	);
}

/** How much of the income the spending took — the one ratio a budget is about. */
function SpendMeter({ income, expense, unit }: { income: number; expense: number; unit: string }) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const share = expense / income;
	const over = expense > income;
	const tone = over ? tc.danger : share > WARN_SHARE ? tc.warning : tc.success;
	const percent = Math.round(share * 100);

	return (
		<View className="mt-4">
			<View className="rounded-full overflow-hidden" style={{ height: 8, backgroundColor: tc.muted }}>
				<View
					style={{
						// Something spent stays visible as a sliver, never as an empty track.
						width: `${expense > 0 ? Math.max(Math.min(share, 1) * 100, 2) : 0}%`,
						height: 8,
						borderRadius: 4,
						backgroundColor: tone,
					}}
				/>
			</View>
			<Text className="text-muted-foreground mt-2" style={{ fontSize: tf.sm }}>
				{over ? (
					<>
						{"Kirimdan "}
						<Text className="font-semibold text-danger">
							{formatAmount(expense - income, unit)}
						</Text>
						{" ko'p sarflandi"}
					</>
				) : (
					<>
						{"Kirimning "}
						<Text className="font-semibold text-foreground">
							{expense > 0 && percent === 0 ? "<1%" : `${percent}%`}
						</Text>
						{" qismi sarflandi"}
					</>
				)}
			</Text>
		</View>
	);
}
