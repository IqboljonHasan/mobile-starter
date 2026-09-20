import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	runOnJS,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import CategoryAvatar from "@/components/CategoryAvatar";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { dropTarget, moveItem } from "@/lib/reorder";
import type { IconName } from "@/lib/types";
import "../global.css";

/**
 * Drag-to-reorder for a list of ledger items — categories, or the
 * subcategories of one category.
 *
 * Rows are compact and equal height rather than the thing being reordered in
 * its usual form. Category cards carry tappable chips and icon buttons that
 * fight a drag for the same touch, and subcategories are normally chips in a
 * wrapped row, where dragging would mean hit-testing a two-dimensional layout
 * of varying widths. One fixed-height column keeps the arithmetic in
 * lib/reorder.ts, where it is tested.
 *
 * Nothing is held in local state: the committed order comes back down as
 * `items`, so there is no second copy to fall out of step.
 */

export type ReorderItem = {
	id: string;
	title: string;
	subtitle?: string;
	/** Palette key from lib/categoryColors. */
	color: string;
	/** Drawn in a tinted circle. A plain dot stands in when there isn't one. */
	icon?: IconName;
	/** Shows a chevron and lets the row be tapped, for a level below this one. */
	disclosure?: boolean;
};

export default function ReorderList({
	items,
	onReorder,
	onDragChange,
	onPressItem,
}: {
	items: ReorderItem[];
	onReorder: (orderedIds: string[]) => void;
	/** Lets the screen freeze its ScrollView while a row is in hand. */
	onDragChange: (dragging: boolean) => void;
	/** Called when a row marked `disclosure` is tapped. */
	onPressItem?: (id: string) => void;
}) {
	const { tf } = useFont();

	// Constant per render, which is all the drop arithmetic needs — but it still
	// follows the text-size setting, so a name never outgrows its row.
	const rowHeight = 40 + tf.base + tf.sm;

	const activeIndex = useSharedValue(-1);
	const hoverIndex = useSharedValue(-1);
	const dragY = useSharedValue(0);

	const finish = useCallback(
		(from: number, to: number) => {
			if (from !== to) {
				onReorder(moveItem(items, from, to).map((i) => i.id));
			}
			activeIndex.set(-1);
			hoverIndex.set(-1);
			dragY.set(0);
			onDragChange(false);
		},
		[items, onReorder, onDragChange, activeIndex, hoverIndex, dragY],
	);

	const start = useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		onDragChange(true);
	}, [onDragChange]);

	return (
		// Rows are absolutely positioned, so a lifted row slides over its
		// neighbours instead of pushing the list around as it goes.
		<View style={{ height: items.length * rowHeight }}>
			{items.map((item, index) => (
				<Row
					key={item.id}
					item={item}
					index={index}
					count={items.length}
					rowHeight={rowHeight}
					activeIndex={activeIndex}
					hoverIndex={hoverIndex}
					dragY={dragY}
					onStart={start}
					onDrop={finish}
					onPress={onPressItem}
				/>
			))}
		</View>
	);
}

