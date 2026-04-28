import React, { useCallback, useEffect, useRef, useState } from "react";import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Modal, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { C, S, common, statusLabel } from "../../src/theme";

const DALLAS_CENTER = { lat: 32.7767, lng: -96.797 };

const STATUSES = ["customer", "not_interested", "interested", "no_answer", "not_knocked"] as const;

type House = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  status: string;
  notes?: string;
};

type Measurement = {
  id: string;
  label: string;
  surface_type: string;
  points: { lat: number; lng: number }[];
  area_sqft: number;
  perimeter_ft: number;
};

const SURFACE_TYPES = ["driveway", "sidewalk", "patio", "deck", "house", "fence", "roof", "other"];

function buildHtml(houses: House[], measurements: Measurement[], pinColors: Record<string, string>) {
  const data = JSON.stringify(houses);
  const meas = JSON.stringify(measurements);
  const colors = JSON.stringify(pinColors);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{height:100%;margin:0;padding:0;background:#0B0F14;font-family:-apple-system,system-ui,sans-serif}
.pin-icon{width:30px;height:30px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;box-shadow:0 3px 8px rgba(0,0,0,.45)}
.leaflet-control-attribution{font-size:9px;background:rgba(0,0,0,0.6) !important;color:#999 !important}
.leaflet-control-attribution a{color:#aaa !important}
.leaflet-control-zoom a{background:#11161D !important;color:#fff !important;border-color:#1F2937 !important}
.measure-tooltip{background:#3B82F6;color:#fff;border:none;font-weight:700;font-size:13px;padding:4px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.4)}
.measure-tooltip:before{display:none}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const PINS = ${colors};
  const GLYPH = { customer:'✓', not_interested:'✕', interested:'★', no_answer:'?', not_knocked:'○' };
  const send = (m) => {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
    else if (window.parent) window.parent.postMessage(JSON.stringify(m), '*');
  };

  const map = L.map('map', { zoomControl: true, attributionControl: true })
    .setView([${DALLAS_CENTER.lat}, ${DALLAS_CENTER.lng}], 13);

  // Google Maps hybrid satellite (with street labels baked in)
  L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    attribution: 'Google',
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3'],
  }).addTo(map);

  // -------- Pin markers --------
  const markers = {};
  function makeIcon(status){
    const color = PINS[status] || '#6B7280';
    const g = GLYPH[status] || '·';
    return L.divIcon({ className:'', iconSize:[30,30], iconAnchor:[15,15],
      html: '<div class="pin-icon" style="background:'+color+'">'+g+'</div>' });
  }
  function addMarker(h){
    const m = L.marker([h.lat, h.lng], { icon: makeIcon(h.status) });
    m.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      send({ type:'pin-edit', house: h });
    });
    m.addTo(map);
    markers[h.id] = m;
  }
  ${"" /* initial render */}
  ${data}.forEach(addMarker);

  // -------- Measurement layer --------
  const measureLayer = L.layerGroup().addTo(map);
  function ringAreaSqft(latlngs){
    if (latlngs.length < 3) return 0;
    // Equirectangular projection -> shoelace. Accurate for small polygons.
    const meanLat = latlngs.reduce((s,p) => s + p.lat, 0) / latlngs.length;
    const cosLat = Math.cos(meanLat * Math.PI / 180);
    const M = 111319.9;
    const xy = latlngs.map(p => ({ x: p.lng * M * cosLat, y: p.lat * M }));
    let s = 0;
    for (let i = 0; i < xy.length; i++) {
      const j = (i + 1) % xy.length;
      s += xy[i].x * xy[j].y - xy[j].x * xy[i].y;
    }
    const m2 = Math.abs(s) / 2;
    return m2 * 10.7639; // m^2 -> sqft
  }
  function perimFt(latlngs){
    let dist = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
      dist += map.distance(latlngs[i], latlngs[i+1]);
    }
    if (latlngs.length > 2) dist += map.distance(latlngs[latlngs.length-1], latlngs[0]);
    return dist * 3.28084; // m -> ft
  }
  function drawSavedMeasurements(list){
    measureLayer.clearLayers();
    list.forEach(m => {
      const poly = L.polygon(m.points.map(p => [p.lat, p.lng]), { color: '#3B82F6', weight: 3, fillOpacity: 0.25 });
      poly.bindTooltip(m.label + ' · ' + Math.round(m.area_sqft) + ' sqft', { permanent: true, className: 'measure-tooltip', direction: 'center' });
      poly.on('click', () => send({ type:'measurement', measurement: m }));
      poly.addTo(measureLayer);
    });
  }
  drawSavedMeasurements(${meas});

  // -------- Active measurement (drawing) --------
  let measuring = false;
  let activePts = [];
  let activeLine = null;
  let activePoly = null;
  let activeMarkers = [];
  let activeLabel = null;

  function clearActive(){
    if (activeLine){ measureLayer.removeLayer(activeLine); activeLine = null; }
    if (activePoly){ measureLayer.removeLayer(activePoly); activePoly = null; }
    activeMarkers.forEach(m => measureLayer.removeLayer(m));
    activeMarkers = [];
    if (activeLabel){ measureLayer.removeLayer(activeLabel); activeLabel = null; }
    activePts = [];
  }
  function refreshActive(){
    if (activeLine){ measureLayer.removeLayer(activeLine); activeLine = null; }
    if (activePoly){ measureLayer.removeLayer(activePoly); activePoly = null; }
    if (activePts.length >= 2 && activePts.length < 3) {
      activeLine = L.polyline(activePts, { color: '#3B82F6', weight: 4, dashArray: '6,6' }).addTo(measureLayer);
    }
    if (activePts.length >= 3) {
      activePoly = L.polygon(activePts, { color: '#3B82F6', weight: 4, fillColor: '#3B82F6', fillOpacity: 0.25 }).addTo(measureLayer);
    }
    if (activeLabel){ measureLayer.removeLayer(activeLabel); activeLabel = null; }
    let info = activePts.length + ' pt' + (activePts.length===1?'':'s');
    if (activePts.length >= 3) {
      const sqft = ringAreaSqft(activePts);
      info = Math.round(sqft).toLocaleString() + ' sqft';
    } else if (activePts.length === 2) {
      const ft = map.distance(activePts[0], activePts[1]) * 3.28084;
      info = Math.round(ft) + ' ft';
    }
    send({ type:'measure-progress', count: activePts.length, info: info, area: activePts.length>=3 ? ringAreaSqft(activePts) : 0, perim: perimFt(activePts) });
    if (activePts.length > 0) {
      activeLabel = L.marker(activePts[activePts.length-1], { icon: L.divIcon({ className:'', html: '<div class="measure-tooltip">'+info+'</div>', iconSize:[1,1] }) }).addTo(measureLayer);
    }
  }
  window.__measureStart = function(){ measuring = true; clearActive(); send({ type:'measure-progress', count:0, info:'Tap to add points' }); };
  window.__measureUndo = function(){ if (measuring && activePts.length){ const last = activeMarkers.pop(); if (last) measureLayer.removeLayer(last); activePts.pop(); refreshActive(); } };
  window.__measureCancel = function(){ measuring = false; clearActive(); send({ type:'measure-progress', count:0, info:'' }); };
  window.__measureFinish = function(){
    if (!measuring || activePts.length < 3) return;
    const sqft = ringAreaSqft(activePts);
    const perim = perimFt(activePts);
    const points = activePts.map(p => ({ lat: p.lat, lng: p.lng }));
    send({ type:'measure-complete', area_sqft: sqft, perimeter_ft: perim, points });
    measuring = false;
    clearActive();
  };
  window.__updateHouses = function(list){
    Object.values(markers).forEach(m => map.removeLayer(m));
    Object.keys(markers).forEach(k => delete markers[k]);
    list.forEach(addMarker);
  };
  window.__updateMeasurements = function(list){ drawSavedMeasurements(list); };
  window.__flyTo = function(lat, lng, z){ map.setView([lat,lng], z||16); };

  map.on('click', (e) => {
    if (measuring) {
      activePts.push(e.latlng);
      const dot = L.circleMarker(e.latlng, { radius: 6, color: '#fff', weight: 2, fillColor: '#3B82F6', fillOpacity: 1 }).addTo(measureLayer);
      activeMarkers.push(dot);
      refreshActive();
    } else {
      send({ type:'map', lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  true;
</script></body></html>`;
}

// Web fallback: render the same HTML inside an iframe
function WebMap({ html, onMessage, mapRef }: { html: string; onMessage: (e: any) => void; mapRef: React.MutableRefObject<any> }) {
  const ref = useRef<any>(null);
  // Freeze html to the first value we ever receive so the iframe
  // never reloads when data updates (we use inject for updates).
  const htmlRef = useRef(html);
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data === "string") onMessage({ nativeEvent: { data: event.data } });
    };
    if (typeof window !== "undefined") window.addEventListener("message", handler);
    mapRef.current = {
      injectJavaScript: (code: string) => {
        try { ref.current?.contentWindow?.eval(code); } catch (e) { console.log("iframe eval err", e); }
      },
    };
    return () => { if (typeof window !== "undefined") window.removeEventListener("message", handler); };
  }, [onMessage]);
  return React.createElement("iframe", {
    ref,
    srcDoc: htmlRef.current,
    style: { border: 0, width: "100%", height: "100%", flex: 1, background: "#0B0F14" },
  });
}

export default function MapScreen() {
  const { api } = useAuth();
  const router = useRouter();
  const [houses, setHouses] = useState<House[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  // "drop pen" — selecting an icon sets the status used for the NEXT pin
  // dropped on the map. It no longer filters existing pins (they all stay visible).
  const [dropMode, setDropMode] = useState<string>("not_knocked");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const [sheet, setSheet] = useState<{ house?: House; newPoint?: { lat: number; lng: number } } | null>(null);
  const [savingBusy, setSavingBusy] = useState(false);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>("not_knocked");

  const [measuring, setMeasuring] = useState(false);
  const [measureInfo, setMeasureInfo] = useState<string>("");
  const [pendingMeasurement, setPendingMeasurement] = useState<{ area_sqft: number; perimeter_ft: number; points: { lat: number; lng: number }[] } | null>(null);
  const [measLabel, setMeasLabel] = useState("");
  const [measSurface, setMeasSurface] = useState("driveway");

  const webRef = useRef<any>(null);
  // Build the HTML exactly once (with empty data); all updates go through inject.
  const initialHtmlRef = useRef(buildHtml([], [], C.pins));

  const reload = async () => {
    try {
      const [h, m] = await Promise.all([api.get("/houses"), api.get("/measurements")]);
      setHouses(h.data);
      setMeasurements(m.data);
      // All pins always visible — no filtering
      const housesJson = JSON.stringify(h.data);
      const measJson = JSON.stringify(m.data);
      inject(`window.__updateHouses && window.__updateHouses(${housesJson}); window.__updateMeasurements && window.__updateMeasurements(${measJson}); true;`);
    } catch {} finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { reload(); }, []));

  const inject = (code: string) => {
    try { webRef.current?.injectJavaScript?.(code); } catch {}
  };

  const startMeasure = () => {
    setMeasuring(true);
    setMeasureInfo("Tap on the map to add points");
    inject("window.__measureStart && window.__measureStart(); true;");
  };
  const cancelMeasure = () => {
    setMeasuring(false);
    setMeasureInfo("");
    inject("window.__measureCancel && window.__measureCancel(); true;");
  };
  const undoMeasure = () => inject("window.__measureUndo && window.__measureUndo(); true;");
  const finishMeasure = () => inject("window.__measureFinish && window.__measureFinish(); true;");

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "map") {
        // Drop a pin instantly using the currently-selected status icon
        api.post("/houses", {
          address: `Pin ${msg.lat.toFixed(5)}, ${msg.lng.toFixed(5)}`,
          notes: "",
          status: dropMode,
          lat: msg.lat,
          lng: msg.lng,
        }).then(() => reload()).catch(() => {});
      } else if (msg.type === "pin-edit") {
        const h = msg.house as House;
        setSheet({ house: h });
        setAddress(h.address); setNotes(h.notes || ""); setStatus(h.status);
      } else if (msg.type === "measure-progress") {
        setMeasureInfo(msg.info || "");
      } else if (msg.type === "measure-complete") {
        setMeasuring(false);
        setMeasureInfo("");
        setPendingMeasurement({ area_sqft: msg.area_sqft, perimeter_ft: msg.perimeter_ft, points: msg.points });
        setMeasLabel(`Area ${Math.round(msg.area_sqft)} sqft`);
        setMeasSurface("driveway");
      }
    } catch {}
  };

  const saveHouse = async () => {
    if (!address.trim()) { Alert.alert("Address required"); return; }
    setSavingBusy(true);
    try {
      if (sheet?.house) await api.put(`/houses/${sheet.house.id}`, { address, notes, status });
      else if (sheet?.newPoint) await api.post("/houses", { address, notes, status, lat: sheet.newPoint.lat, lng: sheet.newPoint.lng });
      setSheet(null);
      await reload();
    } catch (e: any) { Alert.alert("Save failed", e?.response?.data?.detail || "Try again"); }
    finally { setSavingBusy(false); }
  };
  const delHouse = async () => {
    if (!sheet?.house) return;
    Alert.alert("Delete pin?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.delete(`/houses/${sheet.house!.id}`); setSheet(null); await reload(); } },
    ]);
  };
  const convertHouse = async () => {
    if (!sheet?.house) return;
    try { await api.post(`/houses/${sheet.house.id}/convert-to-customer`); Alert.alert("Converted!"); setSheet(null); await reload(); }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
  };

  const saveMeasurement = async (alsoQuote: boolean = false) => {
    if (!pendingMeasurement) return;
    try {
      await api.post("/measurements", { label: measLabel || "Measurement", surface_type: measSurface, ...pendingMeasurement });
      const sqft = Math.round(pendingMeasurement.area_sqft);
      const surf = measSurface;
      const lbl = measLabel || "Measurement";
      setPendingMeasurement(null);
      await reload();
      if (alsoQuote) {
        router.push({
          pathname: "/quote/new",
          params: {
            meas_label: lbl,
            meas_sqft: String(sqft),
            meas_surface: surf,
          },
        });
      }
    } catch (e: any) { Alert.alert("Save failed", e?.response?.data?.detail || "Try again"); }
  };

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(search)}`,
        { headers: { "User-Agent": "PowerWashCRM/1.0" } });
      const arr = await r.json();
      if (arr && arr[0]) {
        const lat = parseFloat(arr[0].lat); const lon = parseFloat(arr[0].lon);
        inject(`window.__flyTo && window.__flyTo(${lat}, ${lon}, 18); true;`);
      } else {
        Alert.alert("Not found", "Try a more specific address");
      }
    } catch { Alert.alert("Search failed"); }
    finally { setSearching(false); }
  };

  const locateMe = () => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => inject(`window.__flyTo && window.__flyTo(${p.coords.latitude}, ${p.coords.longitude}, 18); true;`),
        () => Alert.alert("Couldn't get location"),
      );
    } else {
      // Native: ask the WebView to use geolocation
      inject(`navigator.geolocation && navigator.geolocation.getCurrentPosition(p => window.__flyTo(p.coords.latitude, p.coords.longitude, 18)); true;`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Map */}
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {!loading && Platform.OS !== "web" && (
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={{ html: initialHtmlRef.current }}
            onMessage={onMessage}
            style={{ flex: 1, backgroundColor: C.bg }}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
          />
        )}
        {!loading && Platform.OS === "web" && (
          <WebMap mapRef={webRef} html={initialHtmlRef.current} onMessage={onMessage} />
        )}
        {loading && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={C.brand} size="large" />
          </View>
        )}

        {/* Top: Search bar */}
        <View style={styles.topWrap} pointerEvents="box-none">
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color={C.brand} />
            <TextInput
              testID="map-search"
              style={styles.searchInput}
              placeholder="Search places, addresses..."
              placeholderTextColor={C.textMuted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={doSearch}
              returnKeyType="search"
            />
            {searching ? <ActivityIndicator size="small" color={C.brand} /> : null}
          </View>

          {/* Drop-pen pill — selects the status for the NEXT pin you tap on the map.
              All previously placed pins always remain visible. */}
          <View style={styles.iconPill}>
            <FilterIcon active={dropMode === "customer"} color={C.pins.customer} glyph="✓" onPress={() => setDropMode("customer")} testID="f-customer" />
            <FilterIcon active={dropMode === "not_interested"} color={C.pins.not_interested} glyph="✕" onPress={() => setDropMode("not_interested")} testID="f-not-interested" />
            <FilterIcon active={dropMode === "interested"} color={C.pins.interested} glyph="★" onPress={() => setDropMode("interested")} testID="f-interested" />
            <FilterIcon active={dropMode === "no_answer"} color={C.pins.no_answer} glyph="?" onPress={() => setDropMode("no_answer")} testID="f-no-answer" />
            <FilterIcon active={dropMode === "not_knocked"} color={C.pins.not_knocked} glyph="○" onPress={() => setDropMode("not_knocked")} testID="f-not-knocked" />
            <TouchableOpacity testID="locate-me" style={styles.iconBtn} onPress={locateMe}>
              <Feather name="crosshair" size={18} color={C.brand} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Measure overlay (when actively measuring) */}
        {measuring && (
          <View style={styles.measureBar}>
            <Text style={styles.measureText}>{measureInfo || "Tap on the map to add points"}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={undoMeasure} style={styles.measBtn}><Feather name="rotate-ccw" size={16} color="#fff" /></TouchableOpacity>
              <TouchableOpacity onPress={finishMeasure} style={[styles.measBtn, { backgroundColor: C.brand }]}><Feather name="check" size={16} color="#fff" /></TouchableOpacity>
              <TouchableOpacity onPress={cancelMeasure} style={[styles.measBtn, { backgroundColor: C.error }]}><Feather name="x" size={16} color="#fff" /></TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom action bar */}
        {!measuring && (
          <View style={styles.bottomBar}>
            <TouchableOpacity testID="start-measure" style={styles.measureFab} onPress={startMeasure}>
              <Feather name="maximize" size={18} color="#fff" />
              <Text style={styles.measureFabText}>Measure Area</Text>
            </TouchableOpacity>
            <View style={styles.savedPill}>
              <Feather name="map-pin" size={13} color={C.brand} />
              <Text style={styles.savedTxt}>{houses.length} pins · {measurements.length} measured</Text>
            </View>
          </View>
        )}
      </View>

      {/* Pin bottom sheet */}
      <Modal visible={!!sheet} animationType="slide" transparent onRequestClose={() => setSheet(null)}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setSheet(null)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={common.h3}>{sheet?.house ? "Edit Pin" : "Mark House"}</Text>

            <Text style={[common.label, { marginTop: 12 }]}>Address</Text>
            <TextInput testID="house-address" style={[common.input, { marginBottom: S.md }]}
              placeholder="123 Main St, Dallas TX" placeholderTextColor={C.textMuted}
              value={address} onChangeText={setAddress} />

            <Text style={common.label}>Status</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: S.md }}>
              {STATUSES.map(s => (
                <TouchableOpacity key={s} testID={`status-${s}`} onPress={() => setStatus(s)}
                  style={[styles.statusChip, { borderColor: C.pins[s] }, status === s && { backgroundColor: C.pins[s] }]}>
                  <Text style={{ color: status === s ? "#000" : C.pins[s], fontWeight: "800", fontSize: 12 }}>
                    {statusLabel[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={common.label}>Notes</Text>
            <TextInput testID="house-notes" style={[common.input, { height: 70, textAlignVertical: "top", paddingTop: 10, marginBottom: S.md }]}
              multiline placeholder="Anything useful..." placeholderTextColor={C.textMuted}
              value={notes} onChangeText={setNotes} />

            <TouchableOpacity testID="save-house" style={common.btnPrimary} onPress={saveHouse} disabled={savingBusy}>
              {savingBusy ? <ActivityIndicator color="#fff" /> : <Text style={common.btnPrimaryText}>Save</Text>}
            </TouchableOpacity>

            {sheet?.house && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {(status === "interested" || status === "customer") && (
                  <TouchableOpacity style={[common.btnSecondary, { flex: 1, backgroundColor: C.success + "30" }]} onPress={convertHouse}>
                    <Text style={[common.btnSecondaryText, { color: C.success }]}>Convert to Customer</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[common.btnSecondary, { flex: 1, backgroundColor: C.error + "20" }]} onPress={delHouse}>
                  <Text style={[common.btnSecondaryText, { color: C.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity onPress={() => setSheet(null)} style={{ marginTop: 14, alignItems: "center" }}>
              <Text style={{ color: C.textSecondary, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Measurement save sheet */}
      <Modal visible={!!pendingMeasurement} animationType="slide" transparent onRequestClose={() => setPendingMeasurement(null)}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPendingMeasurement(null)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={common.h3}>Save measurement</Text>
            <View style={styles.measureSummary}>
              <View>
                <Text style={common.caption}>Area</Text>
                <Text style={[common.h2, { color: C.brand }]}>{Math.round(pendingMeasurement?.area_sqft || 0).toLocaleString()} sqft</Text>
              </View>
              <View>
                <Text style={common.caption}>Perimeter</Text>
                <Text style={common.h3}>{Math.round(pendingMeasurement?.perimeter_ft || 0)} ft</Text>
              </View>
            </View>

            <Text style={common.label}>Label</Text>
            <TextInput testID="meas-label" style={[common.input, { marginBottom: S.md }]}
              value={measLabel} onChangeText={setMeasLabel}
              placeholder="e.g. Front driveway" placeholderTextColor={C.textMuted} />

            <Text style={common.label}>Surface</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.md }} contentContainerStyle={{ gap: 8 }}>
              {SURFACE_TYPES.map(s => (
                <TouchableOpacity key={s} onPress={() => setMeasSurface(s)}
                  style={[styles.surfChip, measSurface === s && { backgroundColor: C.brand, borderColor: C.brand }]}>
                  <Text style={{ color: measSurface === s ? "#fff" : C.text, fontWeight: "600", textTransform: "capitalize" }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity testID="save-measurement" style={common.btnPrimary} onPress={() => saveMeasurement(false)}>
              <Text style={common.btnPrimaryText}>Save Measurement</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="save-and-quote" style={[common.btnSecondary, { marginTop: 8, backgroundColor: C.success + "30" }]} onPress={() => saveMeasurement(true)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="file-text" size={16} color={C.success} />
                <Text style={[common.btnSecondaryText, { color: C.success }]}>Save & Create Quote</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPendingMeasurement(null)} style={{ marginTop: 14, alignItems: "center" }}>
              <Text style={{ color: C.textSecondary, fontWeight: "600" }}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FilterIcon({ active, color, glyph, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[styles.iconBtn, active && { backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 2, borderColor: color }]}>
      <Text style={{ color, fontSize: 17, fontWeight: "800" }}>{glyph}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topWrap: { position: "absolute", top: 8, left: 8, right: 8, gap: 8 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(17,22,29,0.92)", paddingHorizontal: 14, height: 44, borderRadius: 999, borderWidth: 1, borderColor: C.brand },
  searchInput: { flex: 1, color: "#fff", fontSize: 15 },
  iconPill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "center", backgroundColor: "rgba(17,22,29,0.92)", padding: 4, borderRadius: 999, borderWidth: 1, borderColor: C.borderStrong },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bottomBar: { position: "absolute", bottom: 16, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  measureFab: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.brand, paddingHorizontal: 16, height: 44, borderRadius: 999 },
  measureFabText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  savedPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(17,22,29,0.92)", paddingHorizontal: 12, height: 36, borderRadius: 999, borderWidth: 1, borderColor: C.borderStrong },
  savedTxt: { color: "#fff", fontWeight: "600", fontSize: 12 },
  measureBar: { position: "absolute", bottom: 16, left: 16, right: 16, backgroundColor: C.bg2, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: C.brand },
  measureText: { color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 },
  measBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg3, alignItems: "center", justifyContent: "center" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32, borderTopWidth: 1, borderColor: C.borderStrong },
  handle: { width: 48, height: 4, backgroundColor: C.borderStrong, borderRadius: 4, alignSelf: "center", marginBottom: 14 },
  statusChip: { borderWidth: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  surfChip: { backgroundColor: C.bg3, borderWidth: 1, borderColor: C.borderStrong, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  measureSummary: { flexDirection: "row", justifyContent: "space-between", backgroundColor: C.bg3, padding: 14, borderRadius: 12, marginVertical: 12 },
});
