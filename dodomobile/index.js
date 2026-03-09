import { AppRegistry, Platform, StyleSheet } from "react-native";
import { name as appName } from "./app.json";

const poppins = {
	regular: "Poppins-Regular",
};

const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

const normalizeTypographyStyle = (style) => {
	if (!isObject(style)) {
		return style;
	}

	const next = { ...style };

	if (!next.fontFamily) {
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
