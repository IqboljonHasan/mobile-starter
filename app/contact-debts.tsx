import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, SectionList, Share, View } from "react-native";
import BottomBar, { BOTTOM_BAR_FADE, BOTTOM_BAR_SPACE } from "@/components/BottomBar";
import ContactAvatar from "@/components/ContactAvatar";
import ContactSheet from "@/components/ContactSheet";
import DebtEventRow from "@/components/DebtEventRow";
import DebtPaymentSheet from "@/components/DebtPaymentSheet";
import DebtRow from "@/components/DebtRow";
import DueChip from "@/components/DueChip";
import HeroAmount from "@/components/HeroAmount";
import ScrollShadow from "@/components/ScrollShadow";
import TagPill from "@/components/TagPill";
import {
	BottomSheet,
	Button,
	EmptyState,
	HeaderMenu,
	type HeaderMenuItem,
	IconButton,
	PillTabs,
	SegmentedControl,
} from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useScrolled } from "@/hooks/useScrolled";
import { useTheme } from "@/hooks/useTheme";
import { formatDayLabel, monthKeyOf, monthTitle, todayISO } from "@/lib/date";
import {
	contactById,
	contactShareMessage,
	dativeOf,
	type DebtEvent,
	debtsOfContact,
	debtTimeline,
	dueInfo,
	groupDebtsByContact,
	isSettled,
	shortName,
	sortDebts,
	TAG_META,
} from "@/lib/debts";
import { formatAmount } from "@/lib/money";
import type { Debt, DebtDirection, DebtPayment } from "@/lib/types";
import "../global.css";

/** Which entries the history shows. */
type HistoryFilter = "all" | "debts" | "payments";

/**
 * Everything with one person, as one account: where things stand after every
 * loan and payment either way, and the history that got there, newest first,
 * each entry with the balance it left behind.
 *
 * A loan in the history opens on its own screen; a payment opens straight in
 * the payment sheet, and a long press deletes it. "To'lov qo'shish" records a
 * payment against one of the open debts — asked which when there are several,
 * since a payment always belongs to a single debt.
 *
 * `?id=` is the contact's id. Debts outlive a deleted contact, so the screen
 * still shows them under "Noma'lum", just without offering new ones.
 */
