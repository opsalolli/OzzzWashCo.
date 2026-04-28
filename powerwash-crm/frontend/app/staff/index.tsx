import { useCallback, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

export default function Staff() {
  const { api } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Cleaner");

  const load = async () => { try { const { data } = await api.get("/staff"); setItems(data); } catch {} finally { setLoading(false); } };
  useFocusEffect(useCallback(() => { load(); }, []));

  const add = async () => {
    if (!name) return Alert.alert("Name required");
    try { await api.post("/staff", { name, phone, role }); setName(""); setPhone(""); load(); }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
  };

  const del = (id: string) => Alert.alert("Remove staff?", "", [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: async () => { try { await api.delete(`/staff/${id}`); load(); } catch {} } },
  ]);

  return (
    <SafeAreaView style={common.screenWhite} edges={["bottom"]}>
      <View style={{ padding: S.md }}>
        <Text style={common.label}>Add Staff</Text>
        <TextInput testID="staff-name" style={[common.input, { marginBottom: 8 }]} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={C.textMuted} />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <TextInput testID="staff-phone" style={[common.input, { flex: 1 }]} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" placeholderTextColor={C.textMuted} />
          <TextInput style={[common.input, { flex: 1 }]} value={role} onChangeText={setRole} placeholder="Role" placeholderTextColor={C.textMuted} />
        </View>
        <TouchableOpacity testID="add-staff" style={common.btnPrimary} onPress={add}>
          <Text style={common.btnPrimaryText}>Add Staff Member</Text>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={C.brand} /> :
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: S.md }}
          ListEmptyComponent={<Text style={[common.bodySmall, { textAlign: "center" }]}>No staff added yet</Text>}
          renderItem={({ item }) => (
            <View style={[common.card, { marginBottom: S.sm, flexDirection: "row", alignItems: "center" }]}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>{item.name[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={common.h4}>{item.name}</Text>
                <Text style={common.bodySmall}>{item.role}{item.phone ? ` • ${item.phone}` : ""}</Text>
              </View>
              <TouchableOpacity onPress={() => del(item.id)} style={{ padding: 8 }}>
                <Feather name="trash-2" size={18} color={C.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      }
    </SafeAreaView>
  );
}
