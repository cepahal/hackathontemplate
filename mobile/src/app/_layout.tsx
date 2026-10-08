import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SidebarProvider } from "../components/layout";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SidebarProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SidebarProvider>
    </SafeAreaProvider>
  );
}
