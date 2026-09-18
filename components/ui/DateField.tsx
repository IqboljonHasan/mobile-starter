import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import BottomSheet from "@/components/ui/BottomSheet";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import {
	addDaysISO,
	buildMonthGrid,
	formatDate,
	formatDayLabel,
	monthKeyOf,
	monthTitle,
	shiftMonth,
	todayISO,
	WEEKDAY_INITIALS,
} from "@/lib/date";
import "../../global.css";

export interface DateFieldProps {
	/** Local calendar day, "YYYY-MM-DD". */
	value: string;
	onChange: (iso: string) => void;
	label?: string;
	required?: boolean;
	/** Days after this are not selectable — a ledger entry can't be filed in the future. */
	maxDate?: string;
}

/**
 * A date picker built in JS rather than on the native dialog: the app has no
 * native date-picker dependency, so this keeps it runnable in Expo Go and
 * looking the same on both platforms. Weeks start on Monday.
 */
export function DateField({
	value,
	onChange,
	label,
	required,
	maxDate,
}: DateFieldProps) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const [open, setOpen] = useState(false);
	const [month, setMonth] = useState(() => monthKeyOf(value));
	const today = todayISO();

	const openSheet = () => {
		// Same reason as Select: the form's ScrollView keeps taps alive while the
		// keyboard is up, so the focused input has to be dismissed explicitly.
		Keyboard.dismiss();
		setMonth(monthKeyOf(value));
		setOpen(true);
	};

	const pick = (iso: string) => {
		if (maxDate && iso > maxDate) return;
		onChange(iso);
		setOpen(false);
	};

	const quickPicks = [
		{ label: "Bugun", iso: today },
		{ label: "Kecha", iso: addDaysISO(today, -1) },
	];

	return (
		<View>
			{!!label && (
				<Text
					className="font-medium text-foreground mb-1.5"
					style={{ fontSize: tf.base }}
				>
					{label}
					{required && <Text className="text-danger"> *</Text>}
				</Text>
			)}

			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`Sana: ${formatDayLabel(value)}`}
				onPress={openSheet}
				className="flex-row items-center gap-3 rounded-xl px-5 active:opacity-70"
				style={{
					backgroundColor: tc.card,
					borderWidth: 1,
					borderColor: tc.border,
					minHeight: 56,
				}}
			>
				<Ionicons name="calendar-outline" size={20} color={tc.mutedForeground} />
				<Text className="flex-1 text-foreground" style={{ fontSize: tf.lg }}>
					{formatDayLabel(value)}
				</Text>
				{/* The relative label alone is ambiguous once it says "Fri, 18 Sep" in
				    a different year, so the absolute date always rides along. */}
				<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
					{formatDate(value)}
				</Text>
			</Pressable>

			<BottomSheet visible={open} onClose={() => setOpen(false)} backdrop="faint">
				<View className="px-4 pb-2">
					<View className="flex-row items-center justify-between py-2">
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Oldingi oy"
							onPress={() => setMonth((m) => shiftMonth(m, -1))}
							hitSlop={8}
							className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
						>
							<Ionicons name="chevron-back" size={20} color={tc.foreground} />
						</Pressable>
						<Text
							className="font-bold text-foreground"
							style={{ fontSize: tf.lg }}
						>
							{monthTitle(month)}
						</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Keyingi oy"
							onPress={() => setMonth((m) => shiftMonth(m, 1))}
							hitSlop={8}
							className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
						>
							<Ionicons name="chevron-forward" size={20} color={tc.foreground} />
						</Pressable>
					</View>

					<View className="flex-row">
						{WEEKDAY_INITIALS.map((day, i) => (
							<Text
								key={`${day}-${i}`}
								className="flex-1 text-center font-semibold text-muted-foreground py-1"
								style={{ fontSize: tf.xs }}
							>
								{day}
							</Text>
						))}
					</View>

					{buildMonthGrid(month).map((week) => (
						<View key={week[0].iso} className="flex-row">
							{week.map((cell) => {
								const selected = cell.iso === value;
								const isToday = cell.iso === today;
								const disabled = !!maxDate && cell.iso > maxDate;
								return (
									<Pressable
										key={cell.iso}
										accessibilityRole="button"
										accessibilityState={{ selected, disabled }}
										disabled={disabled}
										onPress={() => pick(cell.iso)}
										className="flex-1 items-center justify-center py-1"
									>
										<View
											className="w-10 h-10 items-center justify-center rounded-full"
											style={{
												backgroundColor: selected ? tc.primary : "transparent",
												borderWidth: !selected && isToday ? 1 : 0,
												borderColor: tc.primary,
											}}
										>
											<Text
												style={{
													fontSize: tf.base,
													fontWeight: selected || isToday ? "700" : "400",
													color: selected
														? "#fff"
														: disabled
															? tc.disabled
															: cell.inMonth
																? tc.foreground
																: tc.placeholder,
												}}
											>
												{cell.day}
											</Text>
										</View>
									</Pressable>
								);
							})}
						</View>
					))}

					<View className="flex-row gap-2 pt-3">
						{quickPicks.map((quick) => (
							<Pressable
								key={quick.label}
								accessibilityRole="button"
								onPress={() => pick(quick.iso)}
								className={`flex-1 h-11 rounded-full items-center justify-center active:opacity-70 ${
									value === quick.iso ? "bg-primary-highlight" : "bg-muted"
								}`}
							>
								<Text
									className={`font-semibold ${
										value === quick.iso ? "text-primary" : "text-foreground"
									}`}
									style={{ fontSize: tf.base }}
								>
									{quick.label}
								</Text>
							</Pressable>
						))}
					</View>
				</View>
			</BottomSheet>
		</View>
	);
}
