import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Share, Platform, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function InvoiceSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const [inv, setInv] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [payUrl, setPayUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    try {
      const [all, s] = await Promise.all([api.get("/invoices"), api.get("/settings")]);
      const found = all.data.find((x: any) => x.id === id);
      setInv(found);
      setSettings(s.data);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const ensurePayLink = async (): Promise<string> => {
    if (payUrl) return payUrl;
    setGenerating(true);
    try {
      const origin = BACKEND_URL || "https://cleanpro-hub-15.preview.emergentagent.com";
      const { data } = await api.post(`/invoices/${id}/checkout`, { invoice_id: id, origin_url: origin });
      setPayUrl(data.url);
      return data.url;
    } catch (e: any) {
      Alert.alert("Stripe error", e?.response?.data?.detail || "Could not create payment link");
      return "";
    } finally { setGenerating(false); }
  };

  const markPaid = async () => {
    try { await api.post(`/invoices/${id}/mark-paid`); load(); } catch {}
  };

  const buildText = (link?: string) => {
    if (!inv) return "";
    const itemsLines = (inv.items || []).map((i: any) => `  • ${i.description}  —  $${Number(i.amount).toFixed(2)}`).join("\n");
    return `INVOICE ${inv.invoice_number}
${settings.business_name || "PowerWash CRM"}
${settings.business_phone ? settings.business_phone + "\n" : ""}${settings.business_email ? settings.business_email + "\n" : ""}
Bill To: ${inv.customer_name}
${inv.customer_email ? inv.customer_email + "\n" : ""}
Items:
${itemsLines}

Total: $${inv.total.toFixed(2)}
Status: ${inv.status.toUpperCase()}
${inv.due_date ? "Due: " + new Date(inv.due_date).toLocaleDateString() + "\n" : ""}${link ? "\nPay online: " + link : ""}

Thank you for your business!`;
  };

  const sendEmail = async () => {
    if (!inv) return;
    const link = inv.status === "paid" ? "" : await ensurePayLink();
    const to = inv.customer_email || "";
    const subject = `Invoice ${inv.invoice_number}`;
    const body = buildText(link);
    Linking.openURL(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      .catch(() => Alert.alert("Couldn't open email app"));
  };

  const sendSms = async () => {
    if (!inv) return;
    const link = inv.status === "paid" ? "" : await ensurePayLink();
    const body = `Hi ${inv.customer_name}, your invoice ${inv.invoice_number} for $${inv.total.toFixed(2)} is ready.${link ? " Pay online: " + link : ""}`;
    Linking.openURL(`sms:?body=${encodeURIComponent(body)}`).catch(() => {});
  };

  const shareInvoice = async () => {
    if (!inv) return;
    const link = inv.status === "paid" ? "" : await ensurePayLink();
    try { await Share.share({ message: buildText(link), title: `Invoice ${inv.invoice_number}` }); } catch {}
  };

  const copyPayLink = async () => {
    const link = await ensurePayLink();
    if (!link) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      try { await (navigator as any).clipboard.writeText(link); Alert.alert("Copied!", "Payment link copied to clipboard"); }
      catch { Alert.alert("Pay link", link); }
    } else {
      try { await Share.share({ message: link }); } catch {}
    }
  };

  const openPayLink = async () => {
    const link = await ensurePayLink();
    if (link) Linking.openURL(link);
  };

  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}><ActivityIndicator color={C.brand} /></View>;
  if (!inv) return <View style={{ padding: S.lg, backgroundColor: C.bg, flex: 1 }}><Text style={common.body}>Invoice not found</Text></View>;

  const statusColor = inv.status === "paid" ? C.success : inv.status === "overdue" ? C.error : C.warning;
  const isPaid = inv.status === "paid";

  return (
    <ScrollView style={common.screen} contentContainerStyle={{ padding: S.md, paddingBottom: 80 }}>
      <View style={[common.card, { padding: S.lg }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={common.caption}>Invoice</Text>
            <Text style={[common.h2, { marginTop: 2 }]}>{inv.invoice_number}</Text>
          </View>
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: statusColor + "30" }}>
            <Text style={{ color: statusColor, fontWeight: "800", fontSize: 12, textTransform: "uppercase" }}>{inv.status}</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: C.borderStrong, marginVertical: S.md }} />

        <Text style={common.caption}>From</Text>
        <Text style={[common.h4, { marginTop: 2 }]}>{settings.business_name || "PowerWash CRM"}</Text>
        {settings.business_phone ? <Text style={common.bodySmall}>{settings.business_phone}</Text> : null}
        {settings.business_email ? <Text style={common.bodySmall}>{settings.business_email}</Text> : null}
        {settings.business_address ? <Text style={common.bodySmall}>{settings.business_address}</Text> : null}

        <View style={{ height: 1, backgroundColor: C.borderStrong, marginVertical: S.md }} />

        <Text style={common.caption}>Bill To</Text>
        <Text style={[common.h4, { marginTop: 2 }]}>{inv.customer_name}</Text>
        {inv.customer_email ? <Text style={common.bodySmall}>{inv.customer_email}</Text> : null}

        <View style={{ height: 1, backgroundColor: C.borderStrong, marginVertical: S.md }} />

        <Text style={common.caption}>Items</Text>
        <View style={{ marginTop: 8 }}>
          {(inv.items || []).map((it: any, idx: number) => (
            <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: idx === inv.items.length - 1 ? 0 : 1, borderBottomColor: C.border }}>
              <Text style={[common.body, { flex: 1, paddingRight: 8 }]}>{it.description}</Text>
              <Text style={[common.body, { fontWeight: "700" }]}>${Number(it.amount).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 1, backgroundColor: C.borderStrong, marginVertical: S.md }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={common.h3}>Total</Text>
          <Text style={[common.h2, { color: C.brand }]}>${inv.total.toFixed(2)}</Text>
        </View>

        {inv.due_date && (
          <Text style={[common.bodySmall, { textAlign: "right", marginTop: 4 }]}>
            Due {new Date(inv.due_date).toLocaleDateString()}
          </Text>
        )}
      </View>

      {/* Stripe pay link banner */}
      {!isPaid && (
        <View style={[common.card, { marginTop: S.md, borderColor: C.brand, borderWidth: 1, backgroundColor: C.brandSubtle }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Feather name="credit-card" size={16} color={C.brand} />
            <Text style={[common.h4, { color: C.brand }]}>Stripe Payment Link</Text>
          </View>
          <Text style={[common.bodySmall, { marginBottom: 10 }]}>
            Tap Email/SMS/Share — we'll auto-attach a secure Stripe checkout link to the message. The invoice will mark itself paid the moment your customer pays.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity testID="open-pay-link" style={[common.btnPrimary, { flex: 1, height: 42 }]} onPress={openPayLink} disabled={generating}>
              {generating ? <ActivityIndicator color="#fff" /> : <Text style={common.btnPrimaryText}>Preview Link</Text>}
            </TouchableOpacity>
            <TouchableOpacity testID="copy-pay-link" style={[common.btnSecondary, { flex: 1, height: 42 }]} onPress={copyPayLink}>
              <Text style={common.btnSecondaryText}>Copy Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={{ marginTop: S.md, gap: S.sm }}>
        <View style={{ flexDirection: "row", gap: S.sm }}>
          <TouchableOpacity testID="send-email" style={[common.btnPrimary, { flex: 1 }]} onPress={sendEmail}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="mail" size={16} color="#fff" />
              <Text style={common.btnPrimaryText}>Email</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity testID="send-sms" style={[common.btnSecondary, { flex: 1 }]} onPress={sendSms}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="message-square" size={16} color={C.text} />
              <Text style={common.btnSecondaryText}>SMS</Text>
            </View>
          </TouchableOpacity>
          {Platform.OS !== "web" && (
            <TouchableOpacity testID="share-inv" style={[common.btnSecondary, { flex: 1 }]} onPress={shareInvoice}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="share-2" size={16} color={C.text} />
                <Text style={common.btnSecondaryText}>Share</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        {!isPaid && (
          <TouchableOpacity testID="mark-paid" style={[common.btnSecondary, { backgroundColor: C.success + "30" }]} onPress={markPaid}>
            <Text style={[common.btnSecondaryText, { color: C.success }]}>Mark as Paid (manually)</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
