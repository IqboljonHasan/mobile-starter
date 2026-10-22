import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Select } from "@/components/ui";
import { Text, TextInput } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { groupAmountText, PAY_METHODS, UNITS, unitByCode } from "@/lib/money";
import type { PayMethod } from "@/lib/types";

/**
 * The head of every money form: what is being recorded, in large type, with
 * how it was paid and in what currency alongside.
 *
 * The figure is typed with the app's NumberPad, not the system keyboard —
 * the field is a real TextInput that never raises the keyboard, so focus still
 * works as usual and the form opens the pad on `onFocus`. See AmountField for
 * the same arrangement in a plain field.
 */
export default function AmountCard({
	value,
	onFocus,
	onBlur,
	method,
	onMethodChange,
	unit,
	onUnitChange,
	unitLocked = false,
	error,
	label = "Summa",
}: {
	/** The amount text as stored in the form — plain digits, no grouping. */
	value: string;
	onFocus: () => void;
	onBlur: () => void;
	method: PayMethod;
	onMethodChange: (method: PayMethod) => void;
	unit: string;
	onUnitChange: (unit: string) => void;
	/** Once something has been paid against a debt its currency is fixed. */
	unitLocked?: boolean;
	error?: string;
	label?: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { symbol } = unitByCode(unit);
	const big = Math.round(tf.xxxl * 1.38);

	return (
		<View>
			<View
				className="bg-card"
				style={{
					borderRadius: 20,
					paddingTop: 12,
					paddingRight: 12,
					paddingBottom: 14,
					paddingLeft: 16,
					borderWidth: 1.5,
					borderColor: error ? tc.danger : "transparent",
				}}
			>
				<View className="flex-row items-center justify-between gap-3">
					<Text className="font-bold text-muted-foreground" style={{ fontSize: tf.sm }}>
						{label}
					</Text>
					<View
						accessibilityRole="radiogroup"
						accessibilityLabel="To'lov turi"
						className="flex-row bg-background rounded-full"
						style={{ padding: 3, gap: 2 }}
					>
						{PAY_METHODS.map((item) => {
							const active = item.key === method;
							return (
								<Pressable
									key={item.key}
									accessibilityRole="radio"
									accessibilityState={{ checked: active }}
									onPress={() => onMethodChange(item.key)}
									className={`flex-row items-center justify-center rounded-full ${
										active ? "bg-primary" : ""
									}`}
									style={{ height: 38, paddingHorizontal: 12, gap: 6 }}
								>
									<Ionicons
										name={item.icon}
										size={16}
										color={active ? tc.primaryFg : tc.foreground}
									/>
									<Text
										className={`font-bold ${active ? "text-primary-fg" : "text-foreground"}`}
										style={{ fontSize: tf.sm }}
									>
										{item.label}
									</Text>
								</Pressable>
							);
						})}
					</View>
				</View>

				<View className="flex-row items-center gap-2 mt-2">
					<TextInput
						accessibilityLabel={label}
						value={groupAmountText(value)}
						placeholder="0"
						placeholderTextColor={tc.placeholder}
						onFocus={onFocus}
						onBlur={onBlur}
						// Typed on the in-app pad: the field never raises the keyboard,
						// and since the pad only appends or deletes at the end, a caret
						// that could be tapped elsewhere would promise an edit it can't
						// make.
						showSoftInputOnFocus={false}
						caretHidden
						contextMenuHidden
						className="flex-1 font-extrabold"
						style={{
							padding: 0,
							fontSize: big,
							lineHeight: Math.round(big * 1.22),
							letterSpacing: -0.8,
							color: tc.foreground,
						}}
					/>
					<Select
						label="Valyuta"
						value={unit}
						toggleOff={false}
						disabled={unitLocked}
						onChange={(next) => next && onUnitChange(next)}
						options={UNITS.map((u) => ({ key: u.code, label: `${u.code} — ${u.name}` }))}
						trigger={({ open }) => (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`Valyuta: ${unitByCode(unit).name}`}
								accessibilityState={{ disabled: unitLocked }}
								disabled={unitLocked}
								onPress={open}
								hitSlop={8}
								className="flex-row items-center gap-1 active:opacity-60"
							>
								<Text
									className="font-bold text-muted-foreground"
									style={{ fontSize: tf.lg + 1 }}
								>
									{symbol}
								</Text>
								{!unitLocked && (
									<Ionicons name="chevron-down" size={14} color={tc.mutedForeground} />
								)}
							</Pressable>
						)}
					/>
				</View>
			</View>
			{!!error && (
				<Text className="font-semibold text-danger mt-1.5 ml-1" style={{ fontSize: tf.sm }}>
					{error}
				</Text>
			)}
		</View>
	);
}
