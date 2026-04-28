import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

export default function NewJob() {
  const { api } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ customer_id?: string }>();
  const [customers, setCustomers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>(params.customer_id || "");
  const [staffId, setStaffId] = useState<string>("");
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 16));
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    const [c, s] = await Promise.all([api.get("/customers"), api.get("/staff")]);
    setCustomers(c.data); setStaff(s.data);
  })(); }, []);

  const submit = async () => {
    if (!customerId) return Alert.alert("Pick a customer");
    setBusy(true);
    try {
      await api.post("/jobs", {
        customer_id: customerId,
        scheduled_at: new Date(dateStr).toISOString(),
        duration_min: parseInt(duration) || 60,
        assigned_staff_id: staffId || null,
        price: parseFloat(price) || 0,
        notes,
      });
      router.back();
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView style={common.screenWhite} contentContainerStyle={{ padding: S.md }} keyboardShouldPersistTaps="handled">
      <Text style={common.label}>Customer *</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: S.md }}>
        {customers.map(c => (
          <TouchableOpacity key={c.id} testID={`pick-cust-${c.id}`}
            onPress={() => setCustomerId(c.id)}
            style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: customerId === c.id ? C.brand : C.border, backgroundColor: customerId === c.id ? C.brandSubtle : "#fff" }}>
            <Text style={{ color: customerId === c.id ? C.brandActive : C.text, fontWeight: "600", fontSize: 13 }}>{c.name}</Text>
          </TouchableOpacity>
        ))}
        {customers.length === 0 && <Text style={common.bodySmall}>No customers. Add one first.</Text>}
      </View>

      <Text style={common.label}>Date & Time (YYYY-MM-DDTHH:mm)</Text>
      <TextInput testID="job-date" style={[common.input, { marginBottom: S.md }]} value={dateStr} onChangeText={setDateStr} />

      <Text style={common.label}>Duration (min)</Text>
      <TextInput testID="job-duration" style={[common.input, { marginBottom: S.md }]} value={duration} onChangeText={setDuration} keyboardType="number-pad" />

      <Text style={common.label}>Price ($)</Text>
      <TextInput testID="job-price" style={[common.input, { marginBottom: S.md }]} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="125.00" placeholderTextColor={C.textMuted} />

      <Text style={common.label}>Assign Staff (optional)</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: S.md }}>
        <TouchableOpacity onPress={() => setStaffId("")} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: staffId === "" ? C.brand : C.border }}>
          <Text style={{ fontWeight: "600" }}>Unassigned</Text>
        </TouchableOpacity>
        {staff.map(s => (
          <TouchableOpacity key={s.id} onPress={() => setStaffId(s.id)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: staffId === s.id ? C.brand : C.border, backgroundColor: staffId === s.id ? C.brandSubtle : "#fff" }}>
            <Text style={{ fontWeight: "600" }}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={common.label}>Notes</Text>
      <TextInput testID="job-notes" style={[common.input, { height: 80, textAlignVertical: "top", paddingTop: 12, marginBottom: S.md }]} multiline value={notes} onChangeText={setNotes} placeholder="Access info, special requests..." placeholderTextColor={C.textMuted} />

      <TouchableOpacity testID="save-job" style={common.btnPrimary} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={common.btnPrimaryText}>Schedule Job</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
