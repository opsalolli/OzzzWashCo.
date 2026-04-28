import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

export default function Invoices() {
  const { api } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    try { const { data } = await api.get("/invoices"); setItems(data); } catch {} finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const markPaid = async (id: string) => {
    try { await api.post(`/invoices/${id}/mark-paid`); load(); } catch {}
  };

  const filtered = filter === "all" ? items : items.filter(i => i.status === filter);
  const filters = ["all", "pending", "overdue", "paid"];
  const statusColor = (s: string) => s === "paid" ? C.success : s === "overdue" ? C.error : C.warning;

  return (
    <SafeAreaView style={common.screenWhite} edges={["bottom"]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: S.md, gap: 8 }} style={{ flexGrow: 0 }}>
        {filters.map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: filter === f ? C.text : C.bg2 }}>
            <Text style={{ color: filter === f ? "#fff" : C.text, fontWeight: "600", textTransform: "capitalize" }}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} /> :
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: S.md, paddingBottom: 80 }}
          ListEmptyComponent={<View style={{ alignItems: "center", marginTop: 40 }}><Feather name="file-text" size={30} color={C.textMuted} /><Text style={common.bodySmall}>No invoices</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/invoice/${item.id}`)} style={[common.card, { marginBottom: S.sm }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={common.h4}>{item.invoice_number}</Text>
                  <Text style={common.bodySmall}>{item.customer_name}</Text>
                  {item.due_date && <Text style={[common.bodySmall, { color: C.textMuted }]}>Due {new Date(item.due_date).toLocaleDateString()}</Text>}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={common.h3}>${item.total.toFixed(2)}</Text>
                  <Text style={{ color: statusColor(item.status), fontWeight: "700", fontSize: 12, textTransform: "uppercase", marginTop: 2 }}>{item.status}</Text>
                </View>
              </View>
              <Text style={[common.bodySmall, { marginTop: 6, color: C.brand }]}>Tap to open & send →</Text>
            </TouchableOpacity>
          )}
        />
      }
    </SafeAreaView>
  );
}
