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
	const originalFlatten = StyleSheet.flatten.bind(StyleSheet);

	StyleSheet.flatten = (style) => normalizeTypographyStyle(originalFlatten(style));
}

const App = require("./App").default;

AppRegistry.registerComponent(appName, () => App);
