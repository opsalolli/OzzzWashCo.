import { useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

const SERVICES = [
  { key: "windows", label: "Windows", icon: "square" },
  { key: "powerwashing", label: "Powerwashing", icon: "droplet" },
  { key: "both", label: "Both", icon: "layers" },
] as const;

export default function NewCustomer() {
  const { api } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Dallas");
  const [state, setState] = useState("TX");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceType, setServiceType] = useState<string>("both");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name || !address) return Alert.alert("Missing", "Name and address required");
    setBusy(true);
    try { await api.post("/customers", { name, address, city, state, zip, phone, email, notes, service_type: serviceType }); router.back(); }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView style={common.screenWhite} contentContainerStyle={{ padding: S.md }} keyboardShouldPersistTaps="handled">
      <Text style={common.label}>Service Type *</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: S.md }}>
        {SERVICES.map(s => (
          <TouchableOpacity key={s.key} testID={`svc-${s.key}`} onPress={() => setServiceType(s.key)}
            style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: serviceType === s.key ? C.brand : C.bg2, borderWidth: 1, borderColor: serviceType === s.key ? C.brand : C.borderStrong }}>
            <Feather name={s.icon as any} size={20} color={serviceType === s.key ? "#fff" : C.brand} />
            <Text style={{ color: serviceType === s.key ? "#fff" : C.text, fontWeight: "700", fontSize: 12, marginTop: 4 }}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={common.label}>Name *</Text>
      <TextInput testID="field-name" style={[common.input, { marginBottom: S.md }]}
        value={name} onChangeText={setName} placeholder="Sarah Lopez" placeholderTextColor={C.textMuted} />

      <Text style={common.label}>Address *</Text>
      <TextInput testID="field-address" style={[common.input, { marginBottom: S.md }]}
        value={address} onChangeText={setAddress} placeholder="1234 Elm St" placeholderTextColor={C.textMuted} />

      <View style={{ flexDirection: "row", gap: S.sm }}>
        <View style={{ flex: 2 }}>
          <Text style={common.label}>City</Text>
          <TextInput style={[common.input, { marginBottom: S.md }]} value={city} onChangeText={setCity} placeholderTextColor={C.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={common.label}>State</Text>
          <TextInput style={[common.input, { marginBottom: S.md }]} value={state} onChangeText={setState} placeholderTextColor={C.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={common.label}>Zip</Text>
          <TextInput style={[common.input, { marginBottom: S.md }]} value={zip} onChangeText={setZip} keyboardType="number-pad" placeholderTextColor={C.textMuted} />
        </View>
      </View>

      <Text style={common.label}>Phone</Text>
      <TextInput testID="field-phone" style={[common.input, { marginBottom: S.md }]}
        value={phone} onChangeText={setPhone} placeholder="(214) 555-0100" keyboardType="phone-pad" placeholderTextColor={C.textMuted} />

      <Text style={common.label}>Email</Text>
      <TextInput testID="field-email" style={[common.input, { marginBottom: S.md }]}
        value={email} onChangeText={setEmail} placeholder="sarah@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.textMuted} />

      <Text style={common.label}>Notes</Text>
      <TextInput testID="field-notes" style={[common.input, { height: 88, textAlignVertical: "top", paddingTop: 12, marginBottom: S.md }]}
        multiline value={notes} onChangeText={setNotes} placeholder="Gate code, pets, etc." placeholderTextColor={C.textMuted} />

      <TouchableOpacity testID="save-customer" style={common.btnPrimary} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={common.btnPrimaryText}>Save Customer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
