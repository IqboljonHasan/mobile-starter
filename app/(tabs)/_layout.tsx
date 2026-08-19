import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import PagerView from "react-native-pager-view";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import {
	type TabKey,
	TabNavigationProvider,
} from "@/contexts/TabNavigationContext";
import {
	TabScrollShadowProvider,
	useActiveTabShadow,
	useSetActiveShadowKey,
} from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";
import ComponentsScreen from "./components";
import HomeScreen from "./index";
import SettingsScreen from "./settings";

const AnimatedView = Animated.createAnimatedComponent(View);

type TabRoute = {
	key: TabKey;
	title: string;
	icon: {
		active: keyof typeof Ionicons.glyphMap;
		inactive: keyof typeof Ionicons.glyphMap;
	};
	screen: () => React.ReactNode;
};

/**
 * Tabs are rendered through a `PagerView` rather than a tab navigator, so they
 * are swipeable and all three stay mounted (no re-mount cost or lost scroll
 * position when switching). Add a tab by dropping a screen file in this folder
 * and adding an entry here.
 */
const TABS: TabRoute[] = [
	{
		key: "home",
		title: "Home",
		icon: { active: "home", inactive: "home-outline" },
		screen: HomeScreen,
	},
	{
		key: "components",
		title: "Components",
		icon: { active: "cube", inactive: "cube-outline" },
		screen: ComponentsScreen,
	},
	{
		key: "settings",
		title: "Settings",
		icon: { active: "settings", inactive: "settings-outline" },
		screen: SettingsScreen,
	},
];

function TabItem({
	isFocused,
	label,
	iconName,
	onPress,
}: {
	isFocused: boolean;
	label: string;
	iconName: TabRoute["icon"];
	onPress: () => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const pillWidth = useSharedValue(isFocused ? 1 : 0);

	useEffect(() => {
		pillWidth.value = withTiming(isFocused ? 1 : 0, { duration: 250 });
	}, [isFocused, pillWidth]);

	const pillStyle = useAnimatedStyle(() => ({
		position: "absolute" as const,
		height: 32,
		borderRadius: 16,
		backgroundColor: tc.primaryHighlight,
		width: 16 + pillWidth.value * 48,
		opacity: pillWidth.value,
	}));

	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityState={{ selected: isFocused }}
			onPress={() => {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
				onPress();
			}}
			android_ripple={{
				color: tc.primaryHighlight,
				borderless: false,
				radius: 40,
			}}
			className="flex-1 items-center justify-center py-1 active:opacity-70"
		>
			<View className="h-8 items-center justify-center">
				<AnimatedView style={pillStyle} />
				<Ionicons
					name={isFocused ? iconName.active : iconName.inactive}
					size={20}
					color={isFocused ? tc.primary : tc.mutedForeground}
				/>
			</View>
			<Text
				className={`mt-1 ${
					isFocused
						? "text-primary font-bold"
						: "text-muted-foreground font-medium"
				}`}
				style={{ fontSize: tf.sm }}
				numberOfLines={1}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function BottomTabBar({
	currentIndex,
	onTabPress,
}: {
	currentIndex: number;
	onTabPress: (index: number) => void;
}) {
	const { overflow } = useActiveTabShadow();

	return (
		<View
			className="flex-row items-center justify-evenly bg-card py-1.5"
			// Only shadowed while content still runs underneath it — a flat bar
			// looks wrong floating over a list that has already ended.
			style={
				overflow
					? {
							shadowColor: "#000",
							shadowOffset: { width: 0, height: -2 },
							shadowOpacity: 0.08,
							shadowRadius: 6,
							elevation: 8,
						}
					: undefined
			}
		>
			{TABS.map((tab, index) => (
				<TabItem
					key={tab.key}
					isFocused={currentIndex === index}
					label={tab.title}
					iconName={tab.icon}
					onPress={() => onTabPress(index)}
				/>
			))}
		</View>
	);
}

export default function TabLayout() {
	return (
		<TabScrollShadowProvider>
			<TabLayoutInner />
		</TabScrollShadowProvider>
	);
}

function TabLayoutInner() {
	const pagerRef = useRef<PagerView>(null);
	const [currentPage, setCurrentPage] = useState(0);
	const setActiveShadowKey = useSetActiveShadowKey();

	// Keep the header/tab-bar shadow reading from whichever screen is visible.
	useEffect(() => {
		setActiveShadowKey(TABS[currentPage].key);
	}, [currentPage, setActiveShadowKey]);

	const onPageSelected = useCallback(
		(e: { nativeEvent: { position: number } }) => {
			setCurrentPage(e.nativeEvent.position);
		},
		[],
	);

	const onTabPress = useCallback((index: number) => {
		pagerRef.current?.setPage(index);
	}, []);

	const goToTab = useCallback((key: TabKey) => {
		const index = TABS.findIndex((t) => t.key === key);
		if (index >= 0) pagerRef.current?.setPage(index);
	}, []);

	return (
		<TabNavigationProvider onRequestTab={goToTab}>
			<View className="flex-1 bg-background">
				<PagerView
					ref={pagerRef}
					style={{ flex: 1 }}
					initialPage={0}
					onPageSelected={onPageSelected}
				>
					{TABS.map((tab) => (
						<View key={tab.key} style={{ flex: 1 }}>
							<tab.screen />
						</View>
					))}
				</PagerView>
				<BottomTabBar currentIndex={currentPage} onTabPress={onTabPress} />
			</View>
		</TabNavigationProvider>
	);
}
