"use client";

// Delivery address picker (OpenStreetMap + Leaflet, no API key needed) and
// the "Sorry, we are not currently delivering near your location" popup.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { STORE } from "@/data/config";
import { inServiceArea, inServiceBox } from "@/lib/area";
import type { Address } from "@/lib/types";
import { useShop } from "./ShopProvider";

interface Place { display_name: string; lat: string; lon: string }

export default function AddressDialog() {
  const { addressOpen } = useShop();
  // Mounted only while open, so every visit starts fresh.
  return addressOpen ? <AddressPicker /> : null;
}

function AddressPicker() {
  const { closeAddress, address, setAddress, toast } = useShop();
  const dlgRef = useRef<HTMLDialogElement>(null);
  const areaRef = useRef<HTMLDialogElement>(null);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const revSeq = useRef(0);
  const revTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchAbort = useRef<AbortController | null>(null);

  const [picked, setPicked] = useState<Address | null>(address);
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");
  // Search results for the text they belong to (ignored once the text changes).
  const [results, setResults] = useState<{ q: string; list: Place[]; msg: string } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  // Without a map, the typed text is the address.
  const typed = query.trim();
  const pending: Address | null = mapFailed
    ? (typed.length > 8 ? { text: typed, lat: null, lng: null, ok: inServiceArea(null, typed) } : null)
    : picked;

  const notDelivering = useCallback(() => {
    if (areaRef.current && !areaRef.current.open) areaRef.current.showModal();
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const seq = ++revSeq.current;
    setFinding(true);
    let p: Address;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`, {
        headers: { "Accept-Language": "en" }
      });
      const j = await r.json();
      p = { text: j.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, ok: inServiceArea(j.address || {}, "") };
    } catch {
      p = { text: `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng, ok: inServiceBox(lat, lng) };
    }
    if (seq !== revSeq.current) return; // a newer map move has started
    setFinding(false);
    setPicked(p);
    if (!p.ok) notDelivering();
  }, [notDelivering]);

  // Show the dialog and set up the map (removed again when the dialog closes).
  useEffect(() => {
    const dlg = dlgRef.current;
    if (dlg && !dlg.open) dlg.showModal();
    const start: [number, number] = address && address.ok && address.lat != null && address.lng != null
      ? [address.lat, address.lng] : [STORE.shop.lat, STORE.shop.lng];
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !mapDiv.current) return;
        const map = L.map(mapDiv.current, { zoomControl: true, attributionControl: true }).setView(start, 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
        map.on("moveend", () => {
          clearTimeout(revTimer.current);
          const c = map.getCenter();
          revTimer.current = setTimeout(() => reverseGeocode(c.lat, c.lng), 450);
        });
        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 60);
      } catch {
        // Map library couldn't load: let people type the address instead.
        if (!cancelled) setMapFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(revTimer.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Address search, once typing pauses.
  useEffect(() => {
    const q = query.trim();
    if (mapFailed || q.length < 3) return;
    const t = setTimeout(async () => {
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=in&q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal, headers: { "Accept-Language": "en" }
        });
        const list: Place[] = await r.json();
        setResults({ q, list, msg: list.length ? "" : "No places found. Try a nearby landmark, then move the map." });
        setListOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults({ q, list: [], msg: "Search unavailable — move the map to your location." });
          setListOpen(true);
        }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, mapFailed]);

  const choose = (p: Place) => {
    setListOpen(false);
    setQuery(p.display_name);
    mapRef.current?.setView([Number(p.lat), Number(p.lon)], 17);
  };

  const locate = () => {
    if (!navigator.geolocation || !mapRef.current) return toast("Location isn't available on this device");
    toast("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 18),
      () => toast("Couldn't get your location. Please search instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const confirm = () => {
    if (!pending) return;
    if (!pending.ok) return notDelivering();
    setAddress(pending);
    closeAddress(true);
  };

  const current = results && results.q === typed && typed.length >= 3 ? results : null;
  const showList = listOpen && !!current && (current.list.length > 0 || !!current.msg);

  return (
    <>
      <dialog
        id="addressDialog"
        className="modal full"
        ref={dlgRef}
        onClose={() => closeAddress(false)}
        onClick={(e) => { if (!(e.target as HTMLElement).closest(".addr-search")) setListOpen(false); }}
      >
        <div className="modal-head">
          <h2>Delivery Address Details</h2>
          <button className="icon-btn dark" aria-label="Close" onClick={() => closeAddress(false)}>✕</button>
        </div>
        <p className="modal-sub" id="addrHint">Please enter the exact drop location for a hassle-free delivery experience.</p>
        <div className="addr-search">
          <input id="addrInput" type="search" placeholder="Search for a building, street name, or area" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="locate" id="locateBtn" type="button" title="Use my current location" aria-label="Use my current location" onClick={locate}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 3h-2.1A7 7 0 0 0 13 5.1V3h-2v2.1A7 7 0 0 0 5.1 11H3v2h2.1a7 7 0 0 0 5.9 5.9V21h2v-2.1a7 7 0 0 0 5.9-5.9H21v-2Zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" /></svg>
          </button>
          {showList ? (
            <ul className="suggestions" id="addrSuggestions">
              {current!.list.map((p, i) => {
                const [head, ...rest] = p.display_name.split(", ");
                return <li key={i} data-i={i} onClick={() => choose(p)}><b>{head}</b> {rest.join(", ")}</li>;
              })}
              {current!.msg ? <li className="muted">{current!.msg}</li> : null}
            </ul>
          ) : null}
        </div>
        <div className="map-wrap">
          {mapFailed ? (
            <p className="empty">Map unavailable. Type your full address above and press Continue.</p>
          ) : (
            <>
              <div id="map" ref={mapDiv} />
              <div className="map-pin" aria-hidden="true">
                <div className="pin-tip"><b>Your order will be delivered here</b><span>Move the map to set your exact location</span></div>
                <svg viewBox="0 0 24 24" width="36" height="36"><path fill="#d62828" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" /></svg>
              </div>
            </>
          )}
        </div>
        <div className="modal-foot">
          <p className="picked" id="addrPicked">
            {finding ? "Finding address…" : !pending ? "" : pending.ok ? `📍 ${pending.text}` : (
              <span style={{ color: "var(--danger)" }}>📍 {pending.text}<br />We only deliver across Delhi NCR &amp; Gurgaon.</span>
            )}
          </p>
          <button className={`btn primary block${pending && pending.ok && !finding ? " ok" : ""}`} id="addrContinue" disabled={!pending || finding} onClick={confirm}>Continue</button>
        </div>
      </dialog>

      <dialog id="areaDialog" className="modal popup" aria-labelledby="areaTitle" ref={areaRef}>
        <div className="popup-icon" aria-hidden="true">📍</div>
        <h2 id="areaTitle">Sorry!</h2>
        <p>Sorry, we are not currently delivering near your location.</p>
        <p className="muted-sm">We deliver across Delhi NCR and Gurgaon. Please choose another address.</p>
        <button className="btn primary block" autoFocus onClick={() => areaRef.current?.close()}>Choose another address</button>
      </dialog>
    </>
  );
}
