import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, View } from "react-native";
import BottomBar, { BOTTOM_BAR_SPACE } from "@/components/BottomBar";
import ContactAvatar from "@/components/ContactAvatar";
import DebtEventRow from "@/components/DebtEventRow";
import DebtPaymentSheet from "@/components/DebtPaymentSheet";
import DueChip from "@/components/DueChip";
import HeroAmount from "@/components/HeroAmount";
import { Button, Card, HeaderMenu, ListRow } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import ScrollShadow from "@/components/ScrollShadow";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useScrolled } from "@/hooks/useScrolled";
import { useTheme } from "@/hooks/useTheme";
import { formatDayLabel, formatDayMonth, formatFieldDate, todayISO } from "@/lib/date";
import {
	contactById,
	DIRECTION_META,
	type DebtEvent,
	debtShareMessage,
	debtStatus,
	debtTimeline,
	dueInfo,
	paidAmount,
	paidShare,
	remainingAmount,
	TAG_META,
} from "@/lib/debts";
import { formatAmount, methodByKey } from "@/lib/money";
import type { Debt, DebtPayment } from "@/lib/types";
import { walletName } from "@/lib/wallets";
import "../global.css";

/**
 * One debt, read: what is left of it, its terms, and its history — the loan
 * and every payment against it, each with what it left outstanding. Settling
 * it happens here: the payment button records a payment, which writes its own
 * ledger entry, and a payment in the history opens straight in the payment
 * sheet (a long press deletes it). Changing the debt itself is the form's
 * job, one tap away; deleting lives here, so a form never sends the user back
 * to a screen whose debt is gone.
 */
export default function DebtDetailScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ id?: string }>();
	const { ready, debts } = useLedger();
	const debt = params.id ? debts.find((d) => d.id === params.id) : undefined;

	if (!ready) {
		return (
			<View className="flex-1 bg-background items-center justify-center">
				<ActivityIndicator color={tc.foreground} />
			</View>
		);
	}

	if (!debt) {
		return (
			<View className="flex-1 bg-background items-center justify-center px-8">
				<Text className="font-semibold text-muted-foreground text-center" style={{ fontSize: tf.base }}>
					{"Bu qarz endi mavjud emas."}
				</Text>
			</View>
		);
	}

	return <DebtDetail debt={debt} />;
}

