import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { type ReactNode, useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, View } from "react-native";
import BottomBar, { BOTTOM_BAR_SPACE } from "@/components/BottomBar";
import HeroAmount from "@/components/HeroAmount";
import ScrollShadow from "@/components/ScrollShadow";
import WalletIcon from "@/components/WalletIcon";
import { Button, Card, HeaderMenu, type HeaderMenuItem, ListRow } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useScrolled } from "@/hooks/useScrolled";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import {
	entryTime,
	formatDate,
	formatDayLabel,
	formatDayMonth,
	monthKeyOf,
	monthName,
	monthShortLabel,
} from "@/lib/date";
import { contactName, DIRECTION_META } from "@/lib/debts";
import { entryContext, entryShareMessage, resolveCategory } from "@/lib/ledger";
import { formatAmount, formatCompact, maskAmount, methodByKey } from "@/lib/money";
import type { Debt, Transaction } from "@/lib/types";
import { UNALLOCATED_ID, walletById, walletColor, walletName } from "@/lib/wallets";
import "../global.css";

/**
 * One Kirim or Chiqim, read: the amount and what it was, how it was paid and
 * where the money went — an income's split wallet by wallet, as it was
 * snapshotted when saved — and how it compares with its own kind: the same
 * category (and subcategory) month by month, and the entries of that kind
 * before it.
 *
 * Editing is the form's job, one tap away, and so is a copy: "Nusxa yaratish"
 * opens a new entry filled in from this one. Deleting lives here, so the form
 * never sends the user back to an entry that is gone.
 *
 * An entry a debt wrote can't be edited, copied or deleted here: it changes
 * through its debt, which this screen links to, so the two never disagree.
 */
export default function TransactionDetailScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ id?: string }>();
	const { ready, transactions, debts } = useLedger();
	const transaction = params.id ? transactions.find((t) => t.id === params.id) : undefined;
	// Only a debt that still exists owns its entry — the form makes the same call.
	const debt = transaction?.debtId ? (debts.find((d) => d.id === transaction.debtId) ?? null) : null;

	if (!ready) {
		return (
			<View className="flex-1 bg-background items-center justify-center">
				<ActivityIndicator color={tc.foreground} />
			</View>
		);
	}

	if (!transaction) {
		return (
			<View className="flex-1 bg-background items-center justify-center px-8">
				<Text className="font-semibold text-muted-foreground text-center" style={{ fontSize: tf.base }}>
					{"Bu yozuv endi mavjud emas."}
				</Text>
			</View>
		);
	}

	return <TransactionDetail transaction={transaction} debt={debt} />;
}

