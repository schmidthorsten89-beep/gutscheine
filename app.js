'use strict';

const CONFIG_KEY = 'gutscheine.config';
const DATEN_KEY = 'gutscheine.daten';
const STANDARD_ARTEN = ['Einkauf', 'Eintritt', 'Essen', 'Erlebnis'];
const BALD_TAGE = 30;

const $ = (auswahl) => document.querySelector(auswahl);
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

const zustand = {
  config: ladeJson(CONFIG_KEY) || { url: '', token: '' },
  items: ladeJson(DATEN_KEY) || [],
  tab: 'aktiv',
  ladeNummer: 0,
  bearbeiteId: null,
  einloesenId: null,
  loeschenId: null,
};

function ladeJson(schluessel) {
  try {
    return JSON.parse(localStorage.getItem(schluessel));
  } catch (fehler) {
    return null;
  }
}

function speichereJson(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch (fehler) {
    // Ohne Speicher läuft die App weiter, nur die Offline-Liste fehlt dann.
  }
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
}

function istEingerichtet() {
  return Boolean(zustand.config.url && zustand.config.token);
}

function istGueltigeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'script.google.com';
  } catch (fehler) {
    return false;
  }
}

/* ---------- Backend ---------- */

async function api(action, daten) {
  let antwort;
  try {
    // text/plain vermeidet die CORS-Vorabfrage, die Apps Script nicht beantwortet.
    antwort = await fetch(zustand.config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: zustand.config.token, action, ...daten }),
    });
  } catch (fehler) {
    throw new Error('Keine Verbindung zum Server.');
  }

  let ergebnis;
  try {
    ergebnis = await antwort.json();
  } catch (fehler) {
    throw new Error('Unerwartete Antwort vom Server. Stimmt die URL, und ist der Zugriff auf „Jeder" gestellt?');
  }
  if (!ergebnis.ok) throw new Error(ergebnis.error || 'Unbekannter Fehler.');
  uebernehme(ergebnis.items);
}

function uebernehme(items) {
  zustand.items = items;
  speichereJson(DATEN_KEY, items);
  zeichne();
}

async function neuLaden() {
  if (!istEingerichtet()) {
    zeigeStatus();
    return;
  }
  if (!navigator.onLine) {
    zeigeStatus();
    return;
  }
  const nummer = ++zustand.ladeNummer;
  $('#neu-laden').disabled = true;
  try {
    await api('list');
    if (nummer === zustand.ladeNummer) zeigeStatus();
  } catch (fehler) {
    if (nummer === zustand.ladeNummer) zeigeStatus(fehler.message);
  } finally {
    if (nummer === zustand.ladeNummer) $('#neu-laden').disabled = false;
  }
}

function zeigeStatus(meldung) {
  const feld = $('#status');
  let text = meldung || '';
  if (!text && !istEingerichtet()) text = 'Noch nicht eingerichtet. Öffne die Einstellungen oder deinen Einrichtungslink.';
  if (!text && !navigator.onLine) text = 'Offline: Du siehst den zuletzt geladenen Stand. Änderungen sind erst wieder mit Internet möglich.';
  feld.textContent = text;
  feld.hidden = !text;
  aktualisiereSchreibrechte();
}

function aktualisiereSchreibrechte() {
  const moeglich = navigator.onLine && istEingerichtet();
  document.querySelectorAll('.schreibend, #hinzufuegen, #loeschen').forEach((knopf) => {
    knopf.disabled = !moeglich;
  });
}

/* ---------- Anzeige ---------- */

function tageBis(datum) {
  const [j, m, t] = datum.split('-').map(Number);
  const heute = new Date();
  const start = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  return Math.round((new Date(j, m - 1, t) - start) / 86400000);
}

function datumAnzeige(datum) {
  const [j, m, t] = datum.split('-');
  return `${t}.${m}.${j}`;
}

function ablaufMarke(item) {
  if (!item.ablauf) return '';
  const datum = datumAnzeige(item.ablauf);
  if (item.eingeloest) return `<span>bis ${datum}</span>`;
  const tage = tageBis(item.ablauf);
  if (tage < 0) return `<span class="marke abgelaufen">Abgelaufen am ${datum}</span>`;
  if (tage === 0) return `<span class="marke bald">Läuft heute ab</span>`;
  if (tage <= BALD_TAGE) return `<span class="marke bald">Noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'} (${datum})</span>`;
  return `<span>bis ${datum}</span>`;
}

