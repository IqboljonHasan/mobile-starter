import { type ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import "../../global.css";

/**
 * The small muted heading over a field or a group — "Summa", "Kategoriya",
 * "Ko'rinish". Inset by a few pixels so it lines up with the text inside the
 * rounded field below rather than with the field's edge.
 */
export function FieldLabel({
	children,
	required,
	right,
	className,
	nativeID,
}: {
	children: ReactNode;
	required?: boolean;
	/** Rendered at the far end of the label's row — e.g. a "Tozalash" link. */
	right?: ReactNode;
	className?: string;
	nativeID?: string;
}) {
	const { tf } = useFont();

	return (
		<View className={`flex-row items-center justify-between gap-3 mb-2 ml-1 ${className ?? ""}`}>
			<Text
				nativeID={nativeID}
				className="flex-1 font-bold text-muted-foreground"
				style={{ fontSize: tf.sm }}
				numberOfLines={1}
			>
				{children}
				{required && <Text className="text-danger"> *</Text>}
			</Text>
			{right}
		</View>
	);
}
