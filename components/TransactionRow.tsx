import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { formatDate } from "@/lib/date";
import { resolveCategory } from "@/lib/ledger";
import { formatAmount, maskAmount, methodByKey } from "@/lib/money";
import { walletColor, walletName } from "@/lib/wallets";
import type { Category, Transaction } from "@/lib/types";

/**
 * One line of the ledger. The amount carries the sign and the color — green for
 * money in, red for money out — and the label under the category is the
 * description, falling back to the date when there isn't one.
 */
export default function TransactionRow({
	transaction,
	categories,
	onPress,
	divider,
	showDate = false,
}: {
	transaction: Transaction;
	categories: Category[];
	onPress?: () => void;
	divider?: boolean;
	/** Show the date on the right — for lists that aren't already grouped by day. */
	showDate?: boolean;
}) {
	const { tf } = useFont();
	const { tc, isDark } = useTheme();
	const { hideIncome } = usePreferences();
	const { wallets } = useLedger();
	const { category, subcategory } = resolveCategory(transaction, categories);
	const income = transaction.type === "income";
	const hidden = income && hideIncome;
	const method = methodByKey(transaction.method);
	const paidFrom = !income && transaction.walletId
		? walletName(wallets, transaction.walletId)
		: null;
	const allocations = income ? transaction.allocations : [];

	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			className="active:opacity-70"
		>
			<View
				className={`flex-row items-center gap-3 px-4 py-3 ${
					divider ? "border-t border-border" : ""
				}`}
			>
				<CategoryAvatar
					icon={category?.icon ?? "help-outline"}
					color={category?.color ?? "blue"}
				/>
				<View className="flex-1">
					<Text
						className="font-medium text-foreground"
						style={{ fontSize: tf.base }}
						numberOfLines={1}
					>
						{category?.name ?? "Kategoriyasiz"}
						{subcategory ? (
							<Text className="text-muted-foreground">
								{"  ·  "}
								{subcategory.name}
							</Text>
						) : null}
					</Text>
					{/* The icon alone carries the payment method here — the word is
					    spelled out on the form and in the month's totals, and a row
					    has to stay readable at a glance. */}
					<View className="flex-row items-center gap-1.5">
						<Ionicons
							name={method.icon}
							size={12}
							color={tc.mutedForeground}
							accessibilityLabel={method.label}
						/>
						<Text
							className="flex-1 text-muted-foreground"
							style={{ fontSize: tf.sm }}
							numberOfLines={1}
						>
							{transaction.description || formatDate(transaction.date)}
						</Text>
						{/* Which jar paid. Colour alone would be a guess at this size, so
						    the name rides along and gives way first when space is short. */}
						{!!paidFrom && (
							<View
								className="flex-row items-center gap-1"
								style={{ maxWidth: "45%" }}
							>
								<View
									style={{
										width: 6,
										height: 6,
										borderRadius: 3,
										backgroundColor: categoryColorValue(
											walletColor(wallets, transaction.walletId),
											isDark,
										),
									}}
								/>
								<Text
									className="text-muted-foreground"
									style={{ fontSize: tf.xs }}
									numberOfLines={1}
								>
									{paidFrom}
								</Text>
							</View>
						)}
					</View>

					{/* How this income was divided, as the proportions themselves. The
					    figures are on the entry's own screen — a row has to survive five
					    jars without turning into a paragraph. */}
					{allocations.length > 0 && (
						<View
							className="flex-row gap-0.5 mt-1.5"
							style={{ height: 4 }}
							accessibilityLabel={`${allocations.length} ta hamyonga taqsimlangan`}
						>
							{allocations.map((allocation) => (
								<View
									key={allocation.walletId}
									style={{
										flex: Math.max(allocation.amount, 0.0001),
										backgroundColor: categoryColorValue(
											walletColor(wallets, allocation.walletId),
											isDark,
										),
										borderRadius: 2,
									}}
								/>
							))}
						</View>
					)}
				</View>
				<View className="items-end">
					<Text
						className={`font-bold ${income ? "text-success" : "text-danger"}`}
						style={{ fontSize: tf.base }}
						numberOfLines={1}
					>
						{income ? "+" : "−"}
						{hidden
							? maskAmount(transaction.unit)
							: formatAmount(transaction.amount, transaction.unit)}
					</Text>
					{showDate && (
						<Text
							className="text-muted-foreground"
							style={{ fontSize: tf.xs }}
						>
							{formatDate(transaction.date)}
						</Text>
					)}
				</View>
			</View>
		</Pressable>
	);
}
