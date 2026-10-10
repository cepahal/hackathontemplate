import Ionicons from "@expo/vector-icons/Ionicons";
import { Children, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius } from "../theme";
import { useReducedMotion } from "../hooks/use-reduced-motion";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const blocked = disabled || loading;
  const color =
    variant === "primary" ? colors.primaryForeground : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary"
          ? styles.primaryButton
          : variant === "outline"
            ? styles.outlineButton
            : styles.ghostButton,
        { opacity: blocked ? 0.5 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading && (
        <LoadingSpinner label={`${label} in progress`} color={color} />
      )}
      {icon && !loading && (
        <Ionicons name={icon} size={18} color={color} accessible={false} />
      )}
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}
export function IconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && { backgroundColor: colors.secondary },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={colors.primary}
        accessible={false}
      />
    </Pressable>
  );
}
export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.cardTitle}>
      {children}
    </Text>
  );
}
export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}
export function Badge({ children }: { children: ReactNode }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}
export function CardGrid({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(0);
  const columns = width >= 900 ? 3 : width >= 560 ? 2 : 1;
  const cardWidth = width ? (width - 16 * (columns - 1)) / columns : "100%";
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.grid}
    >
      {Children.map(children, (child) => (
        <View style={{ width: cardWidth }}>{child}</View>
      ))}
    </View>
  );
}
export function LoadingSpinner({
  label = "Loading…",
  color = colors.primary,
}: {
  label?: string;
  color?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <ActivityIndicator
      animating={!reduced}
      hidesWhenStopped={false}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      color={color}
    />
  );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <LoadingSpinner label={label} />
      <Text style={styles.body}>{label}</Text>
    </View>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons
        name="file-tray-outline"
        size={30}
        color={colors.primary}
        accessible={false}
      />
      <CardTitle>{title}</CardTitle>
      <Body>{children}</Body>
      {action}
    </View>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
      {retry && <Button label="Try again" variant="outline" onPress={retry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radius.small,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.small,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButton: { backgroundColor: colors.primary },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  ghostButton: { backgroundColor: "transparent" },
  buttonText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 24,
    gap: 16,
    flexGrow: 1,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "600",
    color: colors.foreground,
  },
  body: { fontSize: 14, lineHeight: 24, color: colors.muted },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.small,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  loading: {
    minHeight: 130,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  empty: {
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 24,
    gap: 16,
  },
  error: {
    backgroundColor: colors.errorBackground,
    padding: 20,
    borderRadius: radius.card,
    gap: 16,
  },
  errorText: { color: colors.errorForeground, fontSize: 14, lineHeight: 24 },
});
