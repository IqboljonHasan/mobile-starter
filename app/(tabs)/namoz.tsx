import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, SectionList, Text, View } from "react-native";
import TabHeader from "@/components/TabHeader";
import { Button, Card, SegmentedControl } from "@/components/ui";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useQazaMarks } from "@/hooks/useQazaMarks";
import { useTheme } from "@/hooks/useTheme";
import {
	byDay,
	type DaySection,
	ENTRIES,
	formatDay,
	isOwed,
	PRAYER_NAMES,
	type PrayerEntry,
	wasMissed,
} from "@/lib/prayers";
import "../../global.css";

type Filter = "all" | "owed";

const ALL_SECTIONS = byDay(ENTRIES);
const MISSED_TOTAL = ENTRIES.filter(wasMissed).length;

/**
 * The prayer record from the Loop backup, newest day first, with the missed
 * prayers that still owe a qazo one filter away. Marking one as read moves it
 * out of that filter; it stays in the full list, told apart from a prayer
 * read on time, and can be taken back.
 */
export default function NamozScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const shadow = useTabScrollShadow("namoz");
	const { marks, loaded, mark, unmark } = useQazaMarks();
	const [filter, setFilter] = useState<Filter>("all");

	const owed = useMemo(() => ENTRIES.filter((e) => isOwed(e, marks)), [marks]);
	const owedByPrayer = useMemo(
		() => PRAYER_NAMES.map((_, i) => owed.filter((e) => e.prayer === i).length),
		[owed],
	);
	const sections = useMemo(
		() => (filter === "owed" ? byDay(owed) : ALL_SECTIONS),
		[filter, owed],
	);

	const onMark = useCallback(
		(key: string) => {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			mark(key);
		},
		[mark],
	);

	if (!loaded) {
		return (
			<View className="flex-1 bg-background">
				<TabHeader title="Namoz" />
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color={tc.primary} />
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<TabHeader title="Namoz" subtitle={`Loop zaxirasi · ${ENTRIES.length} ta yozuv`} />
			<SectionList<PrayerEntry, DaySection>
				{...shadow}
				sections={sections}
				extraData={marks}
				keyExtractor={(e) => e.key}
				stickySectionHeadersEnabled={false}
				initialNumToRender={24}
				contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
				showsVerticalScrollIndicator={false}
				ListHeaderComponent={
					<View className="gap-3">
						<Summary owed={owed.length} owedByPrayer={owedByPrayer} />
						<SegmentedControl<Filter>
							items={[
								{ key: "all", label: "Hammasi" },
								{ key: "owed", label: `O'qilmaganlar · ${owed.length}` },
							]}
							value={filter}
							onChange={setFilter}
						/>
					</View>
				}
				renderSectionHeader={({ section }) => (
					<Text
						className="font-semibold text-muted-foreground px-1 pt-5 pb-2"
						style={{ fontSize: tf.sm }}
					>
						{formatDay(section.date)}
					</Text>
				)}
				renderItem={({ item, index, section }) => (
					<PrayerRow
						entry={item}
						markedAt={marks[item.key]}
						first={index === 0}
						last={index === section.data.length - 1}
						onMark={onMark}
						onUnmark={unmark}
					/>
				)}
				ListEmptyComponent={
					<Card className="mt-4 items-center">
						<Ionicons name="checkmark-done-circle-outline" size={36} color={tc.success} />
						<Text
							className="font-semibold text-foreground mt-2"
							style={{ fontSize: tf.base }}
						>
							{"O'qilmagan namoz qolmadi"}
						</Text>
						<Text className="text-muted-foreground mt-1 text-center" style={{ fontSize: tf.sm }}>
							{"Hammasining qazosi o'qildi deb belgilangan."}
						</Text>
					</Card>
				}
			/>
		</View>
	);
}

