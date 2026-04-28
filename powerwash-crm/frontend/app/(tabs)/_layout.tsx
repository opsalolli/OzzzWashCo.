import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { C } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.textMuted,
        tabBarStyle: {
          borderTopColor: C.border,
          backgroundColor: "#FFFFFF",
          height: 80,
          paddingTop: 8,
          paddingBottom: 20,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: "Map", tabBarIcon: ({ color, size }) => <Feather name="map" size={size} color={color} /> }} />
      <Tabs.Screen name="customers" options={{ title: "Customers", tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule", tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> }} />
    </Tabs>
  );
}
