import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Text, View } from "react-native";
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
import { dropTarget, moveItem } from "@/lib/reorder";
import type { Category } from "@/lib/types";
import "../global.css";

/**
 * Drag-to-reorder for one side of the ledger.
 *
 * Rows are compact and equal height rather than the full category card: the
 * card carries tappable chips and two icon buttons, which fight a drag for the
 * same touch, and its height varies with how many subcategories it holds —
 * which would turn every drop into a walk over measured offsets. A fixed height
 * keeps the arithmetic in lib/reorder.ts, where it can be tested.
 *
 * Nothing is held in local state: the committed order comes back down as
 * `categories`, so there is no second copy to fall out of step.
 */

/** Only the handle starts a drag, so a stray swipe still scrolls the screen. */
export default function CategoryReorderList({
	categories,
	onReorder,
	onDragChange,
}: {
	categories: Category[];
	onReorder: (orderedIds: string[]) => void;
	/** Lets the screen freeze its ScrollView while a row is in hand. */
	onDragChange: (dragging: boolean) => void;
}) {
	const { tf } = useFont();

	// Constant per render, which is all the drop arithmetic needs — but it still
	// follows the text-size setting, so the name never outgrows its row.
	const rowHeight = 40 + tf.base + tf.sm;

	const activeIndex = useSharedValue(-1);
	const hoverIndex = useSharedValue(-1);
	const dragY = useSharedValue(0);

	const finish = useCallback(
		(from: number, to: number) => {
			if (from !== to) {
				onReorder(moveItem(categories, from, to).map((c) => c.id));
			}
			activeIndex.set(-1);
			hoverIndex.set(-1);
			dragY.set(0);
			onDragChange(false);
		},
		[categories, onReorder, onDragChange, activeIndex, hoverIndex, dragY],
	);

	const start = useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		onDragChange(true);
	}, [onDragChange]);

	return (
		// Rows are absolutely positioned, so a lifted row slides over its
		// neighbours instead of pushing the list around as it goes.
		<View style={{ height: categories.length * rowHeight }}>
			{categories.map((category, index) => (
				<ReorderRow
					key={category.id}
					category={category}
					index={index}
					count={categories.length}
					rowHeight={rowHeight}
					activeIndex={activeIndex}
					hoverIndex={hoverIndex}
					dragY={dragY}
					onStart={start}
					onDrop={finish}
				/>
			))}
		</View>
	);
}

function ReorderRow({
	category,
	index,
	count,
	rowHeight,
	activeIndex,
	hoverIndex,
	dragY,
	onStart,
	onDrop,
}: {
	category: Category;
	index: number;
	count: number;
	rowHeight: number;
	activeIndex: SharedValue<number>;
	hoverIndex: SharedValue<number>;
	dragY: SharedValue<number>;
	onStart: () => void;
	onDrop: (from: number, to: number) => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();

	// Set once the drop has been handed to JS, so the cancel path in
	// `onFinalize` doesn't also fire and undo it.
	const dropped = useSharedValue(false);

	const pan = Gesture.Pan()
		// The row sits inside the screen's ScrollView. Waiting for a long press
		// means a plain swipe still scrolls, and only a deliberate hold lifts.
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
			<View className="flex-1 flex-row items-center gap-3 rounded-2xl bg-card px-4">
				<CategoryAvatar icon={category.icon} color={category.color} size={32} />
				<View className="flex-1">
					<Text
						className="font-semibold text-foreground"
						style={{ fontSize: tf.base }}
						numberOfLines={1}
					>
						{category.name}
					</Text>
					<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
						{category.subcategories.length} ta ichki kategoriya
					</Text>
				</View>
				<GestureDetector gesture={pan}>
					{/* Padded out to a comfortable target — the handle is the only
					    part of the row that starts a drag. */}
					<View
						accessibilityRole="adjustable"
						accessibilityLabel={`${category.name} — tartibini o'zgartirish`}
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
