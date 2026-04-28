import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

const CATS = ["equipment", "supplies", "vehicle", "fuel", "other"];

export default function NewExpense() {
  const { api } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("equipment");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    api.get("/expenses").then(r => {
      const e = (r.data || []).find((x: any) => x.id === params.id);
      if (e) {
        setTitle(e.title || ""); setAmount(String(e.amount ?? ""));
        setVendor(e.vendor || ""); setNotes(e.notes || "");
        setCategory(e.category || "equipment");
      }
    }).finally(() => setLoading(false));
  }, [params.id]);

  const save = async () => {
    if (!title || !amount || isNaN(parseFloat(amount))) return Alert.alert("Missing", "Title and amount required");
    setBusy(true);
    try {
      const body = { title, amount: parseFloat(amount), vendor, notes, category };
      if (isEdit) await api.put(`/expenses/${params.id}`, body);
      else await api.post("/expenses", body);
      router.back();
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const remove = () => {
    if (!isEdit) return;
    Alert.alert("Delete expense?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.delete(`/expenses/${params.id}`); router.back(); }
        catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
      }},
    ]);
  };

  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}><ActivityIndicator color={C.brand} /></View>;

  return (
    <ScrollView style={common.screen} contentContainerStyle={{ padding: S.md }} keyboardShouldPersistTaps="handled">
      <Text style={common.label}>Title *</Text>
      <TextInput testID="exp-title" style={[common.input, { marginBottom: S.md }]} value={title} onChangeText={setTitle}
        placeholder="e.g. Pressure washer 4000 PSI" placeholderTextColor={C.textMuted} />

      <Text style={common.label}>Amount ($) *</Text>
      <TextInput testID="exp-amount" style={[common.input, { marginBottom: S.md }]} value={amount} onChangeText={setAmount}
        placeholder="599.99" keyboardType="decimal-pad" placeholderTextColor={C.textMuted} />

      <Text style={common.label}>Category</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: S.md }}>
        {CATS.map(c => (
          <TouchableOpacity key={c} testID={`cat-${c}`} onPress={() => setCategory(c)}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: category === c ? C.brand : C.bg2, borderWidth: 1, borderColor: category === c ? C.brand : C.borderStrong }}>
            <Text style={{ color: category === c ? "#fff" : C.text, fontWeight: "600", textTransform: "capitalize" }}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={common.label}>Vendor / Store</Text>
      <TextInput testID="exp-vendor" style={[common.input, { marginBottom: S.md }]} value={vendor} onChangeText={setVendor}
        placeholder="Home Depot, Amazon..." placeholderTextColor={C.textMuted} />

      <Text style={common.label}>Notes</Text>
      <TextInput testID="exp-notes" style={[common.input, { height: 80, textAlignVertical: "top", paddingTop: 12, marginBottom: S.md }]}
        multiline value={notes} onChangeText={setNotes} placeholder="Receipt #, warranty..." placeholderTextColor={C.textMuted} />

      <TouchableOpacity testID="save-expense" style={common.btnPrimary} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={common.btnPrimaryText}>{isEdit ? "Save Changes" : "Save Expense"}</Text>}
      </TouchableOpacity>

      {isEdit && (
        <TouchableOpacity testID="delete-expense" style={[common.btnSecondary, { marginTop: 10, backgroundColor: C.error + "20" }]} onPress={remove}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="trash-2" size={16} color={C.error} />
            <Text style={[common.btnSecondaryText, { color: C.error }]}>Delete Expense</Text>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
