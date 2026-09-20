import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { withAlpha } from "@/lib/categoryColors";
import type { IconName } from "@/lib/types";
import "../../global.css";

/** A short, opinionated set — enough to tell categories apart at a glance
 *  without turning the picker into a search problem. */
export const CATEGORY_ICONS: IconName[] = [
	"pricetag-outline",
	"cart-outline",
	"restaurant-outline",
	"cafe-outline",
	"car-outline",
	"bus-outline",
	"home-outline",
	"bulb-outline",
	"wifi-outline",
	"phone-portrait-outline",
	"bag-handle-outline",
	"shirt-outline",
	"medkit-outline",
	"fitness-outline",
	"school-outline",
	"book-outline",
	"game-controller-outline",
	"musical-notes-outline",
	"airplane-outline",
	"gift-outline",
	"paw-outline",
	"construct-outline",
	"briefcase-outline",
	"wallet-outline",
	"card-outline",
	"cash-outline",
	"trending-up-outline",
	"people-outline",
	"heart-outline",
	"ellipsis-horizontal-circle-outline",
];

/** Spoken name of each icon — the glyph names above mean nothing read aloud. */
const ICON_LABELS: Partial<Record<IconName, string>> = {
	"pricetag-outline": "Yorliq",
	"cart-outline": "Savat",
	"restaurant-outline": "Restoran",
	"cafe-outline": "Kafe",
	"car-outline": "Avtomobil",
	"bus-outline": "Avtobus",
	"home-outline": "Uy",
	"bulb-outline": "Lampochka",
	"wifi-outline": "Wi-Fi",
	"phone-portrait-outline": "Telefon",
	"bag-handle-outline": "Sumka",
	"shirt-outline": "Kiyim",
	"medkit-outline": "Tibbiyot",
	"fitness-outline": "Fitnes",
	"school-outline": "Ta'lim",
	"book-outline": "Kitob",
	"game-controller-outline": "O'yin",
	"musical-notes-outline": "Musiqa",
	"airplane-outline": "Samolyot",
	"gift-outline": "Sovg'a",
	"paw-outline": "Uy hayvoni",
	"construct-outline": "Ta'mirlash",
	"briefcase-outline": "Portfel",
	"wallet-outline": "Hamyon",
	"card-outline": "Bank kartasi",
	"cash-outline": "Naqd pul",
	"trending-up-outline": "O'sish",
	"people-outline": "Odamlar",
	"heart-outline": "Yurak",
	"ellipsis-horizontal-circle-outline": "Boshqa",
};

export interface IconPickerProps {
	value: IconName;
	onChange: (icon: IconName) => void;
	label?: string;
	/** Hex the selected icon is tinted with — usually the category's own color. */
	tint: string;
}

export function IconPicker({ value, onChange, label, tint }: IconPickerProps) {
	const { tc } = useTheme();
	const { tf } = useFont();

	return (
		<View>
			{!!label && (
				<Text
					className="font-medium text-foreground mb-1.5"
					style={{ fontSize: tf.base }}
				>
					{label}
				</Text>
			)}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ gap: 8, paddingRight: 8 }}
				keyboardShouldPersistTaps="handled"
			>
				{CATEGORY_ICONS.map((icon) => {
					const selected = icon === value;
					return (
						<Pressable
							key={icon}
							accessibilityRole="button"
							accessibilityLabel={ICON_LABELS[icon] ?? icon}
							accessibilityState={{ selected }}
							onPress={() => onChange(icon)}
							className="w-12 h-12 rounded-full items-center justify-center active:opacity-70"
							style={{
								backgroundColor: selected ? withAlpha(tint, 0.18) : tc.muted,
								borderWidth: selected ? 1.5 : 0,
								borderColor: tint,
							}}
						>
							<Ionicons
								name={icon}
								size={22}
								color={selected ? tint : tc.mutedForeground}
							/>
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}