function TransactionDetail({ transaction, debt }: { transaction: Transaction; debt: Debt | null }) {
	const router = useRouter();
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const { transactions, categories, wallets, members, contacts, defaultUnit, deleteTransaction } =
		useLedger();
	const { hideIncome } = usePreferences();
	const { scrolled, scrollProps } = useScrolled();

	const income = transaction.type === "income";
	const unit = transaction.unit;
	const { category, subcategory } = resolveCategory(transaction, categories);
	const title = category?.name ?? subcategory?.name ?? "Kategoriyasiz";
	// What the comparison below is "of" — the subcategory when there is one.
	const kindName = subcategory?.name ?? title;
	const method = methodByKey(transaction.method);
	// Anything derived from income follows "hide amounts", as in the list.
	const masked = income && hideIncome;
	const money = (value: number, options?: { showUnit?: boolean }) =>
		masked ? maskAmount(unit) : formatAmount(value, unit, options);
	const member = transaction.memberId ? members.find((m) => m.id === transaction.memberId) : undefined;
	const allocations = income ? transaction.allocations : [];
	const time = entryTime(transaction.createdAt, transaction.date);
	const kindColor = income ? tc.success : tc.danger;

	const context = useMemo(
		() => (debt ? null : entryContext(transactions, transaction)),
		[debt, transactions, transaction],
	);

	const edit = () => router.push(`/transaction?id=${transaction.id}`);
	const copy = () => router.push(`/transaction?copyOf=${transaction.id}`);
	const share = () =>
		Share.share({
			message: entryShareMessage(transaction, subcategory ? `${title} / ${subcategory.name}` : title),
		});

	const confirmDelete = () => {
		Alert.alert(
			"Yozuv o'chirilsinmi?",
			`${formatAmount(transaction.amount, unit)} · ${formatDayLabel(transaction.date)}. Buni qaytarib bo'lmaydi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => {
						deleteTransaction(transaction.id);
						router.back();
					},
				},
			],
		);
	};

	const menuItems: HeaderMenuItem[] = debt
		? [{ key: "share", label: "Ulashish", icon: "share-social-outline", onPress: share }]
		: [
				{ key: "edit", label: "Tahrirlash", icon: "create-outline", onPress: edit },
				{ key: "copy", label: "Nusxa yaratish", icon: "copy-outline", onPress: copy },
				{ key: "share", label: "Ulashish", icon: "share-social-outline", onPress: share },
				{
					key: "delete",
					label: "O'chirish",
					icon: "trash-outline",
					danger: true,
					separatorBefore: true,
					onPress: confirmDelete,
				},
			];

	// Where the money went, as one chip: the wallet it touched, how many an
	// income was split across, or none.
	const singleWalletId = allocations.length > 0 ? null : transaction.walletId;
	const singleWallet =
		singleWalletId === UNALLOCATED_ID ? null : walletById(wallets, singleWalletId);
	const walletChip =
		allocations.length > 0 ? (
			<Chip icon={<Ionicons name="pie-chart-outline" size={15} color={tc.foreground} />}>
				{`${allocations.length} ta hamyonga`}
			</Chip>
		) : singleWalletId ? (
			<Chip
				icon={
					<WalletIcon
						icon={singleWalletId === UNALLOCATED_ID ? null : (singleWallet?.icon ?? null)}
						color={walletColor(wallets, singleWalletId)}
						size={22}
					/>
				}
				tight
			>
				{walletName(wallets, singleWalletId)}
			</Chip>
		) : (
			<Chip icon={<Ionicons name="wallet-outline" size={15} color={tc.foreground} />}>Hamyonsiz</Chip>
		);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					title: income ? "Kirim" : "Chiqim",
					headerRight: () => <HeaderMenu items={menuItems} />,
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
				{/* The amount and what it was --------------------------------------- */}
				<View
					style={{ borderRadius: 26, padding: 18, backgroundColor: income ? tc.successSoft : tc.dangerSoft }}
				>
					<View
						accessible
						accessibilityLabel={`${income ? "Kirim" : "Chiqim"}: ${title}${
							subcategory && category ? `, ${subcategory.name}` : ""
						}, ${masked ? "summa yashirilgan" : formatAmount(transaction.amount, unit)}`}
						className="flex-row items-center"
						style={{ gap: 12 }}
					>
						<View
							className="items-center justify-center bg-background"
							style={{ width: 48, height: 48, borderRadius: 16 }}
						>
							<Ionicons name={category?.icon ?? "help-outline"} size={22} color={tc.foreground} />
						</View>
						<View className="flex-1" style={{ gap: 1 }}>
							<Text className="font-extrabold text-foreground" style={{ fontSize: tf.base + 1 }} numberOfLines={2}>
								{title}
								{subcategory && category ? (
									<Text className="font-semibold text-muted-foreground">{` / ${subcategory.name}`}</Text>
								) : null}
							</Text>
							<Text className="font-bold" style={{ fontSize: tf.sm - 1.5, color: kindColor }}>
								{income ? "Kirim" : "Chiqim"}
							</Text>
						</View>
					</View>
					<View style={{ marginTop: 14 }} importantForAccessibility="no-hide-descendants">
						<HeroAmount
							amount={transaction.amount}
							unit={unit}
							size={tf.xxxl + 10}
							sign={income ? "+" : "−"}
							color={income ? tc.success : tc.foreground}
							masked={masked}
						/>
					</View>
					<View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 12 }}>
						{walletChip}
						<Chip icon={<Ionicons name={method.icon} size={15} color={tc.foreground} />}>{method.label}</Chip>
						<Chip icon={<Ionicons name="calendar-outline" size={15} color={tc.foreground} />}>
							{time ? `${formatDate(transaction.date)}, ${time}` : formatDate(transaction.date)}
						</Chip>
						{!income && !!member && (
							<Chip icon={<Ionicons name="person-outline" size={15} color={tc.foreground} />}>{member.name}</Chip>
						)}
					</View>
				</View>

				{!!transaction.description && (
					<View
						className="bg-card"
						style={{ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 3, borderLeftColor: tc.foreground }}
					>
						<Text
							className="font-semibold text-foreground"
							style={{ fontSize: tf.base, lineHeight: Math.round(tf.base * 1.4) }}
						>
							{`“${transaction.description}”`}
						</Text>
					</View>
				)}

				{/* The debt behind it, when a debt wrote it --------------------------- */}
				{!!debt && (
					<Card flush>
						<ListRow
							icon={DIRECTION_META[debt.direction].icon}
							title={contactName(contacts, debt.contactId)}
							subtitle="Qarzga tegishli yozuv — qarzning o'zi orqali o'zgartiriladi"
							onPress={() => router.push(`/debt-detail?id=${debt.id}`)}
						/>
					</Card>
				)}

				{/* Where an income went --------------------------------------------- */}
				{allocations.length > 0 && (
					<Outlined>
						<Text accessibilityRole="header" className="font-extrabold text-foreground" style={{ fontSize: tf.base }}>
							Qaysi hamyonga qancha tushdi
						</Text>
						<View
							className="flex-row overflow-hidden"
							style={{ height: 8, gap: 2, borderRadius: 4, marginTop: 10, marginBottom: 6 }}
							importantForAccessibility="no-hide-descendants"
						>
							{allocations.map((a) => (
								<View
									key={a.walletId}
									style={{
										flexGrow: Math.max(a.amount, 0.0001),
										flexBasis: 0,
										backgroundColor:
											a.walletId === UNALLOCATED_ID
												? tc.disabled
												: categoryColorValue(walletColor(wallets, a.walletId), isDark),
									}}
								/>
							))}
						</View>
						{allocations.map((a) => {
							const wallet = walletById(wallets, a.walletId);
							const percent = transaction.amount > 0 ? Math.round((a.amount / transaction.amount) * 100) : 0;
							return (
								<View
									key={a.walletId}
									accessible
									accessibilityLabel={`${walletName(wallets, a.walletId)}, ${percent}%, ${money(a.amount)}`}
									className="flex-row items-center border-t border-border"
									style={{ gap: 10, minHeight: 44 }}
								>
									<WalletIcon
										icon={a.walletId === UNALLOCATED_ID ? null : (wallet?.icon ?? null)}
										color={walletColor(wallets, a.walletId)}
										size={28}
									/>
									<Text className="flex-1 font-semibold text-foreground" style={{ fontSize: tf.base - 0.5 }} numberOfLines={1}>
										{walletName(wallets, a.walletId)}
									</Text>
									<Text className="font-bold text-muted-foreground" style={{ fontSize: tf.sm - 1 }}>
										{`${percent}%`}
									</Text>
									<Text
										className="font-extrabold text-foreground text-right"
										style={{ fontSize: tf.base - 0.5, minWidth: 92 }}
										numberOfLines={1}
									>
										{money(a.amount, { showUnit: unit !== defaultUnit })}
									</Text>
								</View>
							);
						})}
					</Outlined>
				)}

				{/* How it compares --------------------------------------------------- */}
				{!!context && <ContextCard transaction={transaction} context={context} kindName={kindName} masked={masked} />}

				{!!context && context.previous.length > 0 && (
					<View>
						<Text
							accessibilityRole="header"
							className="font-extrabold text-foreground"
							style={{ fontSize: tf.base, lineHeight: 32, paddingHorizontal: 2 }}
							numberOfLines={1}
						>
							{`Avvalgi “${kindName}” yozuvlari`}
						</Text>
						{context.previous.map((t, index) => (
							<PreviousRow
								key={t.id}
								transaction={t}
								fallback={kindName}
								amount={`${income ? "+" : "−"}${money(t.amount, { showUnit: unit !== defaultUnit })}`}
								divider={index > 0}
								onPress={() => router.push(`/transaction-detail?id=${t.id}`)}
							/>
						))}
					</View>
				)}
			</ScrollView>
			<ScrollShadow visible={scrolled} />

			<BottomBar>
				{debt ? (
					<View className="flex-1">
						<Button
							label="Qarzni ochish"
							size="lg"
							fullWidth
							startIcon={<Ionicons name="open-outline" size={18} color={tc.primaryFg} />}
							onPress={() => router.push(`/debt-detail?id=${debt.id}`)}
						/>
					</View>
				) : (
					<>
						<View className="flex-1">
							<Button
								label="Tahrirlash"
								size="lg"
								fullWidth
								accessibilityLabel={income ? "Kirimni tahrirlash" : "Chiqimni tahrirlash"}
								startIcon={<Ionicons name="create-outline" size={20} color={tc.primaryFg} />}
								onPress={edit}
							/>
						</View>
						<SquareButton icon="copy-outline" accessibilityLabel="Nusxa yaratish" onPress={copy} />
					</>
				)}
			</BottomBar>
		</View>
	);
}

/** A white pill in the hero: an icon or tile, then a short fact. */
function Chip({ icon, tight, children }: { icon: ReactNode; tight?: boolean; children: string }) {
	const { tf } = useFont();
	return (
		<View
			className="flex-row items-center bg-background"
			style={{ gap: 6, height: 32, borderRadius: 16, paddingLeft: tight ? 5 : 12, paddingRight: 12, maxWidth: "100%" }}
		>
			{icon}
			<Text className="font-bold text-foreground shrink" style={{ fontSize: tf.sm - 1 }} numberOfLines={1}>
				{children}
			</Text>
		</View>
	);
}

/** A section set apart by a hairline rather than a fill, as the prototype draws it. */
function Outlined({ children }: { children: ReactNode }) {
	const { tc } = useTheme();
	return (
		<View style={{ borderRadius: 22, borderWidth: 1, borderColor: tc.border, padding: 16 }}>{children}</View>
	);
}

/**
 * The entry against its own kind: the last six months as bars, the entry's
 * month in ink and the rest faint, then the month's total against the average
 * of the five before it.
 */
function ContextCard({
	transaction,
	context,
	kindName,
	masked,
}: {
	transaction: Transaction;
	context: ReturnType<typeof entryContext>;
	kindName: string;
	masked: boolean;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const income = transaction.type === "income";
	const unit = transaction.unit;
	const month = monthName(monthKeyOf(transaction.date));
	const current = context.months[context.months.length - 1];
	const max = Math.max(...context.months.map((m) => m.total), 1);
	const span = context.months.length - 1;
	const money = (value: number) => (masked ? maskAmount(unit) : formatAmount(value, unit));

	// "Better" depends on the side: more income is good news, more spending isn't.
	const change = context.average > 0 ? (current.total - context.average) / context.average : null;
	const percent = change === null ? 0 : Math.round(Math.abs(change) * 100);
	const good = change !== null && (income ? change >= 0 : change <= 0);
	const note =
		change === null
			? { text: `Avvalgi ${span} oyda bunday yozuv yo'q`, color: tc.mutedForeground, bg: tc.muted }
			: percent < 5
				? { text: `${month} o'rtacha darajada`, color: tc.mutedForeground, bg: tc.muted }
				: {
						text: `${month} o'rtachadan ${percent}% ${change > 0 ? "ko'p" : "kam"}`,
						color: good ? tc.success : tc.danger,
						bg: good ? tc.successSoft : tc.dangerSoft,
					};
	const shareLine =
		current.count > 1
			? `Bu yozuv ${month.toLowerCase()}dagi ${kindName.toLowerCase()} ${income ? "kirimining" : "chiqimining"} ${Math.round(context.share * 100)} foizi`
			: `${month}da ${kindName.toLowerCase()} bo'yicha yagona yozuv`;

	return (
		<Outlined>
			<View className="flex-row items-baseline justify-between" style={{ gap: 8 }}>
				<Text accessibilityRole="header" className="font-extrabold text-foreground shrink" style={{ fontSize: tf.base }} numberOfLines={1}>
					{`${kindName} · so'nggi ${context.months.length} oy`}
				</Text>
				<Text className="font-bold text-muted-foreground" style={{ fontSize: tf.xs }}>
					oylik jami
				</Text>
			</View>

			<View
				accessible
				accessibilityRole="image"
				accessibilityLabel={context.months
					.map((m) => `${monthName(m.monthKey)}: ${money(m.total)}`)
					.join(", ")}
				className="flex-row items-end"
				style={{ gap: 8, height: 132, marginTop: 12 }}
			>
				{context.months.map((m, index) => {
					const last = index === context.months.length - 1;
					return (
						<View key={m.monthKey} className="flex-1 items-center justify-end" style={{ gap: 4, height: "100%" }}>
							{!masked && (
								<Text
									className="font-bold"
									style={{ fontSize: tf.xs - 1.5, color: last ? tc.foreground : tc.placeholder }}
									numberOfLines={1}
									adjustsFontSizeToFit
								>
									{m.total > 0 ? formatCompact(m.total, unit) : "0"}
								</Text>
							)}
							<View
								style={{
									width: "100%",
									maxWidth: 28,
									height: Math.max(3, Math.round((m.total / max) * 84)),
									borderTopLeftRadius: 5,
									borderTopRightRadius: 5,
									backgroundColor: last ? (income ? tc.success : tc.foreground) : tc.disabled,
								}}
							/>
							<Text
								style={{
									fontSize: tf.xs - 0.5,
									fontWeight: last ? "800" : "600",
									color: last ? tc.foreground : tc.placeholder,
								}}
							>
								{monthShortLabel(m.monthKey)}
							</Text>
						</View>
					);
				})}
			</View>

			<View className="flex-row" style={{ gap: 4, marginTop: 14 }}>
				<StatTile label={`${month}da · ${current.count} ta yozuv`} value={money(current.total)} />
				<StatTile label={`${span} oylik o'rtacha`} value={money(context.average)} />
			</View>
			<View
				className="self-start justify-center"
				style={{ minHeight: 26, paddingHorizontal: 10, borderRadius: 13, marginTop: 10, backgroundColor: note.bg }}
			>
				<Text className="font-extrabold" style={{ fontSize: tf.sm - 1.5, color: note.color }}>
					{note.text}
				</Text>
			</View>
			<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 1, marginTop: 8 }}>
				{shareLine}
			</Text>
		</Outlined>
	);
}

