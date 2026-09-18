import { Pressable, Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import type { CategorySlice } from "@/lib/ledger";
import { formatAmount } from "@/lib/money";

/**
 * Where the month's money went, as a ranked bar per category.
 *
 * Ranked bars rather than a pie: the question is "which categories are biggest,
 * and by how much", and length is read far more accurately than angle. Every
 * bar is directly labelled with its category and amount, so color is never the
 * only thing carrying identity — which is also what lets the lighter hues in
 * the palette be used at all.
 */
const MAX_ROWS = 6;

export default function CategoryBreakdown({
	slices,
	unit,
	onSelect,
}: {
	slices: CategorySlice[];
	unit: string;
	onSelect?: (categoryId: string) => void;
}) {
	const { isDark } = useTheme();
	const { tf } = useFont();

	// Past six rows the tail is noise; it's folded into one "Other" bar rather
	// than being dropped, so the bars still add up to the period's total.
	const head = slices.slice(0, MAX_ROWS);
	const tail = slices.slice(MAX_ROWS);
	const rows: CategorySlice[] = tail.length
		? [
				...head,
				{
					categoryId: "__other__",
					name: `Other (${tail.length})`,
					color: "blue",
					amount: tail.reduce((acc, s) => acc + s.amount, 0),
					share: tail.reduce((acc, s) => acc + s.share, 0),
					count: tail.reduce((acc, s) => acc + s.count, 0),
				},
			]
		: head;

	return (
		<View className="gap-3">
			{rows.map((slice) => {
				const hex = categoryColorValue(slice.color, isDark);
				const percent = slice.share < 0.01 ? "<1%" : `${Math.round(slice.share * 100)}%`;
				const interactive = !!onSelect && slice.categoryId !== "__other__";

				return (
					<Pressable
						key={slice.categoryId}
						accessibilityRole={interactive ? "button" : "text"}
						accessibilityLabel={`${slice.name}, ${formatAmount(slice.amount, unit)}, ${percent}`}
						disabled={!interactive}
						onPress={() => onSelect?.(slice.categoryId)}
						className={interactive ? "active:opacity-70" : undefined}
					>
						<View className="flex-row items-center gap-2">
							<View
								style={{
									width: 10,
									height: 10,
									borderRadius: 5,
									backgroundColor: hex,
								}}
							/>
							<Text
								className="flex-1 font-medium text-foreground"
								style={{ fontSize: tf.base }}
								numberOfLines={1}
							>
								{slice.name}
							</Text>
							<Text
								className="font-semibold text-foreground"
								style={{ fontSize: tf.base }}
								numberOfLines={1}
							>
								{formatAmount(slice.amount, unit)}
							</Text>
						</View>
						<View className="flex-row items-center gap-2 mt-1.5">
							<View
								className="flex-1 rounded-full bg-muted overflow-hidden"
								style={{ height: 8 }}
							>
								<View
									style={{
										// A zero-width bar reads as a rendering bug; a hairline
										// reads as "almost nothing", which is the truth.
										width: `${Math.max(slice.share * 100, 1.5)}%`,
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
			})}
		</View>
	);
}
