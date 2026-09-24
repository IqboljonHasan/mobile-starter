import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import DebtRow from "@/components/DebtRow";
import TabHeader from "@/components/TabHeader";
import { Button, Card, EmptyState, IconButton } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { todayISO } from "@/lib/date";
import {
	contactById,
	debtStatus,
	outstandingByUnit,
	sortDebts,
} from "@/lib/debts";
import { formatAmount } from "@/lib/money";
import type { DebtDirection } from "@/lib/types";
import "../../global.css";

/** Which slice of the list is showing. */
type Filter = "open" | "borrowed" | "lent" | "settled";

const FILTERS: { key: Filter; label: string }[] = [
	{ key: "open", label: "Ochiq" },
	{ key: "borrowed", label: "Olganlarim" },
	{ key: "lent", label: "Berganlarim" },
	{ key: "settled", label: "Yopilgan" },
];

/**
 * Who owes what, and to whom.
 *
 * Every movement shown here is also a real entry in the ledger — borrowing
 * writes an income, lending an expense, and each repayment the opposite — so
 * the money genuinely enters and leaves wallets. What this tab adds on top is
 * the running balance per loan, which a flat list of transactions can't carry.
 *
 * It opens on the open debts rather than everything: a settled debt is history,
 * and history belongs on the Kirim/Chiqim tabs where the entries already live.
 */
export default function DebtsScreen() {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const shadow = useTabScrollShadow("debts");
	const { ready, debts, contacts } = useLedger();

	const [filter, setFilter] = useState<Filter>("open");
	const today = todayISO();

	const totals = useMemo(() => outstandingByUnit(debts), [debts]);

	const visible = useMemo(() => {
		const matched = debts.filter((debt) => {
			const status = debtStatus(debt, today);
			if (filter === "settled") return status === "settled";
			if (filter === "open") return status !== "settled";
			// The two direction filters are about the debt itself, not its state,
			// so they show a person's whole history with the user.
			return debt.direction === (filter as DebtDirection);
		});
		return sortDebts(matched, today);
	}, [debts, filter, today]);

	const overdueCount = useMemo(
		() => debts.filter((d) => debtStatus(d, today) === "overdue").length,
		[debts, today],
	);

	const openDebt = (direction: DebtDirection) =>
		router.push(`/debt?direction=${direction}`);

	if (!ready) {
		return (
			<View className="flex-1 bg-background">
				<TabHeader title="Qarzlar" />
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color={tc.primary} />
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<TabHeader
				title="Qarzlar"
				subtitle={
					overdueCount > 0
						? `${overdueCount} ta qarz muddati o'tgan`
						: debts.length
							? `${debts.length} ta qarz · ${contacts.length} ta kontakt`
							: "Qarz olish va berishni yuriting"
				}
				headerRight={
					<IconButton
						icon="people-outline"
						accessibilityLabel="Kontaktlar"
						onPress={() => router.push("/contacts")}
					/>
				}
			/>

			<FlatList
				{...shadow}
				data={visible}
				keyExtractor={(item) => item.id}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingTop: 16, paddingBottom: 96 }}
				ListHeaderComponent={
					<View className="px-4 gap-3" style={{ marginBottom: 12 }}>
						{/* One block per unit, as everywhere else — som owed and dollars
						    owed are two separate facts, not one sum. */}
						<Card>
							{totals.length === 0 ? (
								<View className="items-center py-2">
									<Text
										className="text-muted-foreground"
										style={{ fontSize: tf.base }}
									>
										{"Ochiq qarz yo'q"}
									</Text>
								</View>
							) : (
								totals.map((total, index) => (
									<View
										key={total.unit}
										className={
											index > 0 ? "flex-row pt-4 mt-4 border-t border-border" : "flex-row"
										}
									>
										<Summary
											label="Menga qarzdor"
											amount={total.owedToMe}
											unit={total.unit}
											tone="success"
										/>
										<View className="w-px bg-border" />
										<Summary
											label="Men qarzdorman"
											amount={total.owedByMe}
											unit={total.unit}
											tone="danger"
										/>
									</View>
								))
							)}
						</Card>

						<View className="flex-row gap-2">
							{FILTERS.map((item) => (
								<FilterChip
									key={item.key}
									label={item.label}
									active={filter === item.key}
									onPress={() => setFilter(item.key)}
								/>
							))}
						</View>
					</View>
				}
				renderItem={({ item, index }) => (
					<View
						className={`mx-4 bg-card ${index === 0 ? "rounded-t-2xl" : ""} ${
							index === visible.length - 1 ? "rounded-b-2xl" : ""
						}`}
					>
						<DebtRow
							debt={item}
							contact={contactById(contacts, item.contactId)}
							today={today}
							divider={index > 0}
							onPress={() => router.push(`/debt?id=${item.id}`)}
						/>
					</View>
				)}
				ListEmptyComponent={
					<EmptyState
						icon="people-outline"
						title={
							filter === "settled"
								? "Yopilgan qarz yo'q"
								: filter === "open"
									? "Ochiq qarz yo'q"
									: filter === "borrowed"
										? "Olgan qarzingiz yo'q"
										: "Bergan qarzingiz yo'q"
						}
						message={
							debts.length === 0
								? "Qarz olganingizni yoki berganingizni shu yerda yuriting — har biri hisobingizga ham yoziladi."
								: "Boshqa filtrni tanlab ko'ring."
						}
						actionLabel={debts.length === 0 ? "Qarz olish" : undefined}
						onAction={
							debts.length === 0 ? () => openDebt("borrowed") : undefined
						}
					/>
				}
			/>

			{/* Both directions are one tap away: which way a debt runs is the first
			    thing the user knows about it, so it shouldn't be a field they have
			    to change after opening the wrong form. */}
			<View className="absolute right-4 bottom-4 flex-row gap-2">
				<Button
					label="Oldim"
					shape="pill"
					color="success"
					startIcon={<Ionicons name="arrow-down" size={18} color="#fff" />}
					onPress={() => openDebt("borrowed")}
					accessibilityLabel="Qarz olganimni qo'shish"
				/>
				<Button
					label="Berdim"
					shape="pill"
					color="danger"
					startIcon={<Ionicons name="arrow-up" size={18} color="#fff" />}
					onPress={() => openDebt("lent")}
					accessibilityLabel="Qarz berganimni qo'shish"
				/>
			</View>
		</View>
	);
}

function Summary({
	label,
	amount,
	unit,
	tone,
}: {
	label: string;
	amount: number;
	unit: string;
	tone: "success" | "danger";
}) {
	const { tf } = useFont();
	return (
		<View className="flex-1 items-center px-2">
			<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
				{label}
			</Text>
			<Text
				className={`font-bold mt-1 ${
					amount > 0
						? tone === "success"
							? "text-success"
							: "text-danger"
						: "text-muted-foreground"
				}`}
				style={{ fontSize: tf.xl }}
				numberOfLines={1}
				adjustsFontSizeToFit
			>
				{formatAmount(amount, unit)}
			</Text>
		</View>
	);
}

function FilterChip({
	label,
	active,
	onPress,
}: {
	label: string;
	active: boolean;
	onPress: () => void;
}) {
	const { tf } = useFont();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			onPress={onPress}
			className={`flex-1 items-center py-2 rounded-full active:opacity-70 ${
				active ? "bg-primary-highlight" : "bg-card"
			}`}
		>
			<Text
				className={`font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
				style={{ fontSize: tf.sm }}
				numberOfLines={1}
			>
				{label}
			</Text>
		</Pressable>
	);
}