function StatTile({ label, value }: { label: string; value: string }) {
	const { tf } = useFont();
	return (
		<View className="flex-1 bg-card" style={{ gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14 }}>
			<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.xs }} numberOfLines={1}>
				{label}
			</Text>
			<Text className="font-extrabold text-foreground" style={{ fontSize: tf.base }} numberOfLines={1} adjustsFontSizeToFit>
				{value}
			</Text>
		</View>
	);
}

/** An earlier entry of the same kind — its note (or the kind), its day, its amount. */
function PreviousRow({
	transaction,
	fallback,
	amount,
	divider,
	onPress,
}: {
	transaction: Transaction;
	fallback: string;
	amount: string;
	divider: boolean;
	onPress: () => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const handlePress = useGuardedPress(onPress);
	const income = transaction.type === "income";
	const label = transaction.description || fallback;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${label}, ${formatDayMonth(transaction.date)}, ${amount}`}
			onPress={handlePress}
			className={`flex-row items-center active:opacity-70 ${divider ? "border-t border-border" : ""}`}
			style={{ gap: 12, paddingVertical: 10, paddingHorizontal: 2 }}
		>
			<View className="items-center justify-center bg-muted" style={{ width: 36, height: 36, borderRadius: 12 }}>
				<Ionicons name="receipt-outline" size={18} color={tc.mutedForeground} />
			</View>
			<View className="flex-1">
				<Text className="font-bold text-foreground" style={{ fontSize: tf.base - 0.5 }} numberOfLines={1}>
					{label}
				</Text>
				<Text className="font-semibold" style={{ fontSize: tf.xs, color: tc.placeholder }}>
					{formatDayMonth(transaction.date)}
				</Text>
			</View>
			<Text
				className="font-extrabold"
				style={{ fontSize: tf.base, color: income ? tc.success : tc.foreground }}
				numberOfLines={1}
			>
				{amount}
			</Text>
		</Pressable>
	);
}

/** The copy button beside "Tahrirlash": the same height, square. */
function SquareButton({
	icon,
	accessibilityLabel,
	onPress,
}: {
	icon: keyof typeof Ionicons.glyphMap;
	accessibilityLabel: string;
	onPress: () => void;
}) {
	const { tc } = useTheme();
	const handlePress = useGuardedPress(onPress);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			onPress={handlePress}
			className="items-center justify-center bg-muted active:opacity-70"
			style={{ width: 58, height: 58, borderRadius: 29 }}
		>
			<Ionicons name={icon} size={20} color={tc.foreground} />
		</Pressable>
	);
}
