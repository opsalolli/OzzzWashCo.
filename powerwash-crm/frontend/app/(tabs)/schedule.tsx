import { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }

export default function Schedule() {
  const { api } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date>(new Date());

  const load = async () => {
    try { const { data } = await api.get("/jobs"); setJobs(data); }
    catch {} finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i - 1)), []);
  const filtered = jobs.filter(j => sameDay(new Date(j.scheduled_at), selected));

  const statusColor = (s: string) => s === "completed" ? C.success : s === "in_progress" ? C.warning : s === "cancelled" ? C.error : C.info;

  return (
    <SafeAreaView style={common.screenWhite} edges={["top"]}>
      <View style={styles.header}>
        <Text style={common.h1}>Schedule</Text>
        <TouchableOpacity testID="new-job-fab" onPress={() => router.push("/job/new")} style={styles.addBtn}>
          <Feather name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.md, gap: 8 }} style={{ maxHeight: 88, flexGrow: 0 }}>
        {days.map(d => {
          const active = sameDay(d, selected);
          const hasJobs = jobs.some(j => sameDay(new Date(j.scheduled_at), d));
          return (
            <TouchableOpacity key={d.toISOString()} onPress={() => setSelected(d)} style={[styles.day, active && styles.dayActive]}>
              <Text style={[styles.dayWk, active && { color: "#fff" }]}>{d.toLocaleDateString(undefined, { weekday: "short" })}</Text>
              <Text style={[styles.dayNum, active && { color: "#fff" }]}>{d.getDate()}</Text>
              {hasJobs && <View style={[styles.dot, { backgroundColor: active ? "#fff" : C.brand }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.brand} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="calendar" size={36} color={C.textMuted} />
          <Text style={[common.h4, { marginTop: 12 }]}>No jobs on this day</Text>
        </View>
      ) : (
        <FlatList
          data={filtered.sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: S.md, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <View style={[common.card, { flexDirection: "row", marginBottom: S.sm, borderLeftWidth: 4, borderLeftColor: statusColor(item.status) }]}>
              <View style={{ width: 66 }}>
                <Text style={styles.time}>{new Date(item.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>{item.duration_min}m</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={common.h4}>{item.customer_name}</Text>
                <Text style={common.bodySmall}>{item.address}</Text>
                {item.assigned_staff_name ? <Text style={[common.bodySmall, { color: C.textMuted }]}>{item.assigned_staff_name}</Text> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <View style={[styles.pill, { backgroundColor: statusColor(item.status) + "22" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor(item.status), textTransform: "uppercase" }}>{item.status.replace("_", " ")}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.text }}>${item.price?.toFixed(0) || 0}</Text>
                </View>
              </View>
              <JobQuickActions job={item} reload={load} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function JobQuickActions({ job, reload }: { job: any; reload: () => void }) {
  const { api } = useAuth();
  const next = job.status === "scheduled" ? "in_progress" : job.status === "in_progress" ? "completed" : null;
  if (!next) return null;
  return (
    <TouchableOpacity
      testID={`job-advance-${job.id}`}
      onPress={async () => { try { await api.put(`/jobs/${job.id}`, { status: next }); reload(); } catch {} }}
      style={{ alignSelf: "center", padding: 8 }}
    >
      <Feather name="arrow-right-circle" size={24} color={C.brand} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: S.md },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  day: { width: 60, paddingVertical: 10, alignItems: "center", borderRadius: 12, backgroundColor: C.bg2 },
  dayActive: { backgroundColor: C.brand },
  dayWk: { fontSize: 11, fontWeight: "700", color: C.textSecondary, textTransform: "uppercase" },
  dayNum: { fontSize: 20, fontWeight: "700", color: C.text, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  time: { fontSize: 15, fontWeight: "700", color: C.text },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
});
