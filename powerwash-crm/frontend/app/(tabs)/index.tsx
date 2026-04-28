import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

type Insight = {
  id: string; kind: string; icon: string; color: string;
  title: string; body: string; cta: string; route?: string; phone?: string;
};

export default function Dashboard() {
  const { api, user, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [expenseMonth, setExpenseMonth] = useState(0);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const [d, e, i] = await Promise.all([
        api.get("/dashboard"), api.get("/expenses"), api.get("/insights"),
      ]);
      setStats(d.data);
      const today = new Date();
      const monthSpend = (e.data || []).filter((x: any) => {
        const dt = new Date(x.expense_date);
        return dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear();
      }).reduce((s: number, x: any) => s + (x.amount || 0), 0);
      setExpenseMonth(monthSpend);
      setInsights(i.data?.insights || []);
    } catch (err) { console.log("dash err", err); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const visibleInsights = insights.filter(i => !dismissed.has(i.id));

  const onAction = (ins: Insight) => {
    if (ins.phone && ins.kind === "reach_out") {
      Linking.openURL(`sms:${ins.phone}`).catch(() => {});
      return;
    }
    if (ins.route) router.push(ins.route as any);
  };

  const Metric = ({ icon, label, value, color, onPress, testID }: any) => (
    <TouchableOpacity testID={testID} activeOpacity={0.7} onPress={onPress} style={[common.card, styles.metric]}>
      <View style={[styles.iconBubble, { backgroundColor: color + "22" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const QuickAction = ({ icon, label, onPress, testID }: any) => (
    <TouchableOpacity testID={testID} style={styles.qa} onPress={onPress}>
      <View style={styles.qaIcon}><Feather name={icon} size={20} color={C.brand} /></View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={common.screen}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.brand} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={common.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: S.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.brand} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>POWERWASH CRM</Text>
            <Text style={styles.hello}>Hi, {user?.full_name?.split(" ")[0] || "there"}</Text>
          </View>
          <TouchableOpacity testID="open-settings" onPress={() => router.push("/settings")}>
            <View style={styles.avatar}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {user?.full_name?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          <Metric testID="m-revenue" icon="dollar-sign" label="Revenue (Month)" value={`$${(stats?.revenue_month || 0).toFixed(0)}`} color={C.success} onPress={() => router.push("/revenue")} />
          <Metric testID="m-jobs" icon="calendar" label="Jobs Today" value={stats?.jobs_today_count ?? 0} color={C.info} onPress={() => router.push("/(tabs)/schedule")} />
          <Metric testID="m-pending" icon="file-text" label="Pending Invoices" value={stats?.pending_invoices ?? 0} color={C.warning} onPress={() => router.push("/invoices")} />
          <Metric testID="m-customers" icon="users" label="Customers" value={stats?.active_customers ?? 0} color={C.brand} onPress={() => router.push("/(tabs)/customers")} />
          <Metric testID="m-doors" icon="map-pin" label="Doors Knocked" value={stats?.doors_knocked ?? 0} color={C.purple} onPress={() => router.push("/(tabs)/map")} />
          <Metric testID="m-expense" icon="shopping-bag" label="Expenses (Month)" value={`$${expenseMonth.toFixed(0)}`} color={C.error} onPress={() => router.push("/expenses")} />
        </View>

        <Text style={[common.h3, { marginTop: S.lg, marginBottom: S.md }]}>Quick Actions</Text>
        <View style={styles.qaRow}>
          <QuickAction testID="qa-calc" icon="grid" label="Calculator" onPress={() => router.push("/calculator")} />
          <QuickAction testID="qa-new-cust" icon="user-plus" label="Customer" onPress={() => router.push("/customer/new")} />
          <QuickAction testID="qa-new-quote" icon="edit-3" label="Quote" onPress={() => router.push("/quote/new")} />
          <QuickAction testID="qa-new-inv" icon="file-text" label="Invoice" onPress={() => router.push("/invoice/new")} />
        </View>

        <Text style={[common.h3, { marginTop: S.lg, marginBottom: S.md }]}>Today&apos;s Schedule</Text>
        {stats?.jobs_today?.length ? stats.jobs_today.map((j: any) => (
          <View key={j.id} style={[common.card, { marginBottom: S.sm }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={common.h4}>{j.customer_name}</Text>
                <Text style={common.bodySmall}>{j.address}</Text>
                <Text style={[common.bodySmall, { marginTop: 4 }]}>
                  {new Date(j.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {j.assigned_staff_name ? ` • ${j.assigned_staff_name}` : ""}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: C.brandSubtle }]}>
                <Text style={{ color: C.brand, fontWeight: "700", fontSize: 12 }}>${j.price?.toFixed(0) || 0}</Text>
              </View>
            </View>
          </View>
        )) : (
          <View style={[common.card, { alignItems: "center", paddingVertical: S.xl }]}>
            <Feather name="coffee" size={28} color={C.textMuted} />
            <Text style={[common.bodySmall, { marginTop: S.sm }]}>No jobs scheduled for today</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: S.sm, marginTop: S.md }}>
          <TouchableOpacity testID="go-invoices" style={[common.btnSecondary, { flex: 1 }]} onPress={() => router.push("/invoices")}>
            <Text style={common.btnSecondaryText}>Invoices</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="go-quotes" style={[common.btnSecondary, { flex: 1 }]} onPress={() => router.push("/quotes")}>
            <Text style={common.btnSecondaryText}>Quotes</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="go-expenses" style={[common.btnSecondary, { flex: 1 }]} onPress={() => router.push("/expenses")}>
            <Text style={common.btnSecondaryText}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="go-staff" style={[common.btnSecondary, { flex: 1 }]} onPress={() => router.push("/staff")}>
            <Text style={common.btnSecondaryText}>Staff</Text>
          </TouchableOpacity>
        </View>

        {/* Next Best Action AI section — at the bottom */}
        {visibleInsights.length > 0 && (
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
        )}

        <TouchableOpacity testID="signout" style={{ marginTop: S.xl, alignItems: "center" }} onPress={signOut}>
          <Text style={{ color: C.textMuted, fontWeight: "600" }}>Reset session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: S.lg },
  brand: { fontSize: 12, color: C.brand, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  hello: { fontSize: 26, fontWeight: "700", color: C.text, letterSpacing: -0.3, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  metric: { width: "48%", paddingVertical: S.md },
  iconBubble: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: S.sm },
  metricValue: { fontSize: 22, fontWeight: "700", color: C.text, letterSpacing: -0.3 },
  metricLabel: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  qaRow: { flexDirection: "row", gap: S.sm },
  qa: { flex: 1, backgroundColor: C.bg, paddingVertical: S.md, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: C.border },
  qaIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brandSubtle, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  qaLabel: { fontSize: 12, color: C.text, fontWeight: "600" },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  aiHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  aiCard: { marginBottom: 8, borderLeftWidth: 4 },
  aiIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  aiCta: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  aiCtaTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  aiDismiss: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.bg3 },
});
