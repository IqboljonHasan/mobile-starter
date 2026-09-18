import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, View } from "react-native";
import BottomSheet from "@/components/ui/BottomSheet";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export type SelectOption<T> = { key: T; label: string };
export type SelectSection<T> = { title: string; options: SelectOption<T>[] };

export interface SelectProps<T extends string | number> {
	/** Sheet title, and the trigger's fallback text when nothing is selected. */
	label: string;
	value: T | null;
	onChange: (value: T | null) => void;
	/** Flat option list. Ignored when `sections` is given. */
	options?: SelectOption<T>[];
	/** Grouped option list, rendered under a heading per section. */
	sections?: SelectSection<T>[];
	/** Shows a "Tozalash" (clear) button in the sheet header once something is selected. */
	clearable?: boolean;
	/** Replaces the header's clear slot with custom content. */
	headerRight?: ReactNode;
	/**
	 * Tapping the already-selected row clears the selection (`onChange(null)`).
	 * Defaults to true, which fits an optional filter; pass false for a required
	 * field where re-tapping the current value should just close the sheet.
	 */
	toggleOff?: boolean;
	/** Custom row content. Defaults to a label with a checkmark when selected. */
	renderOption?: (option: SelectOption<T>, selected: boolean) => ReactNode;
	/** Shown in the sheet instead of the list when there are no options. */
	emptyMessage?: string;
	/**
	 * Custom trigger. Defaults to a bordered field matching InputField. Call
	 * `open()` from it to show the sheet.
	 */
	trigger?: (helpers: {
		open: () => void;
		selected: SelectOption<T> | undefined;
	}) => ReactNode;
	disabled?: boolean;
}

export function Select<T extends string | number>({
	label,
	value,
	onChange,
	options,
	sections,
	clearable = false,
	headerRight,
	toggleOff = true,
	renderOption,
	emptyMessage,
	trigger,
	disabled,
}: SelectProps<T>) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const [open, setOpen] = useState(false);
	const allOptions = sections
		? sections.flatMap((s) => s.options)
		: (options ?? []);
	const selected = allOptions.find((o) => o.key === value);

	// `keyboardShouldPersistTaps="handled"` on a form's ScrollView (needed so
	// this trigger's own tap isn't swallowed while a keyboard is up) also means
	// that tap never blurs whatever input was focused. Do it explicitly, or the
	// sheet opens on top of a still-focused input with the keyboard still up.
	const openSheet = () => {
		Keyboard.dismiss();
		setOpen(true);
	};

	const pick = (key: T, alreadySelected: boolean) => {
		if (alreadySelected && !toggleOff) {
			setOpen(false);
			return;
		}
		onChange(alreadySelected ? null : key);
		setOpen(false);
	};

	const renderRow = (option: SelectOption<T>) => {
		const sel = option.key === value;
		return (
			<Pressable
				key={String(option.key)}
				onPress={() => pick(option.key, sel)}
				className="border-b border-border"
			>
				{renderOption ? (
					renderOption(option, sel)
				) : (
					<View className="flex-row items-center py-3">
						<Text
							className={`flex-1 ${sel ? "font-bold text-primary" : "text-foreground"}`}
							style={{ fontSize: tf.base }}
						>
							{option.label}
						</Text>
						{sel && <Ionicons name="checkmark" size={20} color={tc.primary} />}
					</View>
				)}
			</Pressable>
		);
	};

	return (
		<>
			{trigger ? (
				trigger({ open: openSheet, selected })
			) : (
				<Pressable
					accessibilityRole="button"
					onPress={openSheet}
					disabled={disabled}
					className={`flex-row items-center gap-2 rounded-xl px-5 active:opacity-70 ${
						disabled ? "opacity-50" : ""
					}`}
					style={{
						backgroundColor: tc.card,
						borderWidth: 1,
						borderColor: tc.border,
						minHeight: 56,
					}}
				>
					<Text
						className="flex-1"
						style={{
							color: selected ? tc.foreground : tc.placeholder,
							fontSize: tf.lg,
						}}
						numberOfLines={1}
					>
						{selected ? selected.label : label}
					</Text>
					<Ionicons name="chevron-down" size={16} color={tc.mutedForeground} />
				</Pressable>
			)}

			<BottomSheet
				visible={open}
				onClose={() => setOpen(false)}
				maxHeight="70%"
				backdrop="faint"
			>
				<View className="px-4 pb-2">
					<View className="flex-row items-center justify-between mb-2">
						<Text
							className="font-bold text-foreground"
							style={{ fontSize: tf.lg }}
						>
							{label}
						</Text>
						{headerRight ??
							(clearable && selected && (
								<Pressable
									onPress={() => {
										onChange(null);
										setOpen(false);
									}}
									className="px-3 py-1.5 rounded-full bg-muted"
								>
									<Text
										className="font-medium text-muted-foreground"
										style={{ fontSize: tf.sm }}
									>
										Tozalash
									</Text>
								</Pressable>
							))}
					</View>
				</View>
				<ScrollView
					contentContainerStyle={{ paddingHorizontal: 16 }}
					keyboardShouldPersistTaps="handled"
				>
					{allOptions.length === 0 && emptyMessage ? (
						<View className="items-center py-8">
							<Text
								className="text-muted-foreground"
								style={{ fontSize: tf.base }}
							>
								{emptyMessage}
							</Text>
						</View>
					) : sections ? (
						sections.map((section) => (
							<View key={section.title}>
								<Text
									className="font-semibold text-muted-foreground uppercase tracking-wider py-2"
									style={{ fontSize: tf.xs }}
								>
									{section.title}
								</Text>
								{section.options.map(renderRow)}
							</View>
						))
					) : (
						allOptions.map(renderRow)
					)}
				</ScrollView>
			</BottomSheet>
		</>
	);
}