export default function ContactDebtsScreen() {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ id?: string }>();
	const {
		ready,
		debts,
		contacts,
		defaultUnit,
		updateContact,
		deleteContact,
		addDebtPayment,
		updateDebtPayment,
		deleteDebtPayment,
	} = useLedger();
	const { scrolled, scrollProps } = useScrolled();
	const today = todayISO();

	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [filter, setFilter] = useState<HistoryFilter>("all");
	const [editingContact, setEditingContact] = useState(false);
	const [debtPickerOpen, setDebtPickerOpen] = useState(false);
	// The payment sheet's debt, and the payment being edited (null for a new
	// one). Kept after the sheet closes so it can animate out with its content.
	const [paying, setPaying] = useState<{ debt: Debt; payment: DebtPayment | null } | null>(null);
	const [payOpen, setPayOpen] = useState(false);
	const openPayment = (debt: Debt, payment: DebtPayment | null) => {
		setPaying({ debt, payment });
		setPayOpen(true);
	};

	const contactId = params.id ?? "";
	const contact = contactById(contacts, contactId);
	const name = contact?.name ?? "Noma'lum";
	const short = shortName(name);
	const avatarColor = contact?.tag ? TAG_META[contact.tag].color : undefined;

	const theirs = useMemo(() => debtsOfContact(debts, contactId), [debts, contactId]);
	const events = useMemo(() => debtTimeline(theirs), [theirs]);
	const group = useMemo(() => groupDebtsByContact(theirs, today)[0] ?? null, [theirs, today]);
	const openDebts = useMemo(() => sortDebts(theirs.filter((d) => !isSettled(d)), today), [theirs, today]);

	// One balance at a time, the main currency first: som and dollars owed are
	// two separate facts, never one sum.
	const net = useMemo(
		() =>
			[...(group?.net ?? [])].sort((a, b) =>
				a.unit === defaultUnit ? -1 : b.unit === defaultUnit ? 1 : 0,
			),
		[group, defaultUnit],
	);
	const unit =
		pickedUnit && net.some((n) => n.unit === pickedUnit) ? pickedUnit : (net[0]?.unit ?? defaultUnit);
	const balance = net.find((n) => n.unit === unit)?.amount ?? 0;
	const nextDue = openDebts
		.filter((d) => d.unit === unit && d.dueDate)
		.reduce<string | null>((soonest, d) => (!soonest || (d.dueDate ?? "") < soonest ? d.dueDate : soonest), null);

	const result =
		balance > 0
			? { text: `${short} sizga qarzdor`, color: tc.success }
			: balance < 0
				? { text: `Siz ${dativeOf(short)} qarzdorsiz`, color: tc.danger }
				: { text: "Hisob-kitob teng", color: tc.mutedForeground };

	const loanCount = theirs.length;
	const paymentCount = events.length - loanCount;

	const sections = useMemo(() => {
		const shown = [...events].reverse().filter((e) => {
			if (filter === "debts") return e.payment === null;
			if (filter === "payments") return e.payment !== null;
			return true;
		});
		const months = new Map<string, DebtEvent[]>();
		for (const e of shown) {
			const key = monthKeyOf(e.date);
			const list = months.get(key);
			if (list) list.push(e);
			else months.set(key, [e]);
		}
		return [...months.entries()].map(([key, data]) => ({ key, title: monthTitle(key), data }));
	}, [events, filter]);

	// What an entry left behind, in its own unit and from the user's side.
	const afterOf = (e: DebtEvent) => {
		const amount = formatAmount(Math.abs(e.balanceAfter), e.unit, { showUnit: e.unit !== defaultUnit });
		return e.balanceAfter > 0
			? { text: `Natija: ${short} qarzdor · ${amount}`, color: tc.success }
			: e.balanceAfter < 0
				? { text: `Natija: siz qarzdorsiz · ${amount}`, color: tc.danger }
				: { text: "Natija: hisob teng", color: tc.mutedForeground };
	};

	// The list's last row has to clear the buttons and their fade — measured,
	// as on the Qarzlar screen. Without the buttons there is nothing to clear.
	const [listBottom, setListBottom] = useState<number | null>(null);
	const [fadeTop, setFadeTop] = useState<number | null>(null);
	const listEndSpace = !contact
		? 32
		: listBottom !== null && fadeTop !== null
			? Math.max(listBottom - fadeTop, 0) + 12
			: BOTTOM_BAR_SPACE + 16;

	const openNew = (direction: DebtDirection) =>
		router.push(`/debt?direction=${direction}&contactId=${contactId}`);

	const addPayment = () => {
		if (openDebts.length === 1) openPayment(openDebts[0], null);
		else setDebtPickerOpen(true);
	};

	const confirmDeletePayment = (e: DebtEvent) => {
		if (!e.payment) return;
		const payment = e.payment;
		Alert.alert(
			"To'lov o'chirilsinmi?",
			`${formatAmount(payment.amount, e.unit)} · ${formatDayLabel(payment.date)}. Hisobdagi yozuv ham o'chadi va qoldiq ortadi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{ text: "O'chirish", style: "destructive", onPress: () => deleteDebtPayment(e.debt.id, payment.id) },
			],
		);
	};

	const confirmDeleteContact = () => {
		if (!contact) return;
		const open = openDebts.length;
		// Debts are never cascaded away with the person — the money still moved.
		Alert.alert(
			`"${contact.name}" o'chirilsinmi?`,
			theirs.length === 0
				? "Buni qaytarib bo'lmaydi."
				: `${theirs.length} ta qarz (${open} tasi ochiq) saqlanib qoladi, lekin ular "Noma'lum" bo'lib ko'rinadi. Buni qaytarib bo'lmaydi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => {
						deleteContact(contact.id);
						router.back();
					},
				},
			],
		);
	};

	const menuItems: HeaderMenuItem[] = [
		...(contact
			? [
					{
						key: "edit",
						label: "Kontaktni tahrirlash",
						icon: "create-outline" as const,
						onPress: () => setEditingContact(true),
					},
				]
			: []),
		...(events.length > 0
			? [
					{
						key: "share",
						label: "Hisobotni ulashish",
						icon: "share-social-outline" as const,
						onPress: () => Share.share({ message: contactShareMessage(name, events) }),
					},
				]
			: []),
		...(contact
			? [
					{
						key: "delete",
						label: "Kontaktni o'chirish",
						icon: "trash-outline" as const,
						danger: true,
						separatorBefore: true,
						onPress: confirmDeleteContact,
					},
				]
			: []),
	];

	if (!ready) {
		return (
			<View className="flex-1 bg-background items-center justify-center">
				<ActivityIndicator color={tc.foreground} />
			</View>
		);
	}

	const header = (
		<View style={{ gap: 12, paddingBottom: 4 }}>
			{/* Who ------------------------------------------------------------- */}
			<View className="flex-row items-center" style={{ gap: 12, paddingVertical: 4 }}>
				<ContactAvatar name={name} id={contactId} size={52} color={avatarColor} />
				<View className="flex-1" style={{ gap: 3 }}>
					<Text className="font-extrabold text-foreground" style={{ fontSize: tf.lg + 1 }} numberOfLines={1}>
						{name}
					</Text>
					<View className="flex-row items-center" style={{ gap: 6 }}>
						{!!contact?.tag && <TagPill tag={contact.tag} />}
						<Text
							className="font-semibold text-muted-foreground shrink"
							style={{ fontSize: tf.sm - 1.5 }}
							numberOfLines={1}
						>
							{`${loanCount} qarz · ${paymentCount} to'lov`}
						</Text>
					</View>
				</View>
				{!!contact?.phone && (
					<>
						<IconButton
							variant="filled"
							icon="call-outline"
							accessibilityLabel="Qo'ng'iroq qilish"
							onPress={() => Linking.openURL(`tel:${contact.phone}`)}
						/>
						<IconButton
							variant="filled"
							icon="chatbubble-outline"
							accessibilityLabel="Xabar yozish"
							onPress={() => Linking.openURL(`sms:${contact.phone}`)}
						/>
					</>
				)}
			</View>

			{net.length > 1 && (
				<PillTabs
					compact
					fill
					items={net.map((n) => ({ key: n.unit, label: n.unit }))}
					value={unit}
					onChange={setPickedUnit}
				/>
			)}

			{/* Where it all stands ---------------------------------------------- */}
			<View className="bg-card" style={{ borderRadius: 24, padding: 18 }}>
				<View
					accessible
					accessibilityLabel={`${result.text}: ${formatAmount(Math.abs(balance), unit)}${
						nextDue ? `. ${dueInfo(nextDue, today).text}` : ""
					}`}
				>
					<Text className="font-bold" style={{ fontSize: tf.sm - 1, color: result.color }}>
						{result.text}
					</Text>
					<View style={{ marginTop: 4 }}>
						<HeroAmount amount={Math.abs(balance)} unit={unit} size={tf.xxxl + 12} />
					</View>
					<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 1, marginTop: 2 }}>
						{"Barcha qarz va to'lovlardan keyingi natija"}
					</Text>
					{!!nextDue && (
						<View style={{ marginTop: 12 }}>
							<DueChip dueDate={nextDue} today={today} />
						</View>
					)}
				</View>
				{openDebts.length > 0 && (
					<View style={{ marginTop: 14 }}>
						<Button
							label="To'lov qo'shish"
							fullWidth
							accessibilityLabel={`${name} bilan qarzga to'lov qo'shish`}
							startIcon={<Ionicons name="cash-outline" size={18} color={tc.primaryFg} />}
							onPress={addPayment}
						/>
					</View>
				)}
			</View>

			{/* The history ------------------------------------------------------ */}
			{events.length > 0 && (
				<>
					<Text
						accessibilityRole="header"
						className="font-extrabold text-foreground"
						style={{ fontSize: tf.base, marginTop: 6, paddingHorizontal: 2 }}
					>
						Tarix
					</Text>
					<SegmentedControl<HistoryFilter>
						items={[
							{ key: "all", label: `Hammasi · ${events.length}` },
							{ key: "debts", label: `Qarzlar · ${loanCount}` },
							{ key: "payments", label: `To'lovlar · ${paymentCount}` },
						]}
						value={filter}
						onChange={setFilter}
					/>
				</>
			)}
		</View>
	);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					title: "Qarz",
					headerRight: menuItems.length > 0 ? () => <HeaderMenu items={menuItems} /> : undefined,
				}}
			/>
			<View
				className="flex-1"
				onLayout={(e) => setListBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
			>
				<SectionList
					{...scrollProps}
					sections={sections}
					keyExtractor={(item) => item.id}
					stickySectionHeadersEnabled={false}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: listEndSpace }}
					ListHeaderComponent={header}
					renderSectionHeader={({ section }) => (
						<Text
							accessibilityRole="header"
							className="font-extrabold uppercase"
							style={{
								fontSize: tf.xs,
								letterSpacing: 0.5,
								color: tc.placeholder,
								marginTop: 16,
								marginBottom: 4,
								paddingHorizontal: 2,
							}}
						>
							{section.title}
						</Text>
					)}
					renderItem={({ item }) => (
						<DebtEventRow
							event={item}
							name={name}
							avatarColor={avatarColor}
							after={afterOf(item)}
							onPress={() =>
								item.payment
									? openPayment(item.debt, item.payment)
									: router.push(`/debt-detail?id=${item.debt.id}`)
							}
							onLongPress={item.payment ? () => confirmDeletePayment(item) : undefined}
						/>
					)}
					ListEmptyComponent={
						contact ? (
							<EmptyState
								icon="people-outline"
								title={events.length === 0 ? "Qarz yo'q" : "Bu turda yozuv yo'q"}
								message={
									events.length === 0
										? `${dativeOf(short)} bergan yoki undan olgan qarzingizni pastdagi tugmalar bilan qo'shing.`
										: undefined
								}
							/>
						) : (
							<EmptyState icon="person-outline" title="Bu odam endi mavjud emas" />
						)
					}
				/>
				<ScrollShadow visible={scrolled} />
			</View>

			{/* A new debt with this person, already filled in — which way it runs
			    is still the first choice, as on the Qarzlar screen. */}
			{!!contact && (
				<BottomBar
					onLayout={(e) =>
						setFadeTop(e.nativeEvent.layout.y + e.nativeEvent.layout.height - BOTTOM_BAR_FADE)
					}
				>
					<View className="flex-1">
						<Button
							label="Qarz berdim"
							variant="soft"
							color="success"
							size="lg"
							fullWidth
							accessibilityLabel={`${dativeOf(short)} qarz berganimni qo'shish`}
							startIcon={<Ionicons name="add" size={20} color={tc.success} />}
							onPress={() => openNew("lent")}
						/>
					</View>
					<View className="flex-1">
						<Button
							label="Qarz oldim"
							variant="soft"
							color="danger"
							size="lg"
							fullWidth
							accessibilityLabel={`${short}dan qarz olganimni qo'shish`}
							startIcon={<Ionicons name="add" size={20} color={tc.danger} />}
							onPress={() => openNew("borrowed")}
						/>
					</View>
				</BottomBar>
			)}

			{/* Which debt a new payment is for, when there's more than one open. */}
			<BottomSheet visible={debtPickerOpen} onClose={() => setDebtPickerOpen(false)} maxHeight="80%">
				<View className="flex-row items-center justify-between gap-3" style={{ paddingLeft: 20, paddingRight: 12 }}>
					<Text
						accessibilityRole="header"
						className="font-extrabold text-foreground"
						style={{ fontSize: tf.xl, letterSpacing: -0.2 }}
					>
						Qaysi qarzga?
					</Text>
					<IconButton variant="filled" icon="close" accessibilityLabel="Yopish" onPress={() => setDebtPickerOpen(false)} />
				</View>
				<ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8 }}>
					{openDebts.map((debt, index) => (
						<DebtRow
							key={debt.id}
							debt={debt}
							contact={contact}
							today={today}
							divider={index > 0}
							showContact={false}
							onPress={() => {
								setDebtPickerOpen(false);
								// One sheet closes before the next rises, as two at once would fight.
								setTimeout(() => openPayment(debt, null), 280);
							}}
						/>
					))}
				</ScrollView>
			</BottomSheet>

			{!!paying && (
				<DebtPaymentSheet
					key={`pay-${paying.debt.id}-${paying.payment?.id ?? "new"}`}
					visible={payOpen}
					onClose={() => setPayOpen(false)}
					debt={paying.debt}
					existing={paying.payment ?? undefined}
					onSubmit={(input) =>
						paying.payment
							? updateDebtPayment(paying.debt.id, paying.payment.id, input)
							: addDebtPayment(paying.debt.id, input)
					}
				/>
			)}

			{!!contact && (
				<ContactSheet
					key={editingContact ? "contact-edit-open" : "contact-edit-closed"}
					visible={editingContact}
					onClose={() => setEditingContact(false)}
					existing={contact}
					onSubmit={(draft) => updateContact(contact.id, draft)}
				/>
			)}
		</View>
	);
}
