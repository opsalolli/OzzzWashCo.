import { Stack } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../src/auth";

const HEADER = {
  headerStyle: { backgroundColor: "#FFFFFF" },
  headerTitleStyle: { color: "#0F172A", fontWeight: "700" as const },
  headerTintColor: "#2563EB",
  headerBackTitle: "Back",
  headerBackButtonDisplayMode: "minimal" as const,
  headerShadowVisible: false,
};

function Boot({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Boot>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, ...HEADER }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="customer/[id]" options={{ headerShown: true, title: "Customer", ...HEADER }} />
            <Stack.Screen name="customer/new" options={{ presentation: "modal", headerShown: true, title: "New Customer", ...HEADER }} />
            <Stack.Screen name="job/new" options={{ presentation: "modal", headerShown: true, title: "New Job", ...HEADER }} />
            <Stack.Screen name="invoice/new" options={{ presentation: "modal", headerShown: true, title: "New Invoice", ...HEADER }} />
            <Stack.Screen name="invoice/[id]" options={{ headerShown: true, title: "Invoice", ...HEADER }} />
            <Stack.Screen name="quote/new" options={{ presentation: "modal", headerShown: true, title: "New Quote", ...HEADER }} />
            <Stack.Screen name="staff/index" options={{ headerShown: true, title: "Staff", ...HEADER }} />
            <Stack.Screen name="invoices/index" options={{ headerShown: true, title: "Invoices", ...HEADER }} />
            <Stack.Screen name="quotes/index" options={{ headerShown: true, title: "Quotes", ...HEADER }} />
            <Stack.Screen name="expenses/index" options={{ headerShown: true, title: "Expenses", ...HEADER }} />
            <Stack.Screen name="expenses/new" options={{ presentation: "modal", headerShown: true, title: "New Expense", ...HEADER }} />
            <Stack.Screen name="calculator" options={{ headerShown: true, title: "Window Calculator", ...HEADER }} />
            <Stack.Screen name="settings" options={{ headerShown: true, title: "Settings", ...HEADER }} />
            <Stack.Screen name="payment-success" options={{ headerShown: true, title: "Payment", ...HEADER }} />
          </Stack>
        </Boot>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0F14" },
});
