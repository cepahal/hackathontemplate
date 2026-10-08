import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname, type Href } from "expo-router";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors, radius } from "../theme";
import { Body, Button, IconButton } from "./ui";

export type MobileNavigationItem = {
  id: string;
  href: Href;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};
const navigation = [
  { id: "overview", href: "/", label: "Overview", icon: "grid-outline" },
  {
    id: "layouts",
    href: "/layouts",
    label: "Layout shells",
    icon: "browsers-outline",
  },
  {
    id: "cards",
    href: "/cards",
    label: "Card containers",
    icon: "layers-outline",
  },
  {
    id: "states",
    href: "/states",
    label: "Feedback states",
    icon: "sync-outline",
  },
] as const satisfies readonly MobileNavigationItem[];
type SidebarOptions = {
  items?: readonly MobileNavigationItem[];
  brand?: string;
  footer?: ReactNode;
};
const NavigationContext = createContext<(() => void) | null>(null);

export function SidebarProvider({
  children,
  ...options
}: SidebarOptions & { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <NavigationContext.Provider value={() => setOpen(true)}>
      {children}
      <Sidebar open={open} onClose={() => setOpen(false)} {...options} />
    </NavigationContext.Provider>
  );
}

export function Sidebar({
  open,
  onClose,
  items = navigation,
  brand = "launchpad.",
  footer,
}: SidebarOptions & {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss navigation"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView accessibilityViewIsModal style={styles.drawer}>
          <View style={styles.drawerHeading}>
            <Text accessibilityRole="header" style={styles.brand}>
              {brand}
            </Text>
            <IconButton
              label="Close navigation"
              icon="close-outline"
              onPress={onClose}
            />
          </View>
          <ScrollView contentContainerStyle={styles.navigation}>
            {items.map(({ id, href, label, icon }) => {
              const selected =
                pathname === (typeof href === "string" ? href : href.pathname);
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onClose();
                    router.navigate(href);
                  }}
                  style={({ pressed }) => [
                    styles.navItem,
                    (selected || pressed) && styles.navItemActive,
                  ]}
                >
                  {icon && (
                    <Ionicons
                      name={icon}
                      size={20}
                      color={colors.primary}
                      accessible={false}
                    />
                  )}
                  <Text style={styles.navLabel}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.drawerFooter}>
            {footer === undefined ? (
              <>
                <Body>One idea. Every screen.</Body>
                <Body>Reusable layouts for your next useful thing.</Body>
              </>
            ) : (
              footer
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export function Navbar({
  title,
  brand = "launchpad.",
  actions,
}: {
  title: string;
  brand?: string;
  actions?: ReactNode;
}) {
  const open = useContext(NavigationContext);
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.navbar,
        {
          paddingTop: insets.top + 12,
          paddingLeft: Math.max(insets.left, 16),
          paddingRight: Math.max(insets.right, 16),
        },
      ]}
    >
      <View style={styles.navbarRow}>
        {open && (
          <IconButton
            label="Open navigation"
            icon="menu-outline"
            onPress={open}
          />
        )}
        <Text style={styles.brand}>{brand}</Text>
        {actions}
      </View>
      <Text style={styles.navbarTitle}>{title}</Text>
    </View>
  );
}

export function Footer({
  label = "Launchpad · Make room for your next idea.",
  actions,
}: {
  label?: string;
  actions?: ReactNode;
}) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>{label}</Text>
      {actions === undefined ? (
        <Button
          label="Back to overview"
          variant="ghost"
          onPress={() => router.navigate("/")}
        />
      ) : (
        actions
      )}
    </View>
  );
}

export function Screen({
  title,
  description,
  children,
  eyebrow = "BUILDING BLOCKS",
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  eyebrow?: string | null;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ flexGrow: 1 }}>
      <View
        style={[
          styles.screen,
          {
            paddingLeft: Math.max(20, insets.left),
            paddingRight: Math.max(20, insets.right),
          },
        ]}
      >
        <View style={styles.heading}>
          {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Body>{description}</Body>
        </View>
        {children}
        {footer === undefined ? <Footer /> : footer}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: "rgba(32,51,46,0.4)" },
  drawer: {
    width: "90%",
    maxWidth: 360,
    height: "100%",
    backgroundColor: colors.card,
  },
  drawerHeading: {
    padding: 16,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontSize: 22, fontWeight: "700", color: colors.primary },
  navigation: { padding: 16, gap: 8 },
  navItem: {
    minHeight: 48,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.small,
  },
  navItemActive: { backgroundColor: colors.secondary },
  navLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
    flexShrink: 1,
  },
  drawerFooter: { padding: 24, gap: 8 },
  navbar: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    gap: 10,
  },
  navbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  navbarTitle: { fontSize: 14, color: colors.muted, paddingHorizontal: 16 },
  scroll: { flex: 1, backgroundColor: colors.background },
  screen: {
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
    paddingVertical: 28,
    gap: 24,
  },
  heading: { gap: 12 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: colors.primary,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "600",
    color: colors.foreground,
  },
  footer: {
    marginTop: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
    alignItems: "flex-start",
  },
  footerText: { fontSize: 12, lineHeight: 20, color: colors.muted },
});