function betragHtml(item) {
  if (item.wert === '') return '';
  const rest = euro.format(Number(item.restwert));
  const wert = euro.format(Number(item.wert));
  const von = item.restwert === item.wert ? '' : ` <span class="karte-von">von ${wert}</span>`;
  return `<span class="karte-betrag">${rest}${von}</span>`;
}

function karteHtml(item) {
  const einloesen = item.eingeloest ? '' : `<button class="schreibend" type="button" data-aktion="einloesen" data-id="${esc(item.id)}">Einlösen</button>`;
  const notiz = item.notiz ? `<p class="karte-notiz">${esc(item.notiz)}</p>` : '';
  return `<article class="karte">
    <div class="karte-kopf"><h3 class="karte-name">${esc(item.geschaeft)}</h3>${betragHtml(item)}</div>
    <p class="karte-info"><span class="marke">${esc(item.art)}</span>${ablaufMarke(item)}</p>
    ${notiz}
    <div class="karte-knoepfe">
      <button type="button" data-aktion="bearbeiten" data-id="${esc(item.id)}">Bearbeiten</button>
      ${einloesen}
    </div>
  </article>`;
}

function vergleicheAblauf(a, b) {
  if (a.ablauf && b.ablauf && a.ablauf !== b.ablauf) return a.ablauf < b.ablauf ? -1 : 1;
  if (a.ablauf && !b.ablauf) return -1;
  if (!a.ablauf && b.ablauf) return 1;
  return a.geschaeft.localeCompare(b.geschaeft, 'de');
}

