import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

type Item = { description: string; amount: string };

export default function NewQuote() {
  const { api } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ customer_id?: string; meas_label?: string; meas_sqft?: string; meas_surface?: string; calc_items?: string }>();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>(params.customer_id || "");
  const [items, setItems] = useState<Item[]>(() => {
    if (params.calc_items) {
      try {
        const parsed = JSON.parse(String(params.calc_items));
        return parsed.map((p: any) => ({ description: p.description, amount: String(p.amount) }));
      } catch {}
    }
    if (params.meas_sqft && params.meas_surface) {
      const surf = String(params.meas_surface);
      const sqft = String(params.meas_sqft);
      const lbl = params.meas_label ? ` — ${params.meas_label}` : "";
      const cap = surf.charAt(0).toUpperCase() + surf.slice(1);
      return [{ description: `${cap} powerwash${lbl} (${sqft} sqft)`, amount: "" }];
    }
    return [{ description: "Window cleaning service", amount: "" }];
  });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/customers").then(r => setCustomers(r.data)); }, []);
  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const submit = async () => {
    if (!customerId) return Alert.alert("Pick a customer");
    const cleanItems = items.filter(i => i.description && parseFloat(i.amount) > 0).map(i => ({ description: i.description, amount: parseFloat(i.amount) }));
    if (!cleanItems.length) return Alert.alert("Add at least one line item");
    setBusy(true);
    try { await api.post("/quotes", { customer_id: customerId, items: cleanItems, notes }); router.back(); }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView style={common.screenWhite} contentContainerStyle={{ padding: S.md }} keyboardShouldPersistTaps="handled">
      <Text style={common.label}>Customer *</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: S.md }}>
        {customers.map(c => (
          <TouchableOpacity key={c.id} onPress={() => setCustomerId(c.id)}
            style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: customerId === c.id ? C.brand : C.border, backgroundColor: customerId === c.id ? C.brandSubtle : "#fff" }}>
            <Text style={{ fontWeight: "600", fontSize: 13 }}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={common.label}>Line items</Text>
      {items.map((it, idx) => (
        <View key={idx} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <TextInput style={[common.input, { flex: 2 }]} placeholder="Description" placeholderTextColor={C.textMuted}
            value={it.description} onChangeText={v => setItems(arr => arr.map((x, i) => i === idx ? { ...x, description: v } : x))} />
          <TextInput style={[common.input, { flex: 1 }]} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={C.textMuted}
            value={it.amount} onChangeText={v => setItems(arr => arr.map((x, i) => i === idx ? { ...x, amount: v } : x))} />
        </View>
      ))}
      <TouchableOpacity onPress={() => setItems(i => [...i, { description: "", amount: "" }])} style={{ marginBottom: S.md }}>
        <Text style={{ color: C.brand, fontWeight: "700" }}>+ Add line item</Text>
      </TouchableOpacity>

      <Text style={common.label}>Notes</Text>
      <TextInput style={[common.input, { height: 80, textAlignVertical: "top", paddingTop: 12, marginBottom: S.md }]} multiline value={notes} onChangeText={setNotes} placeholder="Scope, timing, etc." placeholderTextColor={C.textMuted} />

      <View style={[common.card, { marginBottom: S.md, flexDirection: "row", justifyContent: "space-between" }]}>
        <Text style={common.h4}>Total</Text>
        <Text style={common.h3}>${total.toFixed(2)}</Text>
      </View>

      <TouchableOpacity testID="save-quote" style={common.btnPrimary} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={common.btnPrimaryText}>Create Quote</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
