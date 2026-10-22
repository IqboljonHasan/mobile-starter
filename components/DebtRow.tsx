import { Pressable, View } from "react-native";
import ContactAvatar from "@/components/ContactAvatar";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useTheme } from "@/hooks/useTheme";
import { formatDayMonth } from "@/lib/date";
import { debtStatus, paidShare, remainingAmount } from "@/lib/debts";
import { formatAmount } from "@/lib/money";
import type { Contact, Debt } from "@/lib/types";

/**
 * One debt in the list.
 *
 * The figure on the right is what is still outstanding, not the principal:
 * "how much of this is left" is the question the screen exists to answer, and
 * the original amount is one tap away on the debt's own screen. A bar shows
 * how much has come back so far, so a debt mostly paid off reads differently
 * from one untouched even though both are still open.
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
	const { defaultUnit } = useLedger();
	const handlePress = useGuardedPress(onPress);
	// The main currency goes bare, as everywhere in the lists; any other keeps
	// its symbol so a dollar loan never reads as som.
	const money = { showUnit: debt.unit !== defaultUnit };

	const status = debtStatus(debt, today);
	const remaining = remainingAmount(debt);
	const share = paidShare(debt);
	const name = contact?.name ?? "Noma'lum";
	const given = debt.direction === "lent";
	const settled = status === "settled";

	// The day the last of it came back — what "closed" is dated by.
	const closedOn = settled
		? debt.payments.reduce((latest, p) => (p.date > latest ? p.date : latest), debt.date)
		: null;

	const sub = settled
		? `Yopilgan · ${formatDayMonth(closedOn ?? debt.date)}`
		: status === "overdue" && debt.dueDate
			? `Muddati o'tgan · ${formatDayMonth(debt.dueDate)}`
			: debt.dueDate
				? `Muddat: ${formatDayMonth(debt.dueDate)}`
				: "Muddat belgilanmagan";

	// Money owed *to* the user reads as something coming back, money owed *by*
	// them as something going out — the same green/red the ledger uses.
	const color = settled ? tc.mutedForeground : given ? tc.success : tc.danger;
	const percent = Math.round(share * 100);

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${name}, ${given ? "berilgan" : "olingan"}, ${
				settled ? "yopilgan" : `qoldiq ${formatAmount(remaining, debt.unit)}`
			}, ${sub}`}
			onPress={handlePress}
			className="active:opacity-70"
		>
			<View
				className={`flex-row items-center gap-3 py-3 ${divider ? "border-t border-border" : ""}`}
			>
				<ContactAvatar name={name} id={debt.contactId} mono />

				<View className="flex-1 gap-px">
					<Text
						className="font-bold text-foreground"
						style={{ fontSize: tf.base }}
						numberOfLines={1}
					>
						{name}
					</Text>
					<Text
						className="font-semibold"
						style={{ fontSize: tf.sm - 1, color: status === "overdue" ? tc.danger : tc.mutedForeground }}
						numberOfLines={1}
					>
						{sub}
					</Text>

					{/* Only while something is still owed: a full bar under a settled
					    debt says nothing the "Yopilgan" above it hasn't already said. */}
					{!settled && share > 0 && (
						<View className="flex-row items-center gap-2 mt-1.5">
							<View
								className="flex-1 rounded-full bg-muted overflow-hidden"
								style={{ height: 4 }}
							>
								<View
									style={{
										width: `${percent}%`,
										height: 4,
										borderRadius: 2,
										backgroundColor: color,
									}}
								/>
							</View>
							<Text
								className="font-semibold text-muted-foreground"
								style={{ fontSize: tf.xs }}
							>
								{`${percent}% qaytarildi`}
							</Text>
						</View>
					)}
				</View>

				<View className="items-end gap-px">
					<Text
						className="font-extrabold"
						style={{ fontSize: tf.base, color }}
						numberOfLines={1}
					>
						{settled
							? formatAmount(debt.amount, debt.unit, money)
							: `${given ? "+" : "−"}${formatAmount(remaining, debt.unit, money)}`}
					</Text>
					<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.xs }}>
						{given ? "Berilgan" : "Olingan"}
					</Text>
				</View>
			</View>
		</Pressable>
	);
}