function einzigartig(werte) {
  return [...new Set(werte.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
}

function fuelleFilter(auswahl, werte, alleText) {
  const feld = $(auswahl);
  const vorher = feld.value;
  feld.innerHTML = `<option value="">${alleText}</option>` + werte.map((w) => `<option value="${esc(w)}">${esc(w)}</option>`).join('');
  feld.value = werte.includes(vorher) ? vorher : '';
}

function fuelleVorschlaege() {
  const geschaefte = einzigartig(zustand.items.map((i) => i.geschaeft));
  const arten = einzigartig([...STANDARD_ARTEN, ...zustand.items.map((i) => i.art)]);
  $('#vorschlag-geschaeft').innerHTML = geschaefte.map((w) => `<option value="${esc(w)}">`).join('');
  $('#vorschlag-art').innerHTML = arten.map((w) => `<option value="${esc(w)}">`).join('');
  fuelleFilter('#filter-geschaeft', geschaefte, 'Alle');
  fuelleFilter('#filter-art', einzigartig(zustand.items.map((i) => i.art)), 'Alle');
}

function gefilterteItems() {
  const eingeloest = zustand.tab === 'eingeloest';
  const geschaeft = $('#filter-geschaeft').value;
  const art = $('#filter-art').value;
  const suche = $('#suche').value.trim().toLocaleLowerCase('de');
  return zustand.items.filter((i) => i.eingeloest === eingeloest
    && (!geschaeft || i.geschaeft === geschaeft)
    && (!art || i.art === art)
    && (!suche || `${i.geschaeft} ${i.art} ${i.notiz}`.toLocaleLowerCase('de').includes(suche)))
    .sort(vergleicheAblauf);
}

function zeichne() {
  fuelleVorschlaege();
  const items = gefilterteItems();
  const gruppierung = $('#gruppierung').value;

  const anzahl = `${items.length} ${items.length === 1 ? 'Gutschein' : 'Gutscheine'}`;
  const summe = items.reduce((s, i) => s + (i.restwert === '' ? 0 : Number(i.restwert)), 0);
  $('#summe').textContent = zustand.tab === 'aktiv' ? `${anzahl} · ${euro.format(summe)} Restguthaben` : anzahl;

  const liste = $('#liste');
  if (!items.length) {
    const leerText = zustand.items.length ? 'Keine passenden Gutscheine.' : 'Noch keine Gutscheine. Tippe auf +, um den ersten zu erfassen.';
    liste.innerHTML = `<p class="leer">${leerText}</p>`;
  } else if (gruppierung) {
    const namen = einzigartig(items.map((i) => i[gruppierung]));
    liste.innerHTML = namen.map((name) => {
      const inGruppe = items.filter((i) => i[gruppierung] === name);
      return `<h2 class="gruppe">${esc(name)} (${inGruppe.length})</h2>${inGruppe.map(karteHtml).join('')}`;
    }).join('');
  } else {
    liste.innerHTML = items.map(karteHtml).join('');
  }
  aktualisiereSchreibrechte();
}

/* ---------- Dialoge ---------- */

function zeigeFehler(form, meldung) {
  const feld = form.querySelector('.fehler');
  feld.textContent = meldung || '';
  feld.hidden = !meldung;
}

function liesBetrag(text) {
  const bereinigt = String(text).trim().replace(/\s|€/g, '').replace(',', '.');
  if (!bereinigt) return '';
  return /^\d+(\.\d{1,2})?$/.test(bereinigt) ? Number(bereinigt) : NaN;
}

// Sperrt die Schaltflächen während des Schreibens, damit nichts doppelt gesendet wird.
async function schreibe(form, aufruf) {
  const knoepfe = [...form.querySelectorAll('button')];
  knoepfe.forEach((k) => { k.disabled = true; });
  zeigeFehler(form);
  try {
    await aufruf();
    form.closest('dialog').close();
  } catch (fehler) {
    zeigeFehler(form, fehler.message);
  } finally {
    knoepfe.forEach((k) => { k.disabled = false; });
    aktualisiereSchreibrechte();
  }
}

function oeffneGutschein(item) {
  const form = $('#form-gutschein');
  form.reset();
  zeigeFehler(form);
  zustand.bearbeiteId = item ? item.id : null;
  $('#form-titel').textContent = item ? 'Gutschein bearbeiten' : 'Neuer Gutschein';
  $('#loeschen').hidden = !item;
  $('#feld-eingeloest').hidden = !item;
  if (item) {
    ['geschaeft', 'art', 'ablauf', 'notiz'].forEach((f) => { form.elements[f].value = item[f]; });
    ['wert', 'restwert'].forEach((f) => { form.elements[f].value = String(item[f]).replace('.', ','); });
    form.elements.eingeloest.checked = item.eingeloest;
  }
  $('#dlg-gutschein').showModal();
}

function oeffneEinloesen(item) {
  const form = $('#form-einloesen');
  form.reset();
  zeigeFehler(form);
  zustand.einloesenId = item.id;
  const hatGuthaben = item.wert !== '';
  $('#einloesen-info').textContent = hatGuthaben
    ? `${item.geschaeft}: noch ${euro.format(Number(item.restwert))}`
    : item.geschaeft;
  $('#feld-betrag').hidden = !hatGuthaben;
  $('#betrag-abziehen').hidden = !hatGuthaben;
  $('#dlg-einloesen').showModal();
}

function oeffneEinstellungen() {
  const form = $('#form-einstellungen');
  zeigeFehler(form);
  form.elements.url.value = zustand.config.url;
  form.elements.token.value = zustand.config.token;
  $('#link-ausgabe').hidden = true;
  $('#link-kopieren').disabled = !istEingerichtet();
  $('#dlg-einstellungen').showModal();
}

function einrichtungslink() {
  const daten = btoa(JSON.stringify({ url: zustand.config.url, token: zustand.config.token }));
  return `${location.origin}${location.pathname}#setup=${encodeURIComponent(daten)}`;
}

// Liest den Einrichtungslink und entfernt ihn sofort wieder aus der Adresszeile.
function pruefeEinrichtungslink() {
  const treffer = /^#setup=(.+)$/.exec(location.hash);
  if (!treffer) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const { url, token } = JSON.parse(atob(decodeURIComponent(treffer[1])));
    if (!istGueltigeUrl(url) || !token) throw new Error('ungültig');
    zustand.config = { url, token };
    speichereJson(CONFIG_KEY, zustand.config);
  } catch (fehler) {
    zeigeStatus('Der Einrichtungslink ist ungültig.');
  }
}

/* ---------- Ereignisse ---------- */

$('#form-gutschein').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const f = form.elements;
  const wert = liesBetrag(f.wert.value);
  const restwert = liesBetrag(f.restwert.value);
  if (!f.geschaeft.value.trim() || !f.art.value.trim()) return zeigeFehler(form, 'Bitte Geschäft und Art angeben.');
  if (Number.isNaN(wert) || Number.isNaN(restwert)) return zeigeFehler(form, 'Bitte Beträge als Zahl angeben, z. B. 12,50.');
  if (wert === '' && restwert !== '') return zeigeFehler(form, 'Bitte auch den Wert angeben.');
  if (wert !== '' && restwert !== '' && restwert > wert) return zeigeFehler(form, 'Das Restguthaben darf nicht höher sein als der Wert.');

  const item = {
    id: zustand.bearbeiteId,
    geschaeft: f.geschaeft.value,
    art: f.art.value,
    wert,
    restwert,
    ablauf: f.ablauf.value,
    notiz: f.notiz.value,
    eingeloest: f.eingeloest.checked,
  };
  schreibe(form, () => api('save', { item }));
});

