import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import BottomSheet from "@/components/ui/BottomSheet";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import {
	addDaysISO,
	buildMonthGrid,
	formatFieldDate,
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
	/** Days before this are not selectable — a due date can't come before the loan. */
	minDate?: string;
	/** Text drawn in the field in place of the date — "Muddatsiz", say. */
	placeholder?: string;
	/** The quick picks under the calendar. Defaults to today and yesterday. */
	quickPicks?: { label: string; iso: string }[];
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
	minDate,
	placeholder,
	quickPicks,
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

	const outOfRange = (iso: string) =>
		(!!maxDate && iso > maxDate) || (!!minDate && iso < minDate);

	const pick = (iso: string) => {
		if (outOfRange(iso)) return;
		onChange(iso);
		setOpen(false);
	};

	const quick = (
		quickPicks ?? [
			{ label: "Bugun", iso: today },
			{ label: "Kecha", iso: addDaysISO(today, -1) },
		]
	).filter((q) => !outOfRange(q.iso));

	const shown = placeholder ?? formatFieldDate(value);

	return (
		<View>
			{!!label && <FieldLabel required={required}>{label}</FieldLabel>}

			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${label ? `${label}: ` : ""}${shown}`}
				onPress={openSheet}
				className="flex-row items-center gap-2 pl-4 pr-3 active:opacity-70"
				style={{ backgroundColor: tc.card, borderRadius: 16, minHeight: 52 }}
			>
				<Text
					className="flex-1 font-bold"
					style={{ fontSize: tf.base, color: placeholder ? tc.placeholder : tc.foreground }}
					numberOfLines={1}
				>
					{shown}
				</Text>
				<Ionicons name="calendar-clear-outline" size={18} color={tc.mutedForeground} />
			</Pressable>

			<BottomSheet visible={open} onClose={() => setOpen(false)} backdrop="faint">
				<View className="px-4 pb-2">
					<View className="flex-row items-center justify-between py-2">
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Oldingi oy"
							onPress={() => setMonth((m) => shiftMonth(m, -1))}
							className="w-11 h-11 items-center justify-center rounded-full bg-muted active:opacity-60"
						>
							<Ionicons name="chevron-back" size={18} color={tc.foreground} />
						</Pressable>
						<Text className="font-extrabold text-foreground" style={{ fontSize: tf.lg }}>
							{monthTitle(month)}
						</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Keyingi oy"
							onPress={() => setMonth((m) => shiftMonth(m, 1))}
							className="w-11 h-11 items-center justify-center rounded-full bg-muted active:opacity-60"
						>
							<Ionicons name="chevron-forward" size={18} color={tc.foreground} />
						</Pressable>
					</View>

					<View className="flex-row mt-1">
						{WEEKDAY_INITIALS.map((day, i) => (
							<Text
								key={`${day}-${i}`}
								className="flex-1 text-center font-bold text-muted-foreground py-1"
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
								const disabled = outOfRange(cell.iso);
								return (
									<Pressable
										key={cell.iso}
										accessibilityRole="button"
										accessibilityState={{ selected, disabled }}
										disabled={disabled}
										onPress={() => pick(cell.iso)}
										className="flex-1 items-center justify-center py-0.5"
									>
										<View
											className="w-10 h-10 items-center justify-center rounded-full"
											style={{
												backgroundColor: selected ? tc.primary : "transparent",
												borderWidth: !selected && isToday ? 1.5 : 0,
												borderColor: tc.primary,
											}}
										>
											<Text
												style={{
													fontSize: tf.base,
													fontWeight: selected || isToday ? "800" : "600",
													color: selected
														? tc.primaryFg
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

					{quick.length > 0 && (
						<View className="flex-row gap-2 pt-3">
							{quick.map((q) => {
								const active = value === q.iso && !placeholder;
								return (
									<Pressable
										key={q.label}
										accessibilityRole="button"
										accessibilityState={{ selected: active }}
										onPress={() => pick(q.iso)}
										className={`flex-1 h-11 rounded-full items-center justify-center active:opacity-70 ${
											active ? "bg-primary" : "bg-muted"
										}`}
									>
										<Text
											className={`font-bold ${active ? "text-primary-fg" : "text-foreground"}`}
											style={{ fontSize: tf.sm + 1 }}
										>
											{q.label}
										</Text>
									</Pressable>
								);
							})}
						</View>
					)}
				</View>
			</BottomSheet>
		</View>
	);
}