function DebtDetail({ debt }: { debt: Debt }) {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const { contacts, wallets, deleteDebt, addDebtPayment, updateDebtPayment, deleteDebtPayment } =
		useLedger();
	const { scrolled, scrollProps } = useScrolled();
	const [payOpen, setPayOpen] = useState(false);
	// Null while adding a new payment; the payment itself while editing one —
	// the sheet reads this to seed its fields and to know which mutator to call.
	const [editingPayment, setEditingPayment] = useState<DebtPayment | null>(null);

	const today = todayISO();
	const meta = DIRECTION_META[debt.direction];
	const given = debt.direction === "lent";
	const contact = contactById(contacts, debt.contactId);
	const name = contact?.name ?? "Noma'lum";
	const paid = paidAmount(debt);
	const remaining = remainingAmount(debt);
	const share = paidShare(debt);
	const settled = debtStatus(debt, today) === "settled";
	const tone = settled ? tc.mutedForeground : given ? tc.success : tc.danger;
	const percent = Math.round(share * 100);

	const history = useMemo(() => [...debtTimeline([debt])].reverse(), [debt]);
	// What each entry left outstanding — the loan's own running balance.
	const afterOf = (e: DebtEvent) =>
		e.balanceAfter === 0
			? { text: "Qarz yopildi", color: tc.success }
			: { text: `Qoldiq: ${formatAmount(Math.abs(e.balanceAfter), e.unit)}`, color: tc.mutedForeground };

	const openPayment = (payment: DebtPayment | null) => {
		setEditingPayment(payment);
		setPayOpen(true);
	};

	const shareDebt = () =>
		Share.share({
			message: debtShareMessage({
				direction: debt.direction,
				name,
				amount: debt.amount,
				remaining,
				unit: debt.unit,
				date: debt.date,
				dueDate: debt.dueDate,
			}),
		});

	const confirmDelete = () => {
		const entries = 1 + debt.payments.length;
		Alert.alert(
			"Qarz o'chirilsinmi?",
			`${formatAmount(debt.amount, debt.unit)}. Hisobdagi ${entries} ta yozuv ham o'chadi. Buni qaytarib bo'lmaydi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => {
						deleteDebt(debt.id);
						router.back();
					},
				},
			],
		);
	};

	const confirmDeletePayment = (payment: DebtPayment) => {
		Alert.alert(
			"To'lov o'chirilsinmi?",
			`${formatAmount(payment.amount, debt.unit)} · ${formatDayLabel(payment.date)}. Hisobdagi yozuv ham o'chadi va qoldiq ortadi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => deleteDebtPayment(debt.id, payment.id),
				},
			],
		);
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					title: given ? "Berilgan qarz" : "Olingan qarz",
					headerRight: () => (
						<HeaderMenu
							items={[
								{
									key: "edit",
									label: "Tahrirlash",
									icon: "create-outline",
									onPress: () => router.push(`/debt?id=${debt.id}`),
								},
								{
									key: "share",
									label: given ? "Qarzdorga yuborish" : "Qarz beruvchiga yuborish",
									icon: "share-social-outline",
									onPress: shareDebt,
								},
								{
									key: "delete",
									label: "Qarzni o'chirish",
									icon: "trash-outline",
									danger: true,
									separatorBefore: true,
									onPress: confirmDelete,
								},
							]}
						/>
					),
				}}
			/>
			<ScrollView
				{...scrollProps}
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 18,
					paddingTop: 6,
					paddingBottom: BOTTOM_BAR_SPACE,
					gap: 12,
				}}
				showsVerticalScrollIndicator={false}
			>
				{/* Who it's with ---------------------------------------------------- */}
				<View className="flex-row items-center" style={{ gap: 12, paddingVertical: 4 }}>
					<ContactAvatar
						name={name}
						id={debt.contactId}
						size={52}
						color={contact?.tag ? TAG_META[contact.tag].color : undefined}
					/>
					<View className="flex-1" style={{ gap: 3 }}>
						<Text className="font-extrabold text-foreground" style={{ fontSize: tf.lg + 1 }} numberOfLines={1}>
							{name}
						</Text>
						<View className="flex-row items-center" style={{ gap: 6 }}>
							<View
								className="justify-center"
								style={{
									height: 20,
									paddingHorizontal: 8,
									borderRadius: 10,
									backgroundColor: given ? tc.successSoft : tc.dangerSoft,
								}}
							>
								<Text className="font-extrabold" style={{ fontSize: tf.xs, color: given ? tc.success : tc.danger }}>
									{given ? "Berilgan" : "Olingan"}
								</Text>
							</View>
							<Text
								className="font-semibold text-muted-foreground shrink"
								style={{ fontSize: tf.sm - 1.5 }}
								numberOfLines={1}
							>
								{`${formatDayMonth(debt.date)} · ${debt.payments.length} to'lov`}
							</Text>
						</View>
					</View>
				</View>

				{/* What is left ----------------------------------------------------- */}
				<View className="bg-card" style={{ borderRadius: 24, padding: 18 }}>
					<View
						accessible
						accessibilityLabel={`${settled ? "Yopilgan" : "Qoldiq"}: ${formatAmount(remaining, debt.unit)}, ${percent}% qaytarildi${
							!settled && debt.dueDate ? `. ${dueInfo(debt.dueDate, today).text}` : ""
						}`}
					>
						<Text className="font-bold" style={{ fontSize: tf.sm - 1, color: tone }}>
							{settled ? "Qarz yopilgan" : "Qoldiq"}
						</Text>
						<View style={{ marginTop: 4 }}>
							<HeroAmount amount={remaining} unit={debt.unit} size={tf.xxxl + 12} />
						</View>
						<View className="rounded-full bg-background overflow-hidden" style={{ height: 6, marginTop: 10 }}>
							<View
								style={{
									width: `${percent}%`,
									height: "100%",
									borderRadius: 3,
									backgroundColor: settled || given ? tc.success : tc.danger,
								}}
							/>
						</View>
						<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 1, marginTop: 6 }}>
							{`${formatAmount(paid, debt.unit)} / ${formatAmount(debt.amount, debt.unit)} · ${percent}% qaytarildi`}
						</Text>
						{!settled && !!debt.dueDate && (
							<View style={{ marginTop: 12 }}>
								<DueChip dueDate={debt.dueDate} today={today} />
							</View>
						)}
					</View>
					{!settled && (
						<View style={{ marginTop: 14 }}>
							<Button
								label={meta.payLabel}
								fullWidth
								accessibilityLabel={`${meta.payLabel}: qoldiq ${formatAmount(remaining, debt.unit)}`}
								startIcon={<Ionicons name="cash-outline" size={18} color={tc.primaryFg} />}
								onPress={() => openPayment(null)}
							/>
						</View>
					)}
				</View>

				{!!debt.description && (
					<View
						className="bg-card"
						style={{ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 3, borderLeftColor: tc.foreground }}
					>
						<Text
							className="font-semibold text-foreground"
							style={{ fontSize: tf.base, lineHeight: Math.round(tf.base * 1.4) }}
						>
							{`“${debt.description}”`}
						</Text>
					</View>
				)}

				{/* Its terms -------------------------------------------------------- */}
				<Card flush>
					<ListRow
						icon="wallet-outline"
						title="Hamyon"
						value={debt.walletId ? walletName(wallets, debt.walletId) : "Hamyonsiz"}
					/>
					<ListRow
						icon={methodByKey(debt.method).icon}
						title="To'lov usuli"
						value={methodByKey(debt.method).label}
						divider
					/>
					<ListRow
						icon="hourglass-outline"
						title="Qaytarish muddati"
						value={debt.dueDate ? formatFieldDate(debt.dueDate) : "Muddatsiz"}
						divider
					/>
					{!!debt.dueDate && (
						<ListRow
							icon="notifications-outline"
							title="Eslatma"
							value={debt.remind ? "Yoqilgan" : "O'chirilgan"}
							divider
						/>
					)}
				</Card>

				{/* The history ------------------------------------------------------ */}
				<View>
					<Text
						accessibilityRole="header"
						className="font-extrabold text-foreground"
						style={{ fontSize: tf.base, lineHeight: 32, paddingHorizontal: 2 }}
					>
						Tarix
					</Text>
					{history.map((event, index) => (
						<DebtEventRow
							key={event.id}
							event={event}
							name={name}
							avatarColor={contact?.tag ? TAG_META[contact.tag].color : undefined}
							after={afterOf(event)}
							divider={index > 0}
							onPress={event.payment ? () => openPayment(event.payment) : undefined}
							onLongPress={event.payment ? () => event.payment && confirmDeletePayment(event.payment) : undefined}
						/>
					))}
				</View>
			</ScrollView>
			<ScrollShadow visible={scrolled} />

			<BottomBar>
				<View className="flex-1">
					<Button
						label="Tahrirlash"
						variant="soft"
						color="secondary"
						size="lg"
						fullWidth
						accessibilityLabel="Qarzni tahrirlash"
						startIcon={<Ionicons name="create-outline" size={18} color={tc.foreground} />}
						onPress={() => router.push(`/debt?id=${debt.id}`)}
					/>
				</View>
			</BottomBar>

			<DebtPaymentSheet
				key={payOpen ? `pay-open-${editingPayment?.id ?? "new"}` : "pay-closed"}
				visible={payOpen}
				onClose={() => setPayOpen(false)}
				debt={debt}
				existing={editingPayment ?? undefined}
				onSubmit={(input) =>
					editingPayment
						? updateDebtPayment(debt.id, editingPayment.id, input)
						: addDebtPayment(debt.id, input)
				}
			/>
		</View>
	);
}
