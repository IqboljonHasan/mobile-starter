import { Pressable, View } from "react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import WalletIcon from "@/components/WalletIcon";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { formatDate } from "@/lib/date";
import { resolveCategory } from "@/lib/ledger";
import { formatAmount, maskAmount } from "@/lib/money";
import { UNALLOCATED_ID, walletById, walletColor, walletName } from "@/lib/wallets";
import type { Category, Transaction } from "@/lib/types";

/**
 * One line of the ledger: what it was (subcategory, then its category, dimmed),
 * the note under it, and the amount on the right — green with a "+" for money
 * in, ink with a "−" for money out.
 *
 * Under the amount sits where the money went: an income's split as a bar of
 * its wallets' colours in proportion, an expense's wallet as its little tile.
 * The figures themselves are on the entry's own screen — a row has to survive
 * five jars without turning into a paragraph.
 */
export default function TransactionRow({
	transaction,
	categories,
	onPress,
	divider,
	showDate = false,
	amountOverride,
}: {
	transaction: Transaction;
	categories: Category[];
	onPress?: () => void;
	divider?: boolean;
	/** Show the date under the amount — for lists that aren't grouped by day. */
	showDate?: boolean;
	/** Shown in place of the entry's amount — one wallet's share of an income,
	 *  when the list is narrowed to that wallet. */
	amountOverride?: number;
}) {
	const { tf } = useFont();
	const { tc, isDark } = useTheme();
	const { hideIncome } = usePreferences();
	const { wallets, defaultUnit } = useLedger();
	const handlePress = useGuardedPress(onPress);
	const { category, subcategory } = resolveCategory(transaction, categories);
	const income = transaction.type === "income";
	const hidden = income && hideIncome;
	const amount = amountOverride ?? transaction.amount;

	const allocations = income ? transaction.allocations : [];
	// An income that wasn't split names the one wallet it landed in instead.
	const singleWalletId = income
		? allocations.length === 0
			? transaction.walletId
			: null
		: transaction.walletId;
	const singleWallet =
		singleWalletId === UNALLOCATED_ID
			? { icon: null, color: "blue" }
			: walletById(wallets, singleWalletId);

	const title = subcategory?.name ?? category?.name ?? "Kategoriyasiz";
	const amountText = `${income ? "+" : "−"}${
		hidden
			? maskAmount(transaction.unit)
			: // The main currency goes bare; any other keeps its symbol.
				formatAmount(amount, transaction.unit, { showUnit: transaction.unit !== defaultUnit })
	}`;

	// What the eye takes from the colours, spelled out for a screen reader.
	const walletText =
		allocations.length > 0
			? `${allocations.length} ta hamyonga taqsimlangan`
			: singleWalletId
				? `${walletName(wallets, singleWalletId)} ${income ? "hamyoniga" : "hamyonidan"}`
				: "";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={[
				title,
				subcategory && category ? category.name : null,
				transaction.description || null,
				`${income ? "kirim" : "chiqim"} ${hidden ? "yashirilgan" : formatAmount(amount, transaction.unit)}`,
				walletText || null,
			]
				.filter(Boolean)
				.join(", ")}
			onPress={handlePress}
			className="active:opacity-70"
		>
			<View
				className={`flex-row items-center gap-3 py-2.5 ${divider ? "border-t border-border" : ""}`}
				style={{ minHeight: 64 }}
			>
				<CategoryAvatar
					icon={category?.icon ?? "help-outline"}
					color={category?.color ?? "blue"}
					mono
				/>
				<View className="flex-1 gap-px">
					<Text
						className="font-bold text-foreground"
						style={{ fontSize: tf.base }}
						numberOfLines={1}
					>
						{title}
						{subcategory && category ? (
							<Text className="font-semibold text-muted-foreground">{` / ${category.name}`}</Text>
						) : null}
					</Text>
					{!!transaction.description && (
						<Text
							className="font-semibold text-muted-foreground"
							style={{ fontSize: tf.sm - 0.5 }}
							numberOfLines={1}
						>
							{transaction.description}
						</Text>
					)}
				</View>
				<View className="items-end" style={{ gap: 5 }}>
					<Text
						className="font-extrabold"
						style={{ fontSize: tf.base, color: income ? tc.success : tc.foreground }}
						numberOfLines={1}
					>
						{amountText}
					</Text>
					{allocations.length > 0 ? (
						<View className="flex-row self-stretch" style={{ height: 4, gap: 2 }}>
							{allocations.map((allocation) => (
								<View
									key={allocation.walletId}
									style={{
										flexGrow: Math.max(allocation.amount, 0.0001),
										flexBasis: 0,
										minWidth: 3,
										borderRadius: 2,
										backgroundColor:
											allocation.walletId === UNALLOCATED_ID
												? tc.disabled
												: categoryColorValue(walletColor(wallets, allocation.walletId), isDark),
									}}
								/>
							))}
						</View>
					) : singleWallet ? (
						<WalletIcon icon={singleWallet.icon} color={singleWallet.color} size={20} />
					) : null}
					{showDate && (
						<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.xs }}>
							{formatDate(transaction.date)}
						</Text>
					)}
				</View>
			</View>
		</Pressable>
	);
}
