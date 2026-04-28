import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { C, S, common } from "../../src/theme";

export default function Quotes() {
  const { api } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { try { const { data } = await api.get("/quotes"); setItems(data); } catch {} finally { setLoading(false); } };
  useFocusEffect(useCallback(() => { load(); }, []));

  const convert = async (id: string) => {
    try { await api.post(`/quotes/${id}/convert`); Alert.alert("Converted", "Quote converted to invoice"); load(); }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
  };

  return (
    <SafeAreaView style={common.screenWhite} edges={["bottom"]}>
      {loading ? <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} /> :
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: S.md, paddingBottom: 80 }}
          ListEmptyComponent={<View style={{ alignItems: "center", marginTop: 40 }}><Feather name="edit-3" size={30} color={C.textMuted} /><Text style={common.bodySmall}>No quotes yet</Text></View>}
          renderItem={({ item }) => (
            <View style={[common.card, { marginBottom: S.sm }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={common.h4}>{item.customer_name}</Text>
                  <Text style={common.bodySmall}>{new Date(item.created_at).toLocaleDateString()}</Text>
                  {item.notes ? <Text style={[common.bodySmall, { marginTop: 4 }]} numberOfLines={2}>{item.notes}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={common.h3}>${item.total.toFixed(2)}</Text>
                  <Text style={{ color: item.status === "accepted" ? C.success : C.textMuted, fontWeight: "700", fontSize: 12, textTransform: "uppercase", marginTop: 2 }}>{item.status}</Text>
                </View>
              </View>
              {item.status !== "accepted" && (
                <TouchableOpacity testID={`convert-${item.id}`} onPress={() => convert(item.id)} style={[common.btnPrimary, { marginTop: S.sm, height: 40 }]}>
                  <Text style={common.btnPrimaryText}>Convert to Invoice</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      }
    </SafeAreaView>
  );
}
