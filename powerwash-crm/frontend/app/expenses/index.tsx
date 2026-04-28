import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

const CATS = ["all", "equipment", "supplies", "vehicle", "fuel", "other"];
const CAT_COLOR: Record<string, string> = {
  equipment: "#3B82F6", supplies: "#22C55E", vehicle: "#A855F7",
  fuel: "#F59E0B", other: "#6B7280",
};

export default function Expenses() {
  const { api } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    try { const { data } = await api.get("/expenses"); setItems(data); } catch {} finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const del = (id: string) => Alert.alert("Delete expense?", "", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { await api.delete(`/expenses/${id}`); load(); } },
  ]);

  const filtered = filter === "all" ? items : items.filter(i => i.category === filter);
  const total = filtered.reduce((s, i) => s + (i.amount || 0), 0);
  const monthTotal = items.filter(i => new Date(i.expense_date).getMonth() === new Date().getMonth()).reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <SafeAreaView style={common.screen} edges={["bottom"]}>
      <View style={{ padding: S.md }}>
        <View style={[common.card, { flexDirection: "row", justifyContent: "space-between" }]}>
          <View>
            <Text style={common.caption}>This Month</Text>
            <Text style={[common.h2, { color: C.error }]}>${monthTotal.toFixed(2)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={common.caption}>Filtered</Text>
            <Text style={common.h3}>${total.toFixed(2)}</Text>
          </View>
        </View>
        <TouchableOpacity testID="new-expense" style={[common.btnPrimary, { marginTop: S.md }]} onPress={() => router.push("/expenses/new")}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={common.btnPrimaryText}>Add Expense</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.md, gap: 8 }} style={{ flexGrow: 0, marginBottom: 8 }}>
        {CATS.map(c => (
          <TouchableOpacity key={c} onPress={() => setFilter(c)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: filter === c ? C.brand : C.bg2, borderWidth: 1, borderColor: filter === c ? C.brand : C.borderStrong }}>
            <Text style={{ color: filter === c ? "#fff" : C.text, fontWeight: "600", textTransform: "capitalize" }}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} /> :
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: S.md, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Feather name="dollar-sign" size={30} color={C.textMuted} />
              <Text style={[common.bodySmall, { marginTop: 8 }]}>No expenses yet</Text>
            </View>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push({ pathname: "/expenses/new", params: { id: item.id } })} onLongPress={() => del(item.id)} style={[common.card, { marginBottom: S.sm, flexDirection: "row", alignItems: "center" }]}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: (CAT_COLOR[item.category] || C.brand) + "33", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Feather name="shopping-bag" size={18} color={CAT_COLOR[item.category] || C.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={common.h4}>{item.title}</Text>
                <Text style={common.bodySmall}>
                  {item.category.toUpperCase()}{item.vendor ? ` • ${item.vendor}` : ""} • {new Date(item.expense_date).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[common.h3, { color: C.error, marginRight: 6 }]}>${item.amount.toFixed(2)}</Text>
              <Feather name="chevron-right" size={18} color={C.textMuted} />
            </TouchableOpacity>
          )}
        />
      }
    </SafeAreaView>
  );
}
