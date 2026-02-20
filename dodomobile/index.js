import { AppRegistry, Platform, StyleSheet } from "react-native";
import { name as appName } from "./app.json";

const poppins = {
	regular: "Poppins-Regular",
	medium: "Poppins-Medium",
	semibold: "Poppins-SemiBold",
	bold: "Poppins-Bold",
};

const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

const pickPoppinsFamily = (fontWeight) => {
	const weight = typeof fontWeight === "number" ? String(fontWeight) : fontWeight;

	if (weight === "bold" || weight === "800" || weight === "900") {
		return poppins.bold;
	}

	if (weight === "600" || weight === "700") {
		return poppins.semibold;
	}

	if (weight === "500") {
		return poppins.medium;
	}

	return poppins.regular;
};

const normalizeTypographyStyle = (style) => {
	if (!isObject(style)) {
		return style;
	}

	const next = { ...style };
	const currentFamily = typeof next.fontFamily === "string" ? next.fontFamily : undefined;
	const isPoppinsFamily = typeof currentFamily === "string" && currentFamily.startsWith("Poppins");

	if (next.fontWeight != null) {
		if (!currentFamily || isPoppinsFamily) {
			next.fontFamily = pickPoppinsFamily(next.fontWeight);
		}

		// Android falls back to Roboto when custom font + weight mismatch.
		next.fontWeight = undefined;
		return next;
	}

	if (!currentFamily) {
		next.fontFamily = poppins.regular;
	}

	return next;
};

if (Platform.OS === "android") {
	const originalCreate = StyleSheet.create.bind(StyleSheet);
	const originalFlatten = StyleSheet.flatten.bind(StyleSheet);

	StyleSheet.create = (styles) => {
		if (!isObject(styles)) {
			return originalCreate(styles);
		}

		const patched = {};
		for (const [key, style] of Object.entries(styles)) {
			patched[key] = normalizeTypographyStyle(style);
		}

		return originalCreate(patched);
	};

	StyleSheet.flatten = (style) => normalizeTypographyStyle(originalFlatten(style));
}

const App = require("./App").default;

AppRegistry.registerComponent(appName, () => App);
