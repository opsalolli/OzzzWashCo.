import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

const SERVICE_INFO: Record<string, { label: string; icon: string; color: string }> = {
  windows: { label: "Windows", icon: "square", color: "#06B6D4" },
  powerwashing: { label: "Powerwash", icon: "droplet", color: "#3B82F6" },
  both: { label: "Both", icon: "layers", color: "#A855F7" },
};

const FILTERS = ["all", "windows", "powerwashing", "both"];

type Insight = {
  id: string; kind: string; icon: string; color: string;
  title: string; body: string; cta: string; route?: string; phone?: string;
};

export default function Customers() {
  const { api } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [svcFilter, setSvcFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const [c, i] = await Promise.all([api.get("/customers"), api.get("/insights")]);
      setItems(c.data);
      // Only show customer-related insights here
      const kinds = ["reach_out", "first_booking", "upsell"];
      setInsights((i.data?.insights || []).filter((x: Insight) => kinds.includes(x.kind)));
    } catch {} finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = items.filter(i => {
    const matchQ = !q || i.name?.toLowerCase().includes(q.toLowerCase()) || i.address?.toLowerCase().includes(q.toLowerCase());
    const matchSvc = svcFilter === "all" || (i.service_type || "both") === svcFilter;
    return matchQ && matchSvc;
  });

  const visibleInsights = insights.filter(i => !dismissed.has(i.id));

  const onAction = (ins: Insight) => {
    if (ins.phone && ins.kind === "reach_out") {
      Linking.openURL(`sms:${ins.phone}`).catch(() => {});
      return;
    }
    if (ins.route) router.push(ins.route as any);
  };

  const Footer = () => visibleInsights.length === 0 ? null : (
    <View style={{ marginTop: S.lg }}>
      <View style={styles.aiHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="zap" size={14} color={C.brand} />
          <Text style={[common.caption, { color: C.brand }]}>Next Best Action</Text>
        </View>
        <Text style={{ fontSize: 12, color: C.textMuted }}>{visibleInsights.length} suggestion{visibleInsights.length === 1 ? "" : "s"}</Text>
      </View>
      {visibleInsights.slice(0, 5).map((ins) => (
        <View key={ins.id} style={[common.card, styles.aiCard, { borderLeftColor: ins.color }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={[styles.aiIcon, { backgroundColor: ins.color + "22" }]}>
              <Feather name={ins.icon as any} size={16} color={ins.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={common.h4}>{ins.title}</Text>
              <Text style={[common.bodySmall, { marginTop: 2 }]}>{ins.body}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={() => onAction(ins)} style={[styles.aiCta, { backgroundColor: ins.color }]}>
                  <Text style={styles.aiCtaTxt}>{ins.cta}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDismissed(s => new Set([...s, ins.id]))} style={styles.aiDismiss}>
                  <Feather name="x" size={14} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={common.screenWhite} edges={["top"]}>
      <View style={styles.header}>
        <Text style={common.h1}>Customers</Text>
        <TouchableOpacity testID="new-customer" onPress={() => router.push("/customer/new")} style={styles.addBtn}>
          <Feather name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: S.md }}>
        <View style={styles.search}>
          <Feather name="search" size={16} color={C.textMuted} />
          <TextInput
            testID="cust-search"
            style={{ flex: 1, fontSize: 15, color: C.text }}
            placeholder="Search by name or address"
            placeholderTextColor={C.textMuted}
            value={q}
            onChangeText={setQ}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.md, gap: 8 }} style={{ flexGrow: 0, marginVertical: 8 }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} testID={`svc-filter-${f}`} onPress={() => setSvcFilter(f)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: svcFilter === f ? C.brand : C.bg2, borderWidth: 1, borderColor: svcFilter === f ? C.brand : C.borderStrong, flexDirection: "row", alignItems: "center", gap: 6 }}>
            {f !== "all" && <Feather name={SERVICE_INFO[f].icon as any} size={13} color={svcFilter === f ? "#fff" : SERVICE_INFO[f].color} />}
            <Text style={{ color: svcFilter === f ? "#fff" : C.text, fontWeight: "600", textTransform: "capitalize", fontSize: 13 }}>
              {f === "all" ? "All" : SERVICE_INFO[f].label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.brand} />
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 120 }}>
          <View style={styles.empty}>
            <Feather name="users" size={36} color={C.textMuted} />
            <Text style={[common.h4, { marginTop: 12 }]}>No customers yet</Text>
            <Text style={common.bodySmall}>Add one or go knock some doors!</Text>
          </View>
          <Footer />
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: S.md, paddingBottom: 120 }}
          ListFooterComponent={<Footer />}
          renderItem={({ item }) => {
            const svc = SERVICE_INFO[item.service_type || "both"];
            return (
              <TouchableOpacity
                testID={`cust-${item.id}`}
                style={styles.row}
                onPress={() => router.push(`/customer/${item.id}`)}
              >
                <View style={[styles.avatar, { backgroundColor: svc.color }]}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>{item.name?.[0]?.toUpperCase() || "?"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={common.h4}>{item.name}</Text>
                  <Text style={common.bodySmall} numberOfLines={1}>{item.address}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: svc.color + "22" }}>
                      <Feather name={svc.icon as any} size={10} color={svc.color} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: svc.color, textTransform: "uppercase" }}>{svc.label}</Text>
                    </View>
                    {item.phone ? <Text style={[common.bodySmall, { color: C.textMuted, fontSize: 12 }]}>{item.phone}</Text> : null}
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={C.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: S.md },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bg2, paddingHorizontal: 14, height: 44, borderRadius: 12 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: S.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  aiHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  aiCard: { marginBottom: 8, borderLeftWidth: 4 },
  aiIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  aiCta: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  aiCtaTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  aiDismiss: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.bg3 },
});
