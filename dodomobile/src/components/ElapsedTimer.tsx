import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, radii, fontSize as fontSizes } from "../theme/colors";
import { type ThemeColors, useThemeColors } from "../theme/ThemeProvider";
import { AppIcon } from "./AppIcon";

type ElapsedTimerProps = {
    startedAt: string; // ISO 8601 timestamp of when timer started
    trackedSeconds?: number; // Already accumulated seconds before this session
    size?: "compact" | "normal" | "large"; // Display size variant
};

function formatElapsed(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    if (h > 0) {
        return `${h}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
}

export function ElapsedTimer({ startedAt, trackedSeconds = 0, size = "normal" }: ElapsedTimerProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors, size), [colors, size]);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        function computeElapsed() {
            const startMs = new Date(startedAt).getTime();
            const nowMs = Date.now();
            const sessionSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
            setElapsed(trackedSeconds + sessionSeconds);
        }

        computeElapsed();
        const intervalId = setInterval(computeElapsed, 1000);
        return () => clearInterval(intervalId);
    }, [startedAt, trackedSeconds]);

    return (
        <View style={styles.container}>
            <View style={styles.pulsingDot} />
            <Text style={styles.time}>{formatElapsed(elapsed)}</Text>
        </View>
    );
}

const createStyles = (colors: ThemeColors, size: "compact" | "normal" | "large") => {
    const textSize =
        size === "large" ? 38 : size === "compact" ? fontSizes.md : fontSizes.xl;
    const dotSize = size === "large" ? 10 : size === "compact" ? 6 : 8;

    return StyleSheet.create({
        container: {
            flexDirection: "row",
            alignItems: "center",
            gap: size === "large" ? spacing.md : spacing.sm,
        },
        pulsingDot: {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: colors.success,
        },
        time: {
            color: colors.success,
            fontSize: textSize,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            letterSpacing: size === "large" ? 2 : 1,
        },
    });
};
