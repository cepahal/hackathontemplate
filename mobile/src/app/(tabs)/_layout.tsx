import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Navbar } from "../../components/layout";
import { colors } from "../../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        header: ({ options }) => (
          <Navbar title={options.title ?? "UI library"} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(8, insets.bottom),
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarAccessibilityLabel: "Overview",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="grid-outline"
              color={color}
              size={size}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="layouts"
        options={{
          title: "Layouts",
          tabBarAccessibilityLabel: "Layouts",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="browsers-outline"
              color={color}
              size={size}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: "Cards",
          tabBarAccessibilityLabel: "Cards",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="layers-outline"
              color={color}
              size={size}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="states"
        options={{
          title: "States",
          tabBarAccessibilityLabel: "States",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="sync-outline"
              color={color}
              size={size}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ),
        }}
      />
    </Tabs>
  );
}
