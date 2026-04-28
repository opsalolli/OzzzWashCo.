import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { C, S, common } from "../src/theme";

type Row = {
  key: string; label: string; year: number; month: number;
  revenue: number; invoices: number; jobs: number; completed: number;
};

type SortKey = "month" | "jobs" | "revenue";

export default function RevenueScreen() {
  const { api } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("month");

  const load = async () => {
    try {
      const r = await api.get("/revenue/monthly");
      setRows(r.data?.months || []);
      setTotalRevenue(r.data?.total_revenue || 0);
      setTotalJobs(r.data?.total_jobs || 0);
    } catch (e) {
      console.log("revenue err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === "month") {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    }
    if (sortKey === "jobs") return b.jobs - a.jobs;
    return b.revenue - a.revenue;
  });

  const maxRevenue = Math.max(1, ...sorted.map(r => r.revenue));

  const SortChip = ({ k, label }: { k: SortKey; label: string }) => (
    <TouchableOpacity
      onPress={() => setSortKey(k)}
      style={[styles.chip, sortKey === k && styles.chipActive]}
      testID={`sort-${k}`}
    >
      <Text style={[styles.chipTxt, sortKey === k && styles.chipTxtActive]}>{label}</Text>
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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="rev-back">
          <Feather name="chevron-left" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Monthly Revenue</Text>
          <Text style={styles.subtitle}>Sorted by month and number of jobs</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: S.md, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.brand} />}
      >
        {/* Totals */}
        <View style={styles.totalsRow}>
          <View style={[common.card, styles.totalCard]}>
            <View style={[styles.bubble, { backgroundColor: C.success + "22" }]}>
              <Feather name="dollar-sign" size={16} color={C.success} />
            </View>
            <Text style={styles.totalValue}>${totalRevenue.toFixed(0)}</Text>
            <Text style={styles.totalLabel}>Lifetime Revenue</Text>
          </View>
          <View style={[common.card, styles.totalCard]}>
            <View style={[styles.bubble, { backgroundColor: C.brand + "22" }]}>
              <Feather name="briefcase" size={16} color={C.brand} />
            </View>
            <Text style={styles.totalValue}>{totalJobs}</Text>
            <Text style={styles.totalLabel}>Total Jobs</Text>
          </View>
        </View>

        {/* Sort */}
        <Text style={[common.caption, { marginTop: S.md, marginBottom: S.sm }]}>SORT BY</Text>
        <View style={{ flexDirection: "row", gap: S.sm }}>
          <SortChip k="month" label="Newest" />
          <SortChip k="jobs" label="Most Jobs" />
          <SortChip k="revenue" label="Top Revenue" />
        </View>

        {/* Rows */}
        <Text style={[common.caption, { marginTop: S.lg, marginBottom: S.sm }]}>BREAKDOWN</Text>
        {sorted.length === 0 ? (
          <View style={[common.card, { alignItems: "center", paddingVertical: S.xl }]}>
            <Feather name="bar-chart-2" size={28} color={C.textMuted} />
            <Text style={[common.bodySmall, { marginTop: S.sm }]}>No revenue or jobs yet</Text>
          </View>
        ) : sorted.map((row) => {
          const pct = Math.round((row.revenue / maxRevenue) * 100);
          return (
            <View key={row.key} style={[common.card, styles.row]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.month}>{row.label}</Text>
                  <View style={{ flexDirection: "row", gap: S.md, marginTop: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="calendar" size={12} color={C.textMuted} />
                      <Text style={styles.metaTxt}>{row.jobs} job{row.jobs === 1 ? "" : "s"}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="check-circle" size={12} color={C.success} />
                      <Text style={styles.metaTxt}>{row.completed} done</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="file-text" size={12} color={C.textMuted} />
                      <Text style={styles.metaTxt}>{row.invoices} inv</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.revenue}>${row.revenue.toFixed(0)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: S.md, paddingTop: S.sm, paddingBottom: S.md, gap: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: C.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  totalsRow: { flexDirection: "row", gap: S.sm },
  totalCard: { flex: 1, paddingVertical: S.md },
  bubble: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: S.sm },
  totalValue: { fontSize: 22, fontWeight: "700", color: C.text, letterSpacing: -0.3 },
  totalLabel: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  chipActive: { backgroundColor: C.brand, borderColor: C.brand },
  chipTxt: { fontSize: 13, color: C.textSecondary, fontWeight: "600" },
  chipTxtActive: { color: "#fff" },
  row: { marginBottom: S.sm },
  month: { fontSize: 16, fontWeight: "700", color: C.text },
  metaTxt: { fontSize: 12, color: C.textSecondary },
  revenue: { fontSize: 18, fontWeight: "700", color: C.success, marginLeft: S.sm },
  barTrack: { height: 6, backgroundColor: C.bg3, borderRadius: 999, marginTop: S.sm, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: C.brand, borderRadius: 999 },
});
