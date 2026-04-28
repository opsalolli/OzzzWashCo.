import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { C, S, common } from "../src/theme";

export default function Calculator() {
  const { api } = useAuth();
  const router = useRouter();
  const [priceSmall, setPriceSmall] = useState("7");
  const [priceMed, setPriceMed] = useState("12");
  const [priceLarge, setPriceLarge] = useState("20");
  const [qSmall, setQSmall] = useState(0);
  const [qMed, setQMed] = useState(0);
  const [qLarge, setQLarge] = useState(0);
  const [busy, setBusy] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [editPrices, setEditPrices] = useState(false);

  useEffect(() => {
    api.get("/settings").then(r => {
      setPriceSmall(String(r.data.price_small ?? 7));
      setPriceMed(String(r.data.price_medium ?? 12));
      setPriceLarge(String(r.data.price_large ?? 20));
    }).catch(() => {});
  }, []);

  const ps = parseFloat(priceSmall) || 0;
  const pm = parseFloat(priceMed) || 0;
  const pl = parseFloat(priceLarge) || 0;
  const subS = ps * qSmall;
  const subM = pm * qMed;
  const subL = pl * qLarge;
  const total = subS + subM + subL;
  const totalCount = qSmall + qMed + qLarge;

  const savePrices = async () => {
    setSavingPrices(true);
    try {
      await api.put("/settings", { price_small: ps, price_medium: pm, price_large: pl });
      setEditPrices(false);
      Alert.alert("✓ Prices saved", `Small $${ps.toFixed(2)} • Medium $${pm.toFixed(2)} • Large $${pl.toFixed(2)}`);
    } catch (e: any) {
      const msg = e?.response?.status === 401
        ? "Session expired — go to Dashboard, tap Reset session, then try again."
        : (e?.response?.data?.detail || e?.message || "Unknown error");
      Alert.alert("Couldn't save prices", msg);
    } finally { setSavingPrices(false); }
  };

  const reset = () => { setQSmall(0); setQMed(0); setQLarge(0); };

  const sendToQuote = async () => {
    if (totalCount === 0) return Alert.alert("Add some windows first");
    setBusy(true);
    try { await api.put("/settings", { price_small: ps, price_medium: pm, price_large: pl }); } catch {}
    setBusy(false);
    const items: any[] = [];
    if (qSmall) items.push({ description: `Small windows × ${qSmall} @ $${ps.toFixed(2)}`, amount: subS });
    if (qMed) items.push({ description: `Medium windows × ${qMed} @ $${pm.toFixed(2)}`, amount: subM });
    if (qLarge) items.push({ description: `Large windows × ${qLarge} @ $${pl.toFixed(2)}`, amount: subL });
    router.push({ pathname: "/quote/new", params: { calc_items: JSON.stringify(items) } });
  };

  const renderRow = (size: string, price: string, setPrice: (v: string) => void, qty: number, setQty: (n: number) => void, sub: number) => (
    <View style={[common.card, { marginBottom: S.sm }]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={common.h4}>{size} window</Text>
          {editPrices ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Text style={[common.body, { color: C.textSecondary }]}>$</Text>
              <TextInput style={styles.priceInput} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <Text style={[common.body, { color: C.textSecondary }]}>each</Text>
            </View>
          ) : (
            <Text style={common.bodySmall}>${parseFloat(price || "0").toFixed(2)} each</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => setQty(Math.max(0, qty - 1))} style={styles.qBtn}>
            <Feather name="minus" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.qty}>{qty}</Text>
          <TouchableOpacity onPress={() => setQty(qty + 1)} style={[styles.qBtn, { backgroundColor: C.brand }]}>
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      {qty > 0 && (
        <Text style={[common.bodySmall, { marginTop: 8, textAlign: "right", color: C.brand, fontWeight: "700" }]}>
          Subtotal: ${sub.toFixed(2)}
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView style={common.screen} contentContainerStyle={{ padding: S.md }} keyboardShouldPersistTaps="handled">
      <View style={[common.card, { marginBottom: S.md, alignItems: "center" }]}>
        <Text style={common.caption}>Total Quote</Text>
        <Text style={[common.h1, { color: C.brand, marginTop: 4 }]}>${total.toFixed(2)}</Text>
        <Text style={common.bodySmall}>{totalCount} windows total</Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
        <Text style={common.h3}>Window Sizes</Text>
        {!editPrices && (
          <TouchableOpacity testID="edit-prices" onPress={() => setEditPrices(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.brandSubtle }}>
            <Feather name="edit-2" size={14} color={C.brand} />
            <Text style={{ color: C.brand, fontWeight: "700" }}>Edit prices</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderRow("Small", priceSmall, setPriceSmall, qSmall, setQSmall, subS)}
      {renderRow("Medium", priceMed, setPriceMed, qMed, setQMed, subM)}
      {renderRow("Large", priceLarge, setPriceLarge, qLarge, setQLarge, subL)}

      {editPrices && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4, marginBottom: S.md }}>
          <TouchableOpacity testID="cancel-prices" style={[common.btnSecondary, { flex: 1 }]} onPress={() => setEditPrices(false)} disabled={savingPrices}>
            <Text style={common.btnSecondaryText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="save-prices" style={[common.btnPrimary, { flex: 2, backgroundColor: C.success }]} onPress={savePrices} disabled={savingPrices}>
            {savingPrices ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="check" size={18} color="#fff" />
                <Text style={common.btnPrimaryText}>Save Prices</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {!editPrices && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: S.md }}>
          <TouchableOpacity testID="calc-reset" style={[common.btnSecondary, { flex: 1 }]} onPress={reset}>
            <Text style={common.btnSecondaryText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="calc-send-quote" style={[common.btnPrimary, { flex: 2 }]} onPress={sendToQuote} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="file-text" size={16} color="#fff" />
                <Text style={common.btnPrimaryText}>Create Quote</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  qBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg3, alignItems: "center", justifyContent: "center" },
  qty: { color: C.text, fontSize: 22, fontWeight: "700", minWidth: 30, textAlign: "center" },
  priceInput: { color: C.text, fontSize: 18, fontWeight: "700", borderBottomWidth: 1, borderBottomColor: C.brand, minWidth: 70, paddingVertical: 2 },
});
