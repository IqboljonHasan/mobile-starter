import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Text, TextInput } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";

/**
 * The search field a list opens from its ⋮ menu — focused straight away, and
 * closed with the button beside it, which also clears it: a search the user
 * has put away shouldn't go on quietly hiding rows.
 */
export default function SearchBar({
	value,
	onChangeText,
	onClose,
	placeholder,
}: {
	value: string;
	onChangeText: (text: string) => void;
	onClose: () => void;
	placeholder: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();

	return (
		<View className="flex-row items-center" style={{ gap: 8 }}>
			<View
				className="flex-1 flex-row items-center"
				style={{ gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: tc.card }}
			>
				<Ionicons name="search" size={18} color={tc.mutedForeground} />
				<TextInput
					accessibilityLabel={placeholder}
					value={value}
					onChangeText={onChangeText}
					placeholder={placeholder}
					placeholderTextColor={tc.placeholder}
					autoFocus
					autoCorrect={false}
					returnKeyType="search"
					className="flex-1 font-semibold"
					style={{ fontSize: tf.base, color: tc.foreground, paddingVertical: 0 }}
				/>
				{!!value && (
					<Pressable accessibilityLabel="Matnni tozalash" onPress={() => onChangeText("")} hitSlop={10}>
						<Ionicons name="close-circle" size={18} color={tc.mutedForeground} />
					</Pressable>
				)}
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Qidiruvni yopish"
				onPress={onClose}
				hitSlop={6}
				className="justify-center active:opacity-60"
				style={{ height: 48, paddingHorizontal: 4 }}
			>
				<Text className="font-bold text-foreground" style={{ fontSize: tf.sm + 1 }}>
					Bekor
				</Text>
			</Pressable>
		</View>
	);
}
