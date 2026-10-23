import { Ionicons } from "@expo/vector-icons";
import { Fragment, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { IconButton } from "@/components/ui/IconButton";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export type HeaderMenuItem = {
	key: string;
	label: string;
	icon: keyof typeof Ionicons.glyphMap;
	/** Red — an action that throws something away. */
	danger?: boolean;
	/** Draws a hairline above the item, to set it apart from the ones before. */
	separatorBefore?: boolean;
	onPress: () => void;
};

/** Long enough for the menu to have faded before an item opens a sheet of its own. */
const AFTER_CLOSE_MS = 220;

/**
 * The ⋮ button in a screen's header and the menu it drops down: a white card
 * anchored under the button, right-aligned with it, listing the screen's less
 * frequent actions. A tap outside closes it; so does the back button.
 *
 * The menu closes before an item's action runs, so an action that opens a
 * sheet or an alert of its own never stacks on top of it.
 */
export function HeaderMenu({
	items,
	accessibilityLabel = "Boshqa amallar",
}: {
	items: HeaderMenuItem[];
	accessibilityLabel?: string;
}) {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const { width } = useWindowDimensions();
	const anchor = useRef<View>(null);
	const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

	const open = () => {
		anchor.current?.measureInWindow((x, y, w, h) =>
			setPosition({ top: y + h + 6, right: Math.max(width - (x + w), 8) }),
		);
	};
	const close = () => setPosition(null);

	return (
		<>
			<View ref={anchor} collapsable={false}>
				<IconButton
					variant="filled"
					icon="ellipsis-vertical"
					accessibilityLabel={accessibilityLabel}
					active={position !== null}
					onPress={open}
				/>
			</View>

			<Modal
				visible={position !== null}
				transparent
				animationType="fade"
				// Full-window, like the coordinates the anchor was measured in.
				statusBarTranslucent
				navigationBarTranslucent
				onRequestClose={close}
			>
				<Pressable
					accessibilityLabel="Menyuni yopish"
					onPress={close}
					style={StyleSheet.absoluteFill}
				/>
				{position && (
					<View
						accessibilityRole="menu"
						accessibilityLabel={accessibilityLabel}
						style={{
							position: "absolute",
							top: position.top,
							right: position.right,
							minWidth: 232,
							padding: 6,
							borderRadius: 20,
							backgroundColor: tc.background,
							borderWidth: isDark ? 1 : 0,
							borderColor: tc.border,
							shadowColor: "#0b1b2e",
							shadowOffset: { width: 0, height: 16 },
							shadowOpacity: 0.18,
							shadowRadius: 20,
							elevation: 12,
						}}
					>
						{items.map((item) => (
							<Fragment key={item.key}>
								{item.separatorBefore && (
									<View
										style={{
											height: 1,
											marginVertical: 4,
											marginHorizontal: 12,
											backgroundColor: tc.border,
										}}
									/>
								)}
								<Pressable
									accessibilityRole="menuitem"
									onPress={() => {
										close();
										setTimeout(item.onPress, AFTER_CLOSE_MS);
									}}
									style={({ pressed }) => ({
										flexDirection: "row",
										alignItems: "center",
										gap: 12,
										height: 48,
										paddingHorizontal: 12,
										borderRadius: 14,
										backgroundColor: pressed ? tc.muted : "transparent",
									})}
								>
									<Ionicons
										name={item.icon}
										size={20}
										color={item.danger ? tc.danger : tc.foreground}
									/>
									<Text
										className="font-semibold"
										style={{ fontSize: tf.base, color: item.danger ? tc.danger : tc.foreground }}
										numberOfLines={1}
									>
										{item.label}
									</Text>
								</Pressable>
							</Fragment>
						))}
					</View>
				)}
			</Modal>
		</>
	);
}
