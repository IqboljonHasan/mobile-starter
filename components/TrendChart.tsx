import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { withAlpha } from "@/lib/categoryColors";
import { formatCompact } from "@/lib/money";
import { niceCeil } from "@/lib/stats";

export type ChartSeries = {
	key: string;
	/** Resolved hex, not a palette key. */
	color: string;
};

export type ChartColumn = {
	key: string;
	label: string;
	sublabel: string | null;
	accessibilityLabel: string;
	/** Amount per series key; a missing key is zero. */
	values: Record<string, number>;
};

/** Height of the bars' area — the axis runs from 0 at its foot to the top. */
const PLOT = 170;
/** Room above the top gridline, so a dot on it isn't clipped. */
const TOP = 6;
const LABELS = 28;
const AXIS_WIDTH = 40;

/**
 * Columns over time with a value axis on the left — the Tahlil screen's two
 * charts. Drawn as lines (one per series, over the columns' centres) or as
 * bars, either side by side (income beside expense) or stacked (a period's
 * categories on top of each other). Bars are plain `View`s; lines are one SVG
 * laid over them that lets every touch through to the columns below.
 *
 * Every column is a button, and the picked one is shaded. Columns share the
 * width the chart has, but never get narrower than `minColumnWidth`: a long
 * run scrolls sideways instead, opening on its latest columns, and keeps the
 * picked one in view.
 */
