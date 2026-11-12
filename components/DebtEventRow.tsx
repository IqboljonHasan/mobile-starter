import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import ContactAvatar from "@/components/ContactAvatar";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useTheme } from "@/hooks/useTheme";
import { formatDayMonth } from "@/lib/date";
import { type DebtEvent, shortName } from "@/lib/debts";
import { formatAmount } from "@/lib/money";

/**
 * One entry in a debt history: a loan given or taken, or money paid back
 * either way — what happened, when, and where it left things.
 *
 * A loan leads with which way it went, green for given and red for taken; a
 * payment leads with who paid — the person's initials, or "Siz" — since a
 * history of payments is read by who settled what.
 */
export default function DebtEventRow({
	event,
	name,
	avatarColor,
	after,
	onPress,
	onLongPress,
	divider,
}: {
	event: DebtEvent;
	/** The other person's name, "Noma'lum" once they've been deleted. */
	name: string;
	/** The palette key their avatar is tinted with. */
	avatarColor?: string;
	/** Where the entry left things — "Natija: …" or "Qoldiq: …" — and its tone. */
	after: { text: string; color: string };
	onPress?: () => void;
	onLongPress?: () => void;
	divider?: boolean;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { defaultUnit } = useLedger();
	const handlePress = useGuardedPress(onPress);

	const loan = event.kind === "lent" || event.kind === "borrowed";
	const given = event.kind === "lent";
	const title =
		event.kind === "lent"
			? "Qarz berdingiz"
			: event.kind === "borrowed"
				? "Qarz oldingiz"
				: event.kind === "collected"
					? `${shortName(name)} to'lov qildi`
					: "Siz to'lov qildingiz";
	const when = `${formatDayMonth(event.date)}${
		loan && event.debt.dueDate ? ` · muddat ${formatDayMonth(event.debt.dueDate)}` : ""
	}`;
	const amount = formatAmount(event.amount, event.unit, { showUnit: event.unit !== defaultUnit });

	const leading = loan ? (
		<View
			className="items-center justify-center"
			style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: given ? tc.successSoft : tc.dangerSoft }}
		>
			<Ionicons name={given ? "arrow-up" : "arrow-down"} size={19} color={given ? tc.success : tc.danger} />
		</View>
	) : event.kind === "collected" ? (
		<ContactAvatar name={name} id={event.debt.contactId} size={38} color={avatarColor} />
	) : (
		<View
			className="items-center justify-center bg-primary"
			style={{ width: 38, height: 38, borderRadius: 19 }}
		>
			<Text className="font-extrabold" style={{ fontSize: tf.xs, color: tc.primaryFg }}>
				Siz
			</Text>
		</View>
	);

	const content = (
		<View
			className={`flex-row items-start ${divider ? "border-t border-border" : ""}`}
			style={{ gap: 12, paddingVertical: 10 }}
		>
			{leading}
			<View className="flex-1" style={{ gap: 2 }}>
				<Text className="font-extrabold text-foreground" style={{ fontSize: tf.base - 0.5 }} numberOfLines={1}>
					{title}
				</Text>
				<Text className="font-semibold" style={{ fontSize: tf.sm - 1.5, color: tc.placeholder }}>
					{when}
				</Text>
				{!!event.note && (
					<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 1.5 }}>
						{event.note}
					</Text>
				)}
				<Text className="font-bold" style={{ fontSize: tf.xs + 0.5, color: after.color, marginTop: 2 }}>
					{after.text}
				</Text>
			</View>
			<Text className="font-extrabold text-foreground" style={{ fontSize: tf.base }} numberOfLines={1}>
				{amount}
			</Text>
		</View>
	);

	if (!onPress) return content;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${title}, ${formatAmount(event.amount, event.unit)}, ${when}. ${after.text}`}
			accessibilityHint={onLongPress ? "O'chirish uchun uzoq bosing" : undefined}
			onPress={handlePress}
			onLongPress={onLongPress}
			className="active:opacity-70"
		>
			{content}
		</Pressable>
	);
}
