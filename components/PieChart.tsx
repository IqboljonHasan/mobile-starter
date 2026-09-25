import { Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { formatAmount, maskAmount } from "@/lib/money";
import { sliceColor, type StatSlice } from "@/lib/stats";

const SIZE = 168;
const STROKE = 24;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A donut of the same slices the breakdown card lists below it — angle for
 * the shape everyone recognizes at a glance, length still carried by that
 * list for the precision a bar gives that a wedge can't. Built from stacked
 * `<Circle>` strokes (the standard react-native-svg donut trick: each slice is
 * a dash of the circle's own circumference, offset to where the last one
 * ended) rather than actual pie geometry, which needs no arc-path math at all.
 */
export default function PieChart({
	slices,
	unit,
	hideTotal = false,
}: {
	/** Already folded to the rows worth drawing — see `foldSlices`. */
	slices: StatSlice[];
	unit: string;
	/** Masks the center total — for an income breakdown while income is hidden. */
	hideTotal?: boolean;
}) {
	const { isDark, tc } = useTheme();
	const { tf } = useFont();
	const total = slices.reduce((acc, s) => acc + s.amount, 0);

	let cumulative = 0;

	return (
		<View className="items-center">
			<View style={{ width: SIZE, height: SIZE }}>
				<Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
					{/* Rotated so the first slice starts at 12 o'clock, the way a pie
					    chart is conventionally read, instead of SVG's own 3-o'clock zero. */}
					<G rotation={-90} originX={SIZE / 2} originY={SIZE / 2}>
						{slices.length === 0 ? (
							<Circle
								cx={SIZE / 2}
								cy={SIZE / 2}
								r={RADIUS}
								stroke={tc.muted}
								strokeWidth={STROKE}
								fill="none"
							/>
						) : (
							slices.map((slice) => {
								const dash = Math.max(slice.share * CIRCUMFERENCE, 0);
								// A hairline gap between slices, so two adjacent colors of
								// similar lightness don't visually fuse into one wedge.
								const gapPx = slices.length > 1 ? 2 : 0;
								const offset = -cumulative * CIRCUMFERENCE;
								cumulative += slice.share;
								return (
									<Circle
										key={slice.key}
										cx={SIZE / 2}
										cy={SIZE / 2}
										r={RADIUS}
										stroke={sliceColor(slice.key, slice.color, isDark, tc.mutedForeground)}
										strokeWidth={STROKE}
										strokeDasharray={`${Math.max(dash - gapPx, 0)} ${CIRCUMFERENCE - dash + gapPx}`}
										strokeDashoffset={offset}
										fill="none"
									/>
								);
							})
						)}
					</G>
				</Svg>
				<View
					pointerEvents="none"
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Text
						className="text-muted-foreground"
						style={{ fontSize: tf.xs }}
					>
						Jami
					</Text>
					<Text
						className="font-bold text-foreground mt-0.5"
						style={{ fontSize: tf.lg }}
						numberOfLines={1}
						adjustsFontSizeToFit
					>
						{hideTotal ? maskAmount(unit) : formatAmount(total, unit)}
					</Text>
				</View>
			</View>
		</View>
	);
}