export default function TrendChart({
	columns,
	series,
	kind,
	stacked = false,
	lines,
	focus = null,
	selected = null,
	onSelect,
	minColumnWidth = 0,
	maskAxis = false,
	unit,
}: {
	columns: ChartColumn[];
	/** Bottom-up for a stack, left to right side by side. */
	series: ChartSeries[];
	kind: "line" | "bar";
	stacked?: boolean;
	/** The series drawn as lines; all of them when absent. Bars draw every one. */
	lines?: string[];
	/** Draws every other series faint. */
	focus?: string | null;
	selected?: number | null;
	onSelect?: (index: number) => void;
	minColumnWidth?: number;
	/** Leaves the axis unlabelled, for amounts that are hidden. */
	maskAxis?: boolean;
	unit: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const scroller = useRef<ScrollView>(null);
	const scrollX = useRef(0);
	const placed = useRef(false);
	const [width, setWidth] = useState(0);

	const plotWidth = Math.max(0, width - AXIS_WIDTH);
	const count = Math.max(columns.length, 1);
	const columnWidth = Math.max(minColumnWidth, plotWidth / count);
	const trackWidth = columnWidth * columns.length;
	const scrolls = trackWidth > plotWidth + 0.5;

	const drawn = kind === "line" ? series.filter((s) => !lines || lines.includes(s.key)) : series;
	const value = (column: ChartColumn, key: string) => column.values[key] ?? 0;
	const peak = Math.max(
		0,
		...columns.map((column) =>
			kind === "bar" && stacked
				? series.reduce((acc, s) => acc + value(column, s.key), 0)
				: Math.max(0, ...drawn.map((s) => value(column, s.key))),
		),
	);
	const top = niceCeil(peak * 1.04);
	const y = (amount: number) => TOP + (1 - amount / top) * PLOT;
	const x = (index: number) => (index + 0.5) * columnWidth;
	const faded = (key: string) => focus !== null && focus !== key;

	const barWidth = stacked
		? Math.max(6, Math.min(26, Math.round(columnWidth * 0.5)))
		: Math.max(4, Math.min(18, Math.floor((columnWidth - 14) / Math.max(series.length, 1))));

	// Bring the picked column into view — or, with none picked, the latest —
	// without moving a chart whose column is already showing.
	useEffect(() => {
		// Nothing to place until the chart has been measured.
		if (!scrolls || plotWidth <= 0) return;
		const max = trackWidth - plotWidth;
		let target: number | null;
		if (selected === null) {
			target = placed.current ? null : max;
		} else {
			const left = selected * columnWidth;
			const visible = left >= scrollX.current && left + columnWidth <= scrollX.current + plotWidth;
			target = visible && placed.current ? null : left + columnWidth / 2 - plotWidth / 2;
		}
		if (target !== null) {
			const clamped = Math.min(max, Math.max(0, target));
			scroller.current?.scrollTo({ x: clamped, animated: placed.current });
			scrollX.current = clamped;
		}
		placed.current = true;
	}, [scrolls, selected, columnWidth, trackWidth, plotWidth]);

	const axisLabel = (text: string, center: number) => (
		<Text
			className="font-semibold"
			style={{
				position: "absolute",
				left: 0,
				top: center - 7,
				fontSize: tf.xs - 1,
				lineHeight: 14,
				color: tc.placeholder,
			}}
			numberOfLines={1}
		>
			{text}
		</Text>
	);

	const lineAt = selected ?? columns.length - 1;

	return (
		<View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: "row" }}>
			<View style={{ width: AXIS_WIDTH, height: TOP + PLOT + LABELS }}>
				{!maskAxis && axisLabel(formatCompact(top, unit), TOP)}
				{!maskAxis && axisLabel(formatCompact(top / 2, unit), TOP + PLOT / 2)}
				{axisLabel("0", TOP + PLOT)}
			</View>

			<ScrollView
				ref={scroller}
				horizontal
				scrollEnabled={scrolls}
				showsHorizontalScrollIndicator={false}
				scrollEventThrottle={32}
				onScroll={(e) => {
					scrollX.current = e.nativeEvent.contentOffset.x;
				}}
				style={{ flex: 1 }}
			>
				<View style={{ width: trackWidth, height: TOP + PLOT + LABELS }}>
					{[TOP, TOP + PLOT / 2, TOP + PLOT].map((at, i) => (
						<View
							key={at}
							style={{
								position: "absolute",
								left: 0,
								right: 0,
								top: at,
								height: 1,
								backgroundColor: i === 2 ? tc.disabled : tc.border,
							}}
						/>
					))}

					<View style={{ position: "absolute", left: 0, top: TOP, bottom: 0, flexDirection: "row" }}>
						{columns.map((column, index) => {
							const active = index === selected;
							return (
								<Pressable
									key={column.key}
									accessibilityRole={onSelect ? "button" : undefined}
									accessibilityState={onSelect ? { selected: active } : undefined}
									accessibilityLabel={column.accessibilityLabel}
									disabled={!onSelect}
									onPress={() => {
										Haptics.selectionAsync();
										onSelect?.(index);
									}}
									style={{
										width: columnWidth,
										borderRadius: 10,
										alignItems: "center",
										backgroundColor: active ? withAlpha(tc.foreground, 0.06) : "transparent",
									}}
								>
									<View
										style={{
											height: PLOT,
											width: "100%",
											flexDirection: stacked ? "column-reverse" : "row",
											alignItems: stacked ? "center" : "flex-end",
											justifyContent: stacked ? "flex-start" : "center",
											gap: 2,
										}}
									>
										{kind === "bar" &&
											series.map((s, i) => {
												const amount = value(column, s.key);
												// A real, nonzero amount stays visible as a hairline next to
												// the peak — a bar that vanishes reads as "no data".
												const height = amount > 0 ? Math.max((amount / top) * PLOT, 2) : 0;
												if (height === 0) return null;
												const last = stacked
													? series.slice(i + 1).every((rest) => value(column, rest.key) <= 0)
													: true;
												return (
													<View
														key={s.key}
														style={{
															width: barWidth,
															height,
															borderTopLeftRadius: last ? 4 : 0,
															borderTopRightRadius: last ? 4 : 0,
															backgroundColor: s.color,
															opacity: faded(s.key) ? 0.28 : 1,
														}}
													/>
												);
											})}
									</View>
									<View style={{ height: LABELS, alignItems: "center", justifyContent: "center" }}>
										<Text
											style={{
												fontSize: tf.xs,
												lineHeight: 13,
												fontWeight: active ? "800" : "600",
												color: active ? tc.foreground : tc.placeholder,
											}}
											numberOfLines={1}
											adjustsFontSizeToFit
										>
											{column.label}
										</Text>
										{!!column.sublabel && (
											<Text
												className="font-bold text-muted-foreground"
												style={{ fontSize: tf.xs - 2, lineHeight: 12 }}
												numberOfLines={1}
											>
												{column.sublabel}
											</Text>
										)}
									</View>
								</Pressable>
							);
						})}
					</View>

					{kind === "line" && trackWidth > 0 && columns.length > 0 && (
						<View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}>
							<Svg width={trackWidth} height={TOP + PLOT}>
								{selected !== null && (
									<Line
										x1={x(selected)}
										x2={x(selected)}
										y1={TOP}
										y2={TOP + PLOT}
										stroke={tc.foreground}
										strokeOpacity={0.22}
										strokeWidth={1}
									/>
								)}
								{drawn.map((s) => (
									<Polyline
										key={s.key}
										points={columns.map((c, i) => `${x(i)},${y(value(c, s.key))}`).join(" ")}
										fill="none"
										stroke={s.color}
										strokeWidth={focus === s.key ? 3 : 2}
										strokeLinejoin="round"
										strokeLinecap="round"
										opacity={faded(s.key) ? 0.25 : 1}
									/>
								))}
								{drawn.map((s) => (
									<Circle
										key={s.key}
										cx={x(lineAt)}
										cy={y(value(columns[lineAt], s.key))}
										r={4}
										fill={s.color}
										stroke={tc.background}
										strokeWidth={2}
										opacity={faded(s.key) ? 0.25 : 1}
									/>
								))}
							</Svg>
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
}
