import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { C, S, common } from "../src/theme";

export default function Settings() {
  const { user, signOut } = useAuth();
  return (
    <SafeAreaView style={common.screenWhite} edges={["bottom"]}>
      <View style={{ padding: S.md }}>
        <View style={[common.card, { alignItems: "center", paddingVertical: S.xl }]}>
          <View style={styles.avatar}><Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>{user?.full_name?.[0]?.toUpperCase() || "?"}</Text></View>
          <Text style={[common.h3, { marginTop: 12 }]}>{user?.full_name}</Text>
          <Text style={common.bodySmall}>{user?.email}</Text>
          {user?.business_name ? <Text style={[common.bodySmall, { marginTop: 4 }]}>{user.business_name}</Text> : null}
        </View>

        <View style={[common.card, { marginTop: S.md }]}>
          <Text style={common.caption}>About</Text>
          <Text style={[common.body, { marginTop: 6 }]}>ClearView CRM</Text>
          <Text style={common.bodySmall}>A modern CRM for window cleaning pros — scheduling, invoicing, canvassing & more.</Text>
        </View>

        <TouchableOpacity testID="settings-signout" style={[common.btnSecondary, { marginTop: S.md, backgroundColor: C.error + "15" }]} onPress={signOut}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="log-out" size={18} color={C.error} />
            <Text style={[common.btnSecondaryText, { color: C.error }]}>Sign out</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
});
