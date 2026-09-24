import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import ContactAvatar from "@/components/ContactAvatar";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { formatDate } from "@/lib/date";
import {
	DIRECTION_META,
	daysUntilDue,
	debtStatus,
	paidShare,
	remainingAmount,
} from "@/lib/debts";
import { formatAmount } from "@/lib/money";
import type { Contact, Debt } from "@/lib/types";

/**
 * One debt in the list.
 *
 * The figure on the right is what is still outstanding, not the principal:
 * "how much of this is left" is the question the tab exists to answer, and the
 * original amount is one tap away on the debt's own screen. The bar underneath
 * shows how far along it is, so a debt mostly paid off reads differently from
 * one untouched even though both are still open.
 */
export default function DebtRow({
	debt,
	contact,
	today,
	onPress,
	divider,
}: {
	debt: Debt;
	/** Null once the person has been deleted — the debt still stands. */
	contact: Contact | null;
	/** "YYYY-MM-DD", passed in so a long list doesn't ask for it per row. */
	today: string;
	onPress?: () => void;
	divider?: boolean;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();

	const meta = DIRECTION_META[debt.direction];
	const status = debtStatus(debt, today);
	const remaining = remainingAmount(debt);
	const share = paidShare(debt);
	const days = daysUntilDue(debt, today);
	const name = contact?.name ?? "Noma'lum";

	// Money owed *to* the user reads as something coming back, money owed *by*
	// them as something going out — the same green/red the ledger uses.
	const amountClass =
		status === "settled"
			? "text-muted-foreground"
			: debt.direction === "lent"
				? "text-success"
				: "text-danger";

	const due =
		status === "settled"
			? "Yopilgan"
			: days === null
				? debt.description || formatDate(debt.date)
				: days < 0
					? `${Math.abs(days)} kun kechikdi`
					: days === 0
						? "Bugun muddati"
						: `${days} kun qoldi`;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${name}, ${meta.label}, qoldiq ${formatAmount(remaining, debt.unit)}`}
			onPress={onPress}
			className="active:opacity-70"
		>
			<View
				className={`flex-row items-center gap-3 px-4 py-3 ${
					divider ? "border-t border-border" : ""
				}`}
			>
				<ContactAvatar name={name} id={debt.contactId} />

				<View className="flex-1">
					<View className="flex-row items-center gap-1.5">
						<Ionicons
							name={meta.icon}
							size={13}
							color={
								debt.direction === "lent" ? tc.success : tc.danger
							}
							accessibilityLabel={meta.label}
						/>
						<Text
							className="flex-1 font-medium text-foreground"
							style={{ fontSize: tf.base }}
							numberOfLines={1}
						>
							{name}
						</Text>
					</View>

					<Text
						className={
							status === "overdue" ? "text-danger" : "text-muted-foreground"
						}
						style={{ fontSize: tf.sm }}
						numberOfLines={1}
					>
						{due}
					</Text>

					{/* Only while something is still owed: a full bar under a settled
					    debt says nothing the amount above it hasn't already said. */}
					{status !== "settled" && share > 0 && (
						<View
							className="rounded-full bg-muted mt-1.5 overflow-hidden"
							style={{ height: 4 }}
							accessibilityLabel={`${Math.round(share * 100)}% to'langan`}
						>
							<View
								style={{
									width: `${Math.round(share * 100)}%`,
									height: "100%",
									borderRadius: 2,
									backgroundColor: tc.primary,
								}}
							/>
						</View>
					)}
				</View>

				<View className="items-end">
					<Text
						className={`font-bold ${amountClass}`}
						style={{ fontSize: tf.base }}
						numberOfLines={1}
					>
						{status === "settled"
							? formatAmount(debt.amount, debt.unit)
							: formatAmount(remaining, debt.unit)}
					</Text>
					{status === "settled" ? (
						<View className="flex-row items-center gap-1 mt-0.5">
							<Ionicons name="checkmark-circle" size={12} color={tc.success} />
							<Text className="text-success" style={{ fontSize: tf.xs }}>
								Yopildi
							</Text>
						</View>
					) : share > 0 ? (
						<Text className="text-muted-foreground" style={{ fontSize: tf.xs }}>
							{`${formatAmount(debt.amount, debt.unit)} dan`}
						</Text>
					) : null}
				</View>
			</View>
		</Pressable>
	);
}