$('#form-einloesen').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const betrag = liesBetrag(form.elements.betrag.value);
  if (betrag === '' || Number.isNaN(betrag) || betrag <= 0) return zeigeFehler(form, 'Bitte einen Betrag angeben, z. B. 12,50.');
  schreibe(form, () => api('redeem', { id: zustand.einloesenId, betrag }));
});

$('#ganz-einloesen').addEventListener('click', () => {
  schreibe($('#form-einloesen'), () => api('redeem', { id: zustand.einloesenId, ganz: true }));
});

$('#loeschen').addEventListener('click', () => {
  const item = zustand.items.find((i) => i.id === zustand.bearbeiteId);
  if (!item) return;
  zustand.loeschenId = item.id;
  $('#loeschen-info').textContent = `${item.geschaeft} (${item.art}) wird für euch beide endgültig gelöscht.`;
  zeigeFehler($('#form-loeschen'));
  $('#dlg-gutschein').close();
  $('#dlg-loeschen').showModal();
});

$('#form-loeschen').addEventListener('submit', (e) => {
  e.preventDefault();
  schreibe(e.target, () => api('delete', { id: zustand.loeschenId }));
});

$('#form-einstellungen').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const url = form.elements.url.value.trim();
  const token = form.elements.token.value.trim();
  if (!istGueltigeUrl(url)) return zeigeFehler(form, 'Die URL muss mit https://script.google.com/ beginnen.');
  if (!token) return zeigeFehler(form, 'Bitte den Token eintragen.');
  zustand.config = { url, token };
  speichereJson(CONFIG_KEY, zustand.config);
  form.closest('dialog').close();
  neuLaden();
});

$('#link-kopieren').addEventListener('click', async () => {
  const link = einrichtungslink();
  const ausgabe = $('#link-ausgabe');
  try {
    await navigator.clipboard.writeText(link);
    $('#link-kopieren').textContent = 'Link kopiert ✓';
  } catch (fehler) {
    ausgabe.value = link;
    ausgabe.hidden = false;
    ausgabe.select();
  }
});

$('#liste').addEventListener('click', (e) => {
  const knopf = e.target.closest('[data-aktion]');
  if (!knopf) return;
  const item = zustand.items.find((i) => i.id === knopf.dataset.id);
  if (!item) return;
  if (knopf.dataset.aktion === 'bearbeiten') oeffneGutschein(item);
  if (knopf.dataset.aktion === 'einloesen') oeffneEinloesen(item);
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    zustand.tab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('aktiv', t === tab));
    zeichne();
  });
});

document.querySelectorAll('[data-schliessen]').forEach((knopf) => {
  knopf.addEventListener('click', () => knopf.closest('dialog').close());
});

['#suche', '#filter-geschaeft', '#filter-art', '#gruppierung'].forEach((auswahl) => {
  $(auswahl).addEventListener('input', zeichne);
});

$('#hinzufuegen').addEventListener('click', () => oeffneGutschein(null));
$('#einstellungen').addEventListener('click', oeffneEinstellungen);
$('#neu-laden').addEventListener('click', neuLaden);

window.addEventListener('online', neuLaden);
window.addEventListener('offline', () => zeigeStatus());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') neuLaden();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

pruefeEinrichtungslink();
zeichne();
neuLaden();
