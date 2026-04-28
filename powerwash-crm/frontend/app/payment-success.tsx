import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { C, S, common } from "../src/theme";

const POLL_INTERVAL = 2000;
const MAX_ATTEMPTS = 8;

export default function PaymentSuccess() {
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const { api } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "paid" | "failed" | "expired">("checking");
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!session_id) { setStatus("failed"); return; }
    let attempts = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.get(`/checkout/status/${session_id}`);
        if (data.payment_status === "paid") {
          setStatus("paid");
          if (data.amount_total != null) setAmount(data.amount_total / 100);
          return;
        }
        if (data.status === "expired") { setStatus("expired"); return; }
        if (++attempts >= MAX_ATTEMPTS) { setStatus("failed"); return; }
        setTimeout(poll, POLL_INTERVAL);
      } catch {
        if (++attempts >= MAX_ATTEMPTS) { setStatus("failed"); return; }
        setTimeout(poll, POLL_INTERVAL);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [session_id]);

  return (
    <View style={[common.screen, styles.center]}>
      {status === "checking" && (
        <>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={[common.h3, { marginTop: 16 }]}>Confirming payment…</Text>
          <Text style={common.bodySmall}>Hang tight, this only takes a moment.</Text>
        </>
      )}
      {status === "paid" && (
        <>
          <View style={[styles.icon, { backgroundColor: C.success + "30" }]}>
            <Feather name="check" size={40} color={C.success} />
          </View>
          <Text style={[common.h1, { marginTop: 20 }]}>Payment received</Text>
          {amount != null && <Text style={[common.h3, { color: C.success, marginTop: 4 }]}>${amount.toFixed(2)}</Text>}
          <Text style={[common.bodySmall, { marginTop: 8, textAlign: "center", paddingHorizontal: 32 }]}>
            Your invoice is now marked as paid. Thank you!
          </Text>
        </>
      )}
      {status === "expired" && (
        <>
          <Feather name="clock" size={48} color={C.warning} />
          <Text style={[common.h3, { marginTop: 16 }]}>Session expired</Text>
        </>
      )}
      {status === "failed" && (
        <>
          <Feather name="alert-circle" size={48} color={C.error} />
          <Text style={[common.h3, { marginTop: 16 }]}>Couldn't confirm payment</Text>
          <Text style={[common.bodySmall, { marginTop: 4, textAlign: "center", paddingHorizontal: 32 }]}>
            Check your invoice list — if it shows as Paid, you're all set.
          </Text>
        </>
      )}

      <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={[common.btnPrimary, { marginTop: 28, paddingHorizontal: 32 }]}>
        <Text style={common.btnPrimaryText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: S.lg },
  icon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
});
