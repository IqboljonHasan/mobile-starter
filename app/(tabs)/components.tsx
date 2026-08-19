import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import TabHeader from "@/components/TabHeader";
import {
	Badge,
	BottomSheet,
	Button,
	Card,
	IconButton,
	InputField,
	ListRow,
	PasswordField,
	SegmentedControl,
	Select,
	Textarea,
} from "@/components/ui";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

const COUNTRIES = [
	{ key: "uz", label: "Uzbekistan" },
	{ key: "kz", label: "Kazakhstan" },
	{ key: "tr", label: "Türkiye" },
	{ key: "ae", label: "United Arab Emirates" },
];

/** Live gallery of every component in `components/ui` — the reference for building screens. */
export default function ComponentsScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const shadow = useTabScrollShadow("components");

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [note, setNote] = useState("");
	const [country, setCountry] = useState<string | null>("uz");
	const [segment, setSegment] = useState<"all" | "active" | "done">("all");
	const [pushEnabled, setPushEnabled] = useState(true);
	const [loading, setLoading] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);

	const runLoading = () => {
		setLoading(true);
		setTimeout(() => setLoading(false), 1200);
	};

	return (
		<View className="flex-1 bg-background">
			<TabHeader
				title="Components"
				subtitle="components/ui"
				headerRight={
					<IconButton
						icon="information-circle-outline"
						accessibilityLabel="About this screen"
						onPress={() => setSheetOpen(true)}
					/>
				}
			/>
			<ScrollView
				{...shadow}
				contentContainerStyle={{ padding: 16, gap: 12 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Card title="Buttons" subtitle="4 variants × 4 colors × 3 sizes">
					<View className="gap-3">
						<View className="flex-row flex-wrap gap-2">
							<Button label="Solid" />
							<Button label="Outline" variant="outline" />
							<Button label="Soft" variant="soft" />
							<Button label="Text" variant="text" />
						</View>
						<View className="flex-row flex-wrap gap-2">
							<Button label="Success" color="success" size="sm" />
							<Button label="Danger" color="danger" size="sm" />
							<Button label="Secondary" color="secondary" size="sm" />
							<Button label="Disabled" size="sm" disabled />
						</View>
						<View className="flex-row flex-wrap gap-2 items-center">
							<Button
								label="With icon"
								shape="pill"
								startIcon={<Ionicons name="add" size={16} color="#fff" />}
							/>
							<Button
								label={loading ? "Saving" : "Tap to load"}
								variant="outline"
								loading={loading}
								onPress={runLoading}
							/>
						</View>
						<Button label="Full width" fullWidth size="lg" />
					</View>
				</Card>

				<Card title="Segmented control">
					<SegmentedControl
						items={[
							{ key: "all", label: "All", icon: "list-outline" },
							{ key: "active", label: "Active", icon: "flash-outline" },
							{ key: "done", label: "Done", icon: "checkmark-outline" },
						]}
						value={segment}
						onChange={setSegment}
					/>
					<Text
						className="text-muted-foreground mt-3"
						style={{ fontSize: tf.sm }}
					>
						Selected: {segment}
					</Text>
				</Card>

				<Card title="Form fields">
					<View className="gap-4">
						<InputField
							label="Full name"
							required
							placeholder="Jane Doe"
							value={name}
							onChangeText={setName}
							hint="Shown on your profile."
						/>
						<InputField
							label="Email"
							placeholder="jane@example.com"
							keyboardType="email-address"
							autoCapitalize="none"
							value={email}
							onChangeText={setEmail}
							// Only complain once there's something to complain about — an
							// empty field the user hasn't reached yet isn't an error.
							error={
								email.length > 0 && !email.includes("@")
									? "Enter a valid email address"
									: undefined
							}
						/>
						<PasswordField
							label="Password"
							placeholder="••••••••"
							value={password}
							onChangeText={setPassword}
						/>
						<Select
							label="Country"
							value={country}
							onChange={setCountry}
							options={COUNTRIES}
							clearable
							toggleOff={false}
						/>
						<Textarea
							label="Note"
							placeholder="Anything else we should know?"
							rows={3}
							value={note}
							onChangeText={setNote}
						/>
					</View>
				</Card>

				<Card title="Badges">
					<View className="flex-row flex-wrap gap-2">
						<Badge label="Neutral" />
						<Badge label="Primary" tone="primary" />
						<Badge label="Success" tone="success" />
						<Badge label="Warning" tone="warning" />
						<Badge label="Danger" tone="danger" />
					</View>
				</Card>

				<Card flush title="List rows">
					<ListRow
						title="Navigates"
						subtitle="Chevron appears when onPress is set"
						icon="navigate-outline"
						onPress={() => setSheetOpen(true)}
					/>
					<ListRow
						title="Push notifications"
						subtitle="Custom trailing element"
						icon="notifications-outline"
						divider
						trailing={
							<Switch
								value={pushEnabled}
								onValueChange={setPushEnabled}
								trackColor={{ false: tc.disabled, true: tc.primary }}
								thumbColor="#fff"
							/>
						}
					/>
					<ListRow
						title="With a badge"
						icon="pricetag-outline"
						divider
						trailing={<Badge label="New" tone="success" />}
					/>
					<ListRow
						title="Destructive"
						subtitle="danger tints icon and label"
						icon="trash-outline"
						danger
						divider
						onPress={() => {}}
					/>
				</Card>

				<Card title="Bottom sheet">
					<Button
						label="Open sheet"
						variant="soft"
						onPress={() => setSheetOpen(true)}
					/>
				</Card>
			</ScrollView>

			<BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
				<View className="px-4 pt-2 gap-3">
					<Text
						className="font-bold text-foreground"
						style={{ fontSize: tf.xl }}
					>
						Bottom sheet
					</Text>
					<Text
						className="text-muted-foreground"
						style={{ fontSize: tf.base }}
					>
						Renders in its own window, so it covers the tab bar no matter how
						deep in the tree it was opened from. Tap the backdrop, press back,
						or use the button to close.
					</Text>
					<Button
						label="Close"
						fullWidth
						onPress={() => setSheetOpen(false)}
					/>
				</View>
			</BottomSheet>
		</View>
	);
}
