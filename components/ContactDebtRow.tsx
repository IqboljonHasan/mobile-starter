import { Pressable, View } from "react-native";
import ContactAvatar from "@/components/ContactAvatar";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useTheme } from "@/hooks/useTheme";
import { formatDayMonth } from "@/lib/date";
import { type ContactDebtGroup, netLabel } from "@/lib/debts";
import { formatAmount } from "@/lib/money";
import type { Contact } from "@/lib/types";

/**
 * One person in the Qarzlar list: everything with them rolled into a single
 * line, netted per unit — lending 500 000 and borrowing 200 000 from the same
 * person reads as "+300 000, sizga qarzdor". Each debt behind the figure is on
 * the person's own screen.
 */
export default function ContactDebtRow({
	group,
	contact,
	onPress,
	divider,
}: {
	group: ContactDebtGroup;
	/** Null once the person has been deleted — their debts still stand. */
	contact: Contact | null;
	onPress?: () => void;
	divider?: boolean;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { defaultUnit } = useLedger();
	const handlePress = useGuardedPress(onPress);

	const name = contact?.name ?? "Noma'lum";
	const count = group.debts.length;
	const settled = group.status === "settled";
	// The main currency first, as the list's totals read; any other keeps its
	// symbol so a dollar balance never reads as som.
	const net = [...group.net].sort((a, b) => (a.unit === defaultUnit ? -1 : b.unit === defaultUnit ? 1 : 0));
	const signs = new Set(net.map((n) => Math.sign(n.amount)));
	// One word under the figures only when it is true of all of them.
	const caption = settled ? "Yopilgan" : signs.size === 1 ? netLabel(net[0].amount) : null;

	const status = settled
		? "Hammasi yopilgan"
		: group.status === "overdue" && group.nextDue
			? `Muddati o'tgan · ${formatDayMonth(group.nextDue)}`
			: group.nextDue
				? `Muddat: ${formatDayMonth(group.nextDue)}`
				: "Muddat belgilanmagan";
	const sub = count > 1 ? `${count} ta qarz · ${status}` : status;

	const amountText = (amount: number, unit: string) =>
		`${amount > 0 ? "+" : amount < 0 ? "−" : ""}${formatAmount(Math.abs(amount), unit, {
			showUnit: unit !== defaultUnit,
		})}`;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={[
				name,
				`${count} ta qarz`,
				...net.map((n) => `${netLabel(n.amount)} ${formatAmount(Math.abs(n.amount), n.unit)}`),
				status,
			].join(", ")}
			onPress={handlePress}
			className="active:opacity-70"
		>
			<View
				className={`flex-row items-center gap-3 py-3 ${divider ? "border-t border-border" : ""}`}
			>
				<ContactAvatar name={name} id={group.contactId} mono />

				<View className="flex-1 gap-px">
					<Text className="font-bold text-foreground" style={{ fontSize: tf.base }} numberOfLines={1}>
						{name}
					</Text>
					<Text
						className="font-semibold"
						style={{
							fontSize: tf.sm - 1,
							color: group.status === "overdue" ? tc.danger : tc.mutedForeground,
						}}
						numberOfLines={1}
					>
						{sub}
					</Text>
					{/* Only while something is still owed and has started coming
					    back — see `paidShare` for when it can be said at all. */}
					{group.paidShare !== null && group.paidShare > 0 && (
						<View className="flex-row items-center gap-2 mt-1.5">
							<View className="flex-1 rounded-full bg-muted overflow-hidden" style={{ height: 4 }}>
								<View
									style={{
										width: `${Math.round(group.paidShare * 100)}%`,
										height: 4,
										borderRadius: 2,
										backgroundColor: (net[0]?.amount ?? 0) >= 0 ? tc.success : tc.danger,
									}}
								/>
							</View>
							<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.xs }}>
								{`${Math.round(group.paidShare * 100)}% qaytarildi`}
							</Text>
						</View>
					)}
				</View>

				<View className="items-end gap-px" style={{ maxWidth: "50%" }}>
					{net.map((n) => (
						<Text
							key={n.unit}
							className="font-extrabold"
							style={{
								fontSize: tf.base,
								// Owed to the user reads as money coming back, owed by them as
								// money going out — the ledger's green and red.
								color: n.amount > 0 ? tc.success : n.amount < 0 ? tc.danger : tc.mutedForeground,
							}}
							numberOfLines={1}
							adjustsFontSizeToFit
						>
							{amountText(n.amount, n.unit)}
						</Text>
					))}
					{!!caption && (
						<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.xs }}>
							{caption}
						</Text>
					)}
				</View>
			</View>
		</Pressable>
	);
}