function Row({
	item,
	index,
	count,
	rowHeight,
	activeIndex,
	hoverIndex,
	dragY,
	onStart,
	onDrop,
	onPress,
}: {
	item: ReorderItem;
	index: number;
	count: number;
	rowHeight: number;
	activeIndex: SharedValue<number>;
	hoverIndex: SharedValue<number>;
	dragY: SharedValue<number>;
	onStart: () => void;
	onDrop: (from: number, to: number) => void;
	onPress?: (id: string) => void;
}) {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();

	// Set once the drop has been handed to JS, so the cancel path in
	// `onFinalize` doesn't also fire and undo it.
	const dropped = useSharedValue(false);

	const pan = Gesture.Pan()
		// The row sits inside a ScrollView. Waiting for a long press means a
		// plain swipe still scrolls, and only a deliberate hold lifts.
		.activateAfterLongPress(200)
		.onStart(() => {
			dropped.set(false);
			activeIndex.set(index);
			hoverIndex.set(index);
			dragY.set(0);
			runOnJS(onStart)();
		})
		.onUpdate((e) => {
			dragY.set(e.translationY);
			const next = dropTarget(index, e.translationY, rowHeight, count);
			if (next !== hoverIndex.get()) hoverIndex.set(next);
		})
		.onEnd(() => {
			dropped.set(true);
			runOnJS(onDrop)(index, hoverIndex.get());
		})
		.onFinalize(() => {
			// A gesture cancelled mid-drag never reaches onEnd; put the row back.
			if (!dropped.get() && activeIndex.get() === index) {
				activeIndex.set(-1);
				hoverIndex.set(-1);
				dragY.set(0);
				runOnJS(onDrop)(index, index);
			}
		});

	const animatedStyle = useAnimatedStyle(() => {
		const active = activeIndex.get();

		// Nothing in hand: every row rests in its own slot.
		if (active === -1) {
			return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0 };
		}
		// The row being dragged tracks the finger, above its neighbours.
		if (active === index) {
			return {
				transform: [{ translateY: dragY.get() }, { scale: 1.03 }],
				zIndex: 10,
			};
		}
		// Everything between where it came from and where it now points shuffles
		// one slot to open the gap.
		const hover = hoverIndex.get();
		let shift = 0;
		if (active < index && index <= hover) shift = -rowHeight;
		else if (hover <= index && index < active) shift = rowHeight;

		return {
			transform: [
				{ translateY: withTiming(shift, { duration: 160 }) },
				{ scale: 1 },
			],
			zIndex: 0,
		};
	});

	const tappable = !!item.disclosure && !!onPress;

	const body = (
		<>
			{item.icon ? (
				<CategoryAvatar icon={item.icon} color={item.color} size={32} />
			) : (
				<View className="w-8 items-center">
					<View
						style={{
							width: 12,
							height: 12,
							borderRadius: 6,
							backgroundColor: categoryColorValue(item.color, isDark),
						}}
					/>
				</View>
			)}
			<View className="flex-1">
				<Text
					className="font-semibold text-foreground"
					style={{ fontSize: tf.base }}
					numberOfLines={1}
				>
					{item.title}
				</Text>
				{!!item.subtitle && (
					<Text
						className="text-muted-foreground"
						style={{ fontSize: tf.sm }}
						numberOfLines={1}
					>
						{item.subtitle}
					</Text>
				)}
			</View>
			{tappable && (
				<Ionicons name="chevron-forward" size={16} color={tc.mutedForeground} />
			)}
		</>
	);

	return (
		<Animated.View
			style={[
				{
					position: "absolute",
					left: 0,
					right: 0,
					top: index * rowHeight,
					height: rowHeight,
					paddingBottom: 8,
				},
				animatedStyle,
			]}
		>
			<View className="flex-1 flex-row items-center rounded-2xl bg-card pl-4 pr-1">
				{tappable ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`${item.title} — ichki kategoriyalarni tartiblash`}
						onPress={() => onPress?.(item.id)}
						className="flex-1 flex-row items-center gap-3 active:opacity-60"
					>
						{body}
					</Pressable>
				) : (
					<View className="flex-1 flex-row items-center gap-3">{body}</View>
				)}
				<GestureDetector gesture={pan}>
					{/* Padded out to a comfortable target — the handle is the only
					    part of the row that starts a drag. */}
					<View
						accessibilityRole="adjustable"
						accessibilityLabel={`${item.title} — tartibini o'zgartirish`}
						className="h-11 w-11 items-center justify-center"
					>
						<Ionicons
							name="reorder-three-outline"
							size={24}
							color={tc.mutedForeground}
						/>
					</View>
				</GestureDetector>
			</View>
		</Animated.View>
	);
}
