import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/layout";
import {
  Body,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorNotice,
  Loading,
  LoadingSpinner,
} from "../../components/ui";
import { colors, radius } from "../../theme";

const states = ["loading", "empty", "error", "ready"] as const;
type PreviewState = (typeof states)[number];

export default function StatesScreen() {
  const [state, setState] = useState<PreviewState>("empty");
  return (
    <Screen
      title="Feedback states"
      description="Switch between examples. Retry and create change this local preview to its ready state."
    >
      <Card>
        <CardTitle>Make every state clear</CardTitle>
        <View style={styles.tabs}>
          {states.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={value}
              accessibilityState={{ selected: value === state }}
              onPress={() => setState(value)}
              style={[styles.tab, state === value && styles.activeTab]}
            >
              <Text style={styles.tabText}>{value}</Text>
            </Pressable>
          ))}
        </View>
        {state === "loading" && <Loading label="Loading preview…" />}
        {state === "empty" && (
          <EmptyState
            title="A fresh start"
            action={
              <Button
                label="Preview create"
                onPress={() => setState("ready")}
              />
            }
          >
            No items to show. Give people a clear next action.
          </EmptyState>
        )}
        {state === "error" && (
          <ErrorNotice
            message="This is a sample error. Your work is still here; try again when you’re ready."
            retry={() => setState("ready")}
          />
        )}
        {state === "ready" && (
          <View accessibilityLiveRegion="polite" style={styles.ready}>
            <Body>The ready-state preview is showing.</Body>
          </View>
        )}
        <View style={styles.inline}>
          <LoadingSpinner label="Inline loading example" />
          <Body>A spinner also fits beside an inline status.</Body>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: colors.secondary,
    padding: 4,
    borderRadius: radius.small,
    gap: 4,
  },
  tab: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: radius.small,
  },
  activeTab: { backgroundColor: colors.card },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "capitalize",
  },
  ready: {
    backgroundColor: colors.secondary,
    borderRadius: radius.card,
    padding: 24,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 20,
    flexWrap: "wrap",
  },
});