/** How much qazo is left, overall and per prayer. */
function Summary({ owed, owedByPrayer }: { owed: number; owedByPrayer: number[] }) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const madeUp = MISSED_TOTAL - owed;

	return (
		<Card>
			<Text className="font-medium text-muted-foreground" style={{ fontSize: tf.sm }}>
				{"O'qilmagan namozlar"}
			</Text>
			<View className="flex-row items-baseline gap-1.5 mt-1">
				<Text className="font-bold text-foreground" style={{ fontSize: tf.xxxl }}>
					{owed}
				</Text>
				<Text className="text-muted-foreground" style={{ fontSize: tf.base }}>
					ta qoldi
				</Text>
			</View>

			<View
				className="rounded-full overflow-hidden mt-3"
				style={{ height: 8, backgroundColor: tc.muted }}
			>
				<View
					style={{
						width: `${MISSED_TOTAL ? (madeUp / MISSED_TOTAL) * 100 : 0}%`,
						height: 8,
						borderRadius: 4,
						backgroundColor: tc.success,
					}}
				/>
			</View>
			<Text className="text-muted-foreground mt-2" style={{ fontSize: tf.sm }}>
				{`${MISSED_TOTAL} tadan ${madeUp} tasining qazosi o'qildi`}
			</Text>

			<View className="flex-row mt-4 pt-3 border-t border-border">
				{PRAYER_NAMES.map((name, i) => (
					<View key={name} className="flex-1 items-center">
						<Text
							className={`font-bold ${owedByPrayer[i] ? "text-danger" : "text-success"}`}
							style={{ fontSize: tf.lg }}
						>
							{owedByPrayer[i]}
						</Text>
						<Text
							className="text-muted-foreground"
							style={{ fontSize: tf.xs }}
							numberOfLines={1}
						>
							{/* "Xufton & Vitr" doesn't fit a fifth of the card. */}
							{name.split(" ")[0]}
						</Text>
					</View>
				))}
			</View>

			<Text className="text-muted-foreground mt-3" style={{ fontSize: tf.xs }}>
				{"Loop'da «bajarilmadi» yoki «belgisiz» deb belgilanganlar. Umuman belgi qo'yilmagan namozlar hisobga olinmagan."}
			</Text>
		</Card>
	);
}

function PrayerRow({
	entry,
	markedAt,
	first,
	last,
	onMark,
	onUnmark,
}: {
	entry: PrayerEntry;
	markedAt: number | undefined;
	first: boolean;
	last: boolean;
	onMark: (key: string) => void;
	onUnmark: (key: string) => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const madeUp = markedAt !== undefined;
	const owed = wasMissed(entry) && !madeUp;

	const look: { icon: keyof typeof Ionicons.glyphMap; color: string; note: string } =
		entry.status === "prayed"
			? { icon: "checkmark-circle", color: tc.success, note: "O'z vaqtida o'qilgan" }
			: madeUp
				? { icon: "checkmark-circle", color: tc.primary, note: "Qazosi o'qildi" }
				: entry.status === "missed"
					? { icon: "close-circle", color: tc.danger, note: "O'qilmagan" }
					: { icon: "help-circle", color: tc.warning, note: "Belgisiz" };

	// Each day reads as one card: rounded at its ends, hairlines between.
	return (
		<View
			className={`flex-row items-center gap-3 bg-card px-4 py-3 ${
				first ? "rounded-t-2xl" : "border-t border-border"
			} ${last ? "rounded-b-2xl" : ""}`}
		>
			<Ionicons name={look.icon} size={22} color={look.color} />
			<View className="flex-1">
				<Text className="font-medium text-foreground" style={{ fontSize: tf.base }}>
					{PRAYER_NAMES[entry.prayer]}
				</Text>
				<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
					{look.note}
				</Text>
			</View>
			{owed && (
				<Button
					label="O'qildi"
					size="sm"
					variant="soft"
					color="success"
					startIcon={<Ionicons name="checkmark" size={16} color={tc.success} />}
					onPress={() => onMark(entry.key)}
				/>
			)}
			{madeUp && (
				<Button
					label="Qaytarish"
					size="sm"
					variant="text"
					color="secondary"
					onPress={() => onUnmark(entry.key)}
				/>
			)}
		</View>
	);
}
