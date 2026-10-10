import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/layout";
import {
  Badge,
  Body,
  Button,
  Card,
  CardGrid,
  CardTitle,
} from "../../components/ui";
import { colors, radius } from "../../theme";

export default function OverviewScreen() {
  return (
    <Screen
      title="A head start for your next idea."
      description="A small, thoughtful UI kit. Familiar patterns, comfortable spacing, and room to make it yours."
    >
      <View style={styles.hero}>
        <Badge>Web + iOS</Badge>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          Less scaffolding.{"\n"}More of your idea.
        </Text>
        <Body>
          Navigation, cards, and the states between them. Start with a complete
          shell, then add the part only you can build.
        </Body>
        <Button
          label="Explore the layouts"
          icon="arrow-forward-outline"
          onPress={() => router.navigate("/layouts")}
        />
      </View>
      <CardGrid>
        {(
          [
            {
              href: "/layouts",
              icon: "browsers-outline",
              title: "A place for everything",
              text: "A navbar, navigation drawer, bottom tabs, and footer that work together.",
              action: "Try the shells",
            },
            {
              href: "/cards",
              icon: "layers-outline",
              title: "Content with structure",
              text: "Cards that stack on your phone and form a grid on wider screens.",
              action: "Explore cards",
            },
            {
              href: "/states",
              icon: "sync-outline",
              title: "Every step considered",
              text: "Loading, empty, error, and ready states with clear next actions.",
              action: "Try the states",
            },
          ] as const
        ).map(({ href, icon, title, text, action }) => (
          <Card key={href}>
            <Ionicons
              name={icon}
              size={26}
              color={colors.primary}
              accessible={false}
            />
            <CardTitle>{title}</CardTitle>
            <Body>{text}</Body>
            <Button
              label={action}
              variant="ghost"
              onPress={() => router.navigate(href)}
            />
          </Card>
        ))}
      </CardGrid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.panel,
    backgroundColor: colors.secondary,
    gap: 20,
  },
  heroTitle: {
    color: colors.foreground,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "600",
  },
});
