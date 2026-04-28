import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { (async () => {
    try { const { data } = await api.get(`/customers/${id}`); setD(data); }
    catch {} finally { setLoading(false); }
  })(); }, [id]);

  const onDelete = () => {
    if (!d?.customer) return;
    const name = d.customer.name;
    Alert.alert(
      "Delete customer?",
      `${name} will be permanently removed. Their job and invoice history will remain.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete(`/customers/${id}`);
              router.back();
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.detail || "Failed to delete");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.brand} /></View>;
  if (!d) return <View style={{ padding: S.lg }}><Text>Customer not found</Text></View>;
  const c = d.customer;

  const Action = ({ icon, label, onPress, testID }: any) => (
    <TouchableOpacity testID={testID} style={styles.act} onPress={onPress}>
      <Feather name={icon} size={18} color={C.brand} />
      <Text style={styles.actTxt}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={common.screen} contentContainerStyle={{ padding: S.md }}>
      <Text style={common.h1}>{c.name}</Text>
      <Text style={[common.bodySmall, { marginBottom: S.md }]}>{c.address}</Text>

      <View style={{ flexDirection: "row", gap: S.sm, marginBottom: S.md }}>
        {c.phone && <Action icon="phone" label="Call" onPress={() => Linking.openURL(`tel:${c.phone}`)} testID="cust-call" />}
        {c.phone && <Action icon="message-square" label="SMS" onPress={() => Linking.openURL(`sms:${c.phone}`)} testID="cust-sms" />}
        {c.email && <Action icon="mail" label="Email" onPress={() => Linking.openURL(`mailto:${c.email}`)} testID="cust-email" />}
      </View>

      <View style={common.card}>
        <Text style={common.caption}>Contact</Text>
        <Text style={[common.body, { marginTop: 4 }]}>{c.email || "—"}</Text>
        <Text style={common.body}>{c.phone || "—"}</Text>
        {c.notes ? <Text style={[common.bodySmall, { marginTop: 8 }]}>{c.notes}</Text> : null}
      </View>

      <View style={{ flexDirection: "row", gap: S.sm, marginTop: S.md }}>
        <TouchableOpacity testID="cust-new-quote" style={[common.btnPrimary, { flex: 1 }]} onPress={() => router.push({ pathname: "/quote/new", params: { customer_id: c.id } })}>
          <Text style={common.btnPrimaryText}>New Quote</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="cust-new-job" style={[common.btnSecondary, { flex: 1 }]} onPress={() => router.push({ pathname: "/job/new", params: { customer_id: c.id } })}>
          <Text style={common.btnSecondaryText}>Schedule Job</Text>
        </TouchableOpacity>
      </View>

      <Text style={[common.h3, { marginTop: S.lg, marginBottom: S.sm }]}>Service History ({d.jobs.length})</Text>
      {d.jobs.length === 0 ? <Text style={common.bodySmall}>No jobs yet</Text> :
        d.jobs.map((j: any) => (
          <View key={j.id} style={[common.card, { marginBottom: S.sm }]}>
            <Text style={common.h4}>{new Date(j.scheduled_at).toLocaleDateString()}</Text>
            <Text style={common.bodySmall}>{j.status.toUpperCase()} • ${j.price?.toFixed(0) || 0}</Text>
          </View>
        ))}

      <Text style={[common.h3, { marginTop: S.lg, marginBottom: S.sm }]}>Invoices ({d.invoices.length})</Text>
      {d.invoices.length === 0 ? <Text style={common.bodySmall}>No invoices</Text> :
        d.invoices.map((i: any) => (
          <View key={i.id} style={[common.card, { marginBottom: S.sm, flexDirection: "row", justifyContent: "space-between" }]}>
            <View>
              <Text style={common.h4}>{i.invoice_number}</Text>
              <Text style={common.bodySmall}>${i.total.toFixed(2)}</Text>
            </View>
            <Text style={{ color: i.status === "paid" ? C.success : C.warning, fontWeight: "700" }}>{i.status.toUpperCase()}</Text>
          </View>
        ))}

      <TouchableOpacity
        testID="cust-delete"
        onPress={onDelete}
        disabled={deleting}
        style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
      >
        {deleting ? (
          <ActivityIndicator color={C.error} />
        ) : (
          <>
            <Feather name="trash-2" size={16} color={C.error} />
            <Text style={styles.deleteTxt}>Delete Customer</Text>
          </>
        )}
      </TouchableOpacity>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  act: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: C.brandSubtle, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  actTxt: { color: C.brandActive, fontWeight: "700" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: S.lg, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.error + "40", backgroundColor: C.error + "10" },
  deleteTxt: { color: C.error, fontWeight: "700", fontSize: 15 },
});
