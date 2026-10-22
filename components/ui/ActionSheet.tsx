import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import BottomSheet from "@/components/ui/BottomSheet";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export type ActionSheetItem = {
	key: string;
	label: string;
	icon: keyof typeof Ionicons.glyphMap;
	/** A short line under the label. */
	hint?: string;
	danger?: boolean;
	onPress: () => void;
};

/**
 * What the ⋮ button in a screen's header opens: the screen's less frequent
 * actions as a short list in a sheet. The sheet closes first and the action
 * runs after, so an action that opens a sheet or an alert of its own doesn't
 * stack on top of this one.
 */
export function ActionSheet({
	visible,
	onClose,
	title,
	items,
}: {
	visible: boolean;
	onClose: () => void;
	title?: string;
	items: ActionSheetItem[];
}) {
	const { tc } = useTheme();
	const { tf } = useFont();

	return (
		<BottomSheet visible={visible} onClose={onClose} backdrop="faint">
			<View className="px-4 pb-2">
				{!!title && (
					<Text className="font-extrabold text-foreground mb-2 ml-1" style={{ fontSize: tf.lg }}>
						{title}
					</Text>
				)}
				<View className="rounded-[20px] bg-card overflow-hidden">
					{items.map((item, index) => (
						<Pressable
							key={item.key}
							accessibilityRole="button"
							onPress={() => {
								onClose();
								// After the close animation has started, so the next sheet
								// or alert isn't opened from inside a closing Modal.
								setTimeout(item.onPress, 260);
							}}
							className={`flex-row items-center gap-3 px-3.5 active:opacity-70 ${
								index > 0 ? "border-t border-border" : ""
							}`}
							style={{ minHeight: 56 }}
						>
							<View
								className={`items-center justify-center ${item.danger ? "bg-danger-soft" : "bg-background"}`}
								style={{ width: 32, height: 32, borderRadius: 10 }}
							>
								<Ionicons
									name={item.icon}
									size={18}
									color={item.danger ? tc.danger : tc.foreground}
								/>
							</View>
							<View className="flex-1 py-2.5">
								<Text
									className={`font-semibold ${item.danger ? "text-danger" : "text-foreground"}`}
									style={{ fontSize: tf.base }}
								>
									{item.label}
								</Text>
								{!!item.hint && (
									<Text
										className="font-semibold text-muted-foreground"
										style={{ fontSize: tf.sm - 1 }}
									>
										{item.hint}
									</Text>
								)}
							</View>
						</Pressable>
					))}
				</View>
			</View>
		</BottomSheet>
	);
}
