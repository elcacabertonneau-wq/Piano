/* Zik — lecteur de musique perso : playlists importées de Spotify, lecture via le lecteur YouTube officiel. */
'use strict';
(() => {
  const VERSION = '1.0';
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nativeBridge = (() => { try { return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.zik; } catch (e) { return null; } })();
  const sendNative = (msg) => { try { nativeBridge && nativeBridge.postMessage(msg); } catch (e) { /* rien */ } };

  // ---------- Icônes ----------
  const S = (d, fill) => `<svg viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${d}</svg>`;
  const ic = {
    library: S('<path d="M5 4v16M10 4v16M14.5 5l5 14.5"/>'),
    search: S('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    settings: S('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    play: S('<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>', true),
    pause: S('<rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/>', true),
    next: S('<path d="M5 5.5v13a1 1 0 0 0 1.55.83L16 13v5a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v5L6.55 4.67A1 1 0 0 0 5 5.5z"/>', true),
    prev: S('<path d="M19 5.5v13a1 1 0 0 1-1.55.83L8 13v5a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5l9.45-6.33A1 1 0 0 1 19 5.5z"/>', true),
    shuffle: S('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    repeat: S('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
    repeat1: S('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/><path d="M11 10h1v5"/>'),
    heart: S('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
    heartFill: S('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>', true),
    more: S('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', true),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    back: S('<path d="M15 18l-6-6 6-6"/>'),
    down: S('<path d="M6 9l6 6 6-6"/>'),
    close: S('<path d="M18 6L6 18M6 6l12 12"/>'),
    queue: S('<path d="M3 6h13M3 12h13M3 18h9M18 14v6l4-3z"/>'),
    import: S('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
    note: S('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    edit: S('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    trash: S('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
    yt: S('<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>'),
    magic: S('<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/>'),
    list: S('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    link: S('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  };
  document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ic[el.dataset.icon] || ''; });

  // ---------- Données ----------
  const KEY = 'zik.v1';
  const blank = () => ({ playlists: [], tracks: {}, liked: [], settings: { apiKey: '', keepAwake: true }, quota: { day: '', count: 0 } });
  let db = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalizeDb(JSON.parse(raw));
    } catch (e) { /* données illisibles : on repart de zéro */ }
    return blank();
  }
  function normalizeDb(d) {
    const b = blank();
    if (!d || typeof d !== 'object') return b;
    return {
      playlists: Array.isArray(d.playlists) ? d.playlists.filter((p) => p && p.id && Array.isArray(p.tracks)) : [],
      tracks: d.tracks && typeof d.tracks === 'object' ? d.tracks : {},
      liked: Array.isArray(d.liked) ? d.liked : [],
      settings: Object.assign(b.settings, d.settings || {}),
      quota: Object.assign(b.quota, d.quota || {}),
    };
  }
  let saveTimer = 0;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 200); }
  function saveNow() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast("Impossible d'enregistrer : stockage plein ?"); }
  }
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function hash(str) { let h = 5381, h2 = 52711; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h = (h * 33) ^ c; h2 = (h2 * 31) ^ c; } return (h >>> 0).toString(36) + (h2 >>> 0).toString(36); }
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function upsertTrack({ title, artist, album, durationMs, videoId, videoTitle }) {
    title = String(title || '').trim();
    artist = String(artist || '').trim();
    if (!title) return null;
    const id = 't' + hash(norm(artist) + '|' + norm(title));
    let t = db.tracks[id];
    if (!t) t = db.tracks[id] = { id, title, artist, album: album || '', durationMs: durationMs || 0, videoId: null, status: 'pending' };
    else {
      if (!t.album && album) t.album = album;
      if (!t.durationMs && durationMs) t.durationMs = durationMs;
    }
    if (videoId && !t.videoId) { t.videoId = videoId; t.videoTitle = videoTitle || ''; t.status = 'manual'; }
    return id;
  }
  const LIKED = 'liked';
  function getPlaylist(id) {
    if (id === LIKED) return { id: LIKED, name: 'Titres likés', tracks: db.liked, special: true };
    return db.playlists.find((p) => p.id === id) || null;
  }
  function createPlaylist(name, trackIds = [], source = '') {
    const pl = { id: uid('p'), name: name || 'Nouvelle playlist', tracks: [], source, createdAt: Date.now() };
    const seen = new Set();
    for (const id of trackIds) if (id && !seen.has(id)) { seen.add(id); pl.tracks.push(id); }
    db.playlists.push(pl);
    save();
    return pl;
  }
  const isLiked = (id) => db.liked.includes(id);
  function toggleLike(id) {
    if (!id) return;
    const i = db.liked.indexOf(id);
    if (i >= 0) { db.liked.splice(i, 1); toast('Retiré des titres likés'); }
    else { db.liked.unshift(id); toast('Ajouté aux titres likés'); }
    save(); updatePlayerUI(); refreshView();
  }

  // ---------- UI de base ----------
  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function openSheet(title, html) {
    $('#sheet-title').textContent = title;
    $('#sheet-body').innerHTML = html;
    $('#sheet').scrollTop = 0;
    document.body.classList.add('sheet-open');
  }
  function closeSheet() { document.body.classList.remove('sheet-open'); }
  function hue(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  function coverHtml(pl, cls = '') {
    if (pl.id === LIKED) return `<div class="cover ${cls}" style="background:var(--grad)">${ic.heartFill}</div>`;
    const h = hue(pl.name);
    const letter = (pl.name.trim()[0] || '♪').toUpperCase();
    return `<div class="cover ${cls}" style="background:linear-gradient(135deg,hsl(${h} 70% 52%),hsl(${(h + 50) % 360} 65% 32%))">${esc(letter)}</div>`;
  }
  function setAppHeight() { document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px'); }
  window.addEventListener('resize', setAppHeight);
  setAppHeight();
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

  // ---------- Navigation ----------
  let route = { name: 'library' };
  const ui = { filter: '', searchQ: '', ytResults: null, ytQuery: '' };
  function go(r) {
    route = r; ui.filter = '';
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    const tab = route.name === 'playlist' ? 'library' : route.name;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (route.name === 'library') renderLibrary();
    else if (route.name === 'playlist') renderPlaylist();
    else if (route.name === 'search') renderSearch();
    else if (route.name === 'settings') renderSettings();
  }
  function refreshView() {
    if (route.name === 'playlist') { updatePlaylistHead(); renderTrackList(); }
    else if (route.name === 'search') renderSearchResults();
    else if (route.name === 'library' || route.name === 'settings') { const y = window.scrollY; render(); window.scrollTo(0, y); }
  }

  // ---------- Bibliothèque ----------
  function renderLibrary() {
    const pls = db.playlists;
    const row = (pl) => {
      const n = pl.tracks.length;
      return `<li data-action="open-playlist" data-id="${esc(pl.id)}">${coverHtml(pl)}
        <div class="li-main"><div class="li-title">${esc(pl.name)}</div><div class="li-sub">Playlist · ${plural(n, 'titre')}</div></div></li>`;
    };
    view.innerHTML = `
      <div class="page-head"><h1>Bibliothèque</h1>
        <button class="icon-btn" data-action="new-playlist" aria-label="Nouvelle playlist">${ic.plus}</button></div>
      <button class="import-card" data-action="open-import">${ic.import}
        <div><b>Importer mes playlists Spotify</b><span>Fichiers CSV (Exportify, TuneMyMusic…) ou liste de titres collée</span></div></button>
      <ul class="list">
        ${row(getPlaylist(LIKED))}
        ${pls.map(row).join('')}
      </ul>
      ${pls.length ? '' : `<div class="empty"><b>Aucune playlist pour l'instant</b>Importe tes playlists Spotify avec le bouton ci-dessus, ou cherche un titre dans l'onglet Rechercher.</div>`}`;
  }

  // ---------- Playlist ----------
  function renderPlaylist() {
    const pl = getPlaylist(route.id);
    if (!pl) { go({ name: 'library' }); return; }
    view.innerHTML = `
      <div class="page-head"><button class="icon-btn back" data-action="tab" data-tab="library" aria-label="Retour">${ic.back}</button><div style="flex:1"></div>
        <button class="icon-btn" data-action="playlist-menu" aria-label="Options">${ic.more}</button></div>
      <div class="pl-head">${coverHtml(pl, 'xl')}<h1>${esc(pl.name)}</h1><div class="muted" id="pl-meta"></div></div>
      <div class="pl-actions">
        <button class="btn" data-action="shuffle-playlist">${ic.shuffle}Aléatoire</button>
        <button class="btn primary" data-action="play-playlist">${ic.play}Lecture</button>
      </div>
      ${pl.tracks.length > 12 ? `<input class="filter" type="search" id="pl-filter" placeholder="Filtrer dans la playlist" autocomplete="off">` : ''}
      <ul class="list" id="tracklist"></ul>`;
    const f = $('#pl-filter');
    if (f) f.addEventListener('input', () => { ui.filter = f.value; renderTrackList(); });
    updatePlaylistHead();
    renderTrackList();
  }
  function updatePlaylistHead() {
    const pl = getPlaylist(route.id); const el = $('#pl-meta');
    if (!pl || !el) return;
    const tracks = pl.tracks.map((id) => db.tracks[id]).filter(Boolean);
    const ready = tracks.filter((t) => t.videoId).length;
    const nf = tracks.filter((t) => !t.videoId && t.status === 'notfound').length;
    el.textContent = `${plural(tracks.length, 'titre')} · ${ready} prêt${ready > 1 ? 's' : ''}${nf ? ` · ${nf} introuvable${nf > 1 ? 's' : ''}` : ''}`;
  }
  function trackRow(t, attrs, extra = '') {
    const status = t.videoId ? 'ok' : t.status === 'notfound' ? 'notfound' : 'pending';
    const playing = P.current === t.id ? ' playing' : '';
    return `<li class="track${playing}" ${attrs}>
      <div class="li-main"><div class="li-title">${esc(t.title)}</div>
      <div class="li-sub"><span class="dot ${status}"></span>${extra}${esc(t.artist || 'Artiste inconnu')}</div></div>
      <button class="icon-btn small" data-action="track-menu" data-id="${esc(t.id)}" aria-label="Options">${ic.more}</button></li>`;
  }
  function renderTrackList() {
    const pl = getPlaylist(route.id); const ul = $('#tracklist');
    if (!pl || !ul) return;
    const q = norm(ui.filter);
    const rows = [];
    pl.tracks.forEach((id, i) => {
      const t = db.tracks[id]; if (!t) return;
      if (q && !norm(t.title + ' ' + t.artist + ' ' + t.album).includes(q)) return;
      rows.push(trackRow(t, `data-action="play-from" data-index="${i}"`));
    });
    ul.innerHTML = rows.join('') || `<div class="empty">${pl.tracks.length ? 'Aucun résultat.' : pl.id === LIKED ? 'Appuie sur ♡ pendant la lecture pour ajouter des titres ici.' : 'Playlist vide. Ajoute des titres depuis Rechercher.'}</div>`;
  }

  // ---------- Recherche ----------
  function renderSearch() {
    view.innerHTML = `
      <div class="page-head"><h1>Rechercher</h1></div>
      <form class="searchbar" id="search-form">
        <input type="search" id="q" placeholder="Artiste, titre, album…" enterkeyhint="search" autocomplete="off" value="${esc(ui.searchQ)}">
        <button class="btn primary" type="submit" aria-label="Chercher">${ic.search}</button>
      </form>
      <div id="search-results"></div>`;
    const q = $('#q');
    q.addEventListener('input', () => { ui.searchQ = q.value; if (norm(q.value) !== norm(ui.ytQuery)) ui.ytResults = null; renderSearchResults(); });
    $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); q.blur(); searchYouTube(q.value); });
    renderSearchResults();
  }
  function renderSearchResults() {
    const box = $('#search-results'); if (!box) return;
    const q = norm(ui.searchQ);
    let html = '';
    if (q) {
      const local = Object.values(db.tracks).filter((t) => norm(t.title + ' ' + t.artist + ' ' + t.album).includes(q)).slice(0, 40);
      if (local.length) {
        html += `<div class="section-title">Dans ta bibliothèque</div><ul class="list">${local.map((t) => trackRow(t, `data-action="play-single" data-id="${esc(t.id)}"`)).join('')}</ul>`;
      }
      if (ui.ytResults) {
        html += `<div class="section-title">Sur YouTube</div>`;
        html += ui.ytResults.length ? `<ul class="list">${ui.ytResults.map((r, i) => `
          <li data-action="play-yt" data-index="${i}"><img class="thumb" src="${esc(r.thumb)}" alt="" loading="lazy">
            <div class="li-main"><div class="li-title">${esc(r.title)}</div><div class="li-sub">${esc(r.channel)}</div></div>
            <button class="icon-btn small" data-action="yt-menu" data-index="${i}" aria-label="Options">${ic.more}</button></li>`).join('')}</ul>` : `<div class="empty">Aucun résultat sur YouTube.</div>`;
      } else {
        html += `<div class="empty">Appuie sur <b style="display:inline;font-size:inherit">Entrée</b> pour chercher sur YouTube.${db.settings.apiKey ? '' : `<br><br>Il faut d'abord ajouter ta clé YouTube gratuite.<br><br><button class="btn" data-action="tab" data-tab="settings">Ouvrir les réglages</button>`}</div>`;
      }
    } else {
      html = `<div class="empty"><b>Trouve n'importe quel titre</b>Cherche dans ta bibliothèque et sur YouTube, puis ajoute le résultat à tes playlists.</div>`;
    }
    box.innerHTML = html;
  }
  async function searchYouTube(query) {
    query = String(query || '').trim(); if (!query) return;
    if (!db.settings.apiKey) { toast('Ajoute ta clé YouTube dans Réglages pour chercher sur YouTube'); return; }
    try {
      toast('Recherche…', 1200);
      ui.ytResults = await ytSearch(query, 15, false);
      ui.ytQuery = query;
      renderSearchResults();
    } catch (e) { handleApiError(e); }
  }
  function ytResultToTrack(r) {
    const parsed = splitArtistTitle(r.title);
    let artist = parsed.artist, title = parsed.title;
    if (!artist) { artist = r.channel.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim(); }
    title = title.replace(/\s*[([](official|clip|audio|video|lyrics?|paroles|visuali[sz]er|hd|4k)[^)\]]*[)\]]/ig, '').trim() || r.title;
    const id = upsertTrack({ title, artist, videoId: r.videoId, videoTitle: r.title });
    const t = db.tracks[id];
    if (t && t.videoId !== r.videoId) { t.videoId = r.videoId; t.videoTitle = r.title; t.status = 'manual'; }
    save();
    return id;
  }

  // ---------- Réglages ----------
  function renderSettings() {
    const all = Object.values(db.tracks);
    const pending = all.filter((t) => !t.videoId && t.status !== 'notfound').length;
    const nf = all.filter((t) => !t.videoId && t.status === 'notfound').length;
    const today = new Date().toISOString().slice(0, 10);
    const used = db.quota.day === today ? db.quota.count : 0;
    const key = db.settings.apiKey;
    view.innerHTML = `
      <div class="page-head"><h1>Réglages</h1></div>
      <div class="card">
        <h2>Clé YouTube (gratuite)</h2>
        <p>Elle sert à trouver automatiquement la vidéo YouTube de chaque titre importé. Sans clé, tu peux quand même coller un lien YouTube pour chaque titre.</p>
        <ol>
          <li>Ouvre <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener">la console Google Cloud</a> avec ton compte Google et crée un projet (gratuit, pas de carte bancaire).</li>
          <li>Clique sur <b>Activer</b> pour « YouTube Data API v3 ».</li>
          <li>Va dans <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Identifiants</a> → <b>Créer des identifiants</b> → <b>Clé API</b>, puis copie la clé.</li>
          <li>Colle-la ci-dessous. Si tu ajoutes une restriction, choisis seulement « YouTube Data API v3 » (pas de restriction par site).</li>
        </ol>
        <div class="row"><input type="password" id="api-key" placeholder="AIza…" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(key)}">
          <button class="btn primary" data-action="save-key">OK</button></div>
        <p class="stat" style="margin-top:10px">Recherches aujourd'hui : <b>${used}</b> / ~100 (la limite gratuite repart chaque jour à 9 h environ)</p>
      </div>
      <div class="card">
        <h2>Conversion des titres</h2>
        <p class="stat"><b>${all.length - pending - nf}</b> prêts · <b>${pending}</b> à convertir · <b>${nf}</b> introuvables</p>
        <p>Chaque titre trouvé est gardé : il n'est cherché qu'une seule fois. Les titres sont aussi convertis automatiquement au moment où tu les écoutes.</p>
        <div class="btn-row">
          <button class="btn primary" data-action="convert-all" ${pending ? '' : 'disabled'}>${ic.magic}Convertir maintenant</button>
          ${nf ? `<button class="btn" data-action="retry-notfound">Réessayer les introuvables</button>` : ''}
        </div>
      </div>
      <div class="card">
        <label class="toggle"><span>Garder l'écran allumé pendant la lecture</span><input type="checkbox" id="keep-awake" ${db.settings.keepAwake ? 'checked' : ''}></label>
        <p>La lecture YouTube s'arrête quand l'écran se verrouille : cette option évite la mise en veille tant que la musique joue.</p>
      </div>
      <div class="card">
        <h2>Sauvegarde</h2>
        <p>Tes playlists sont stockées uniquement sur ce téléphone. Fais une sauvegarde de temps en temps (fichier à garder dans Fichiers ou iCloud).</p>
        <div class="btn-row">
          <button class="btn" data-action="export">Sauvegarder</button>
          <button class="btn" data-action="restore">Restaurer</button>
          <button class="btn danger" data-action="wipe">Tout effacer</button>
        </div>
      </div>
      <p class="muted small" style="text-align:center">Zik ${VERSION} · ${plural(db.playlists.length, 'playlist')} · ${plural(all.length, 'titre')}<br>Lecture via le lecteur YouTube officiel.</p>`;
    $('#keep-awake').addEventListener('change', (e) => { db.settings.keepAwake = e.target.checked; save(); applyKeepAwake(); });
  }

  // ---------- Import ----------
  function openImport() {
    openSheet('Importer', `
      <h3>1. Depuis Spotify (fichier CSV)</h3>
      <ol>
        <li>Ouvre <a href="https://exportify.net" target="_blank" rel="noopener">exportify.net</a> et connecte ton compte Spotify.</li>
        <li>Exporte une playlist, ou « Export All » pour tout récupérer d'un coup (un .zip : touche-le dans Fichiers pour le décompresser).</li>
        <li>Reviens ici et choisis un ou plusieurs fichiers .csv. Chaque fichier devient une playlist.</li>
      </ol>
      <p>Les CSV de TuneMyMusic, Soundiiz ou d'autres outils marchent aussi.</p>
      <button class="btn primary block" data-action="pick-csv">${ic.import}Choisir des fichiers CSV</button>
      <h3>2. Ou colle une liste de titres</h3>
      <div class="field"><input type="text" id="paste-name" placeholder="Nom de la playlist"></div>
      <div class="field"><textarea id="paste-text" placeholder="Une chanson par ligne, par exemple :&#10;Daft Punk - One More Time&#10;Stromae - Alors on danse"></textarea></div>
      <button class="btn block" data-action="import-paste">Importer la liste</button>`);
  }
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const firstLine = text.slice(0, text.indexOf('\n') >>> 0);
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let inQ = false;
    for (const c of firstLine) { if (c === '"') inQ = !inQ; else if (!inQ && c in counts) counts[c]++; }
    const sep = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = []; let row = []; let field = ''; inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"') inQ = true;
      else if (c === sep) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some((v) => v.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some((v) => v.trim() !== '')) rows.push(row);
    return rows;
  }
  function splitArtistTitle(line) {
    const m = String(line).match(/^(.+?)\s+[-–—]\s+(.+)$/);
    return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: String(line).trim() };
  }
  function prettyName(filename) {
    const n = filename.replace(/\.(csv|txt)$/i, '').replace(/[_]+/g, ' ').trim();
    return n ? n[0].toUpperCase() + n.slice(1) : 'Playlist importée';
  }
  function rowsToPlaylists(rows, fallbackName) {
    if (!rows.length) return [];
    const header = rows[0].map((h) => norm(h));
    const find = (...names) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; } for (const n of names) { const i = header.findIndex((h) => h.startsWith(n)); if (i >= 0) return i; } return -1; };
    const iTitle = find('track name', 'track title', 'title', 'titre', 'song name', 'song', 'name', 'nom', 'track');
    const iArtist = find('artist name s', 'artist names', 'artist name', 'artists', 'artist', 'artiste', 'artistes');
    const iAlbum = find('album name', 'album');
    const iDur = find('duration ms', 'track duration ms', 'duration', 'duree');
    const iPl = find('playlist name', 'playlist');
    const groups = new Map();
    const add = (plName, data) => { if (!groups.has(plName)) groups.set(plName, []); groups.get(plName).push(data); };
    if (iTitle < 0) {
      // Pas d'en-tête reconnu : une chanson par ligne « Artiste - Titre »
      for (const r of rows) { const line = r.join(' ').trim(); if (line) add(fallbackName, splitArtistTitle(line)); }
    } else {
      const durInMs = iDur >= 0 && /ms/.test(header[iDur]);
      for (const r of rows.slice(1)) {
        const title = (r[iTitle] || '').trim(); if (!title) continue;
        let durationMs = 0;
        if (iDur >= 0) {
          const v = (r[iDur] || '').trim();
          if (/^\d+:\d{2}$/.test(v)) { const [m, s] = v.split(':').map(Number); durationMs = (m * 60 + s) * 1000; }
          else if (/^\d+(\.\d+)?$/.test(v)) durationMs = durInMs || Number(v) > 10000 ? Number(v) : Number(v) * 1000;
        }
        add(iPl >= 0 && r[iPl] ? r[iPl].trim() : fallbackName, {
          title, artist: iArtist >= 0 ? (r[iArtist] || '').replace(/\s*;\s*/g, ', ').trim() : '',
          album: iAlbum >= 0 ? (r[iAlbum] || '').trim() : '', durationMs,
        });
      }
    }
    return [...groups].map(([name, items]) => ({ name, items }));
  }
  function importGroups(groups) {
    let nPl = 0, nTr = 0;
    for (const g of groups) {
      const ids = g.items.map(upsertTrack).filter(Boolean);
      if (!ids.length) continue;
      const pl = createPlaylist(g.name, ids, 'import');
      nPl++; nTr += pl.tracks.length;
    }
    save();
    return { nPl, nTr };
  }
  async function importFiles(files) {
    const groups = [];
    for (const f of files) {
      try {
        const text = await f.text();
        if (/\.json$/i.test(f.name)) { restoreFromText(text); return; }
        groups.push(...rowsToPlaylists(parseCSV(text), prettyName(f.name)));
      } catch (e) { toast(`Fichier illisible : ${f.name}`); }
    }
    const { nPl, nTr } = importGroups(groups);
    closeSheet();
    if (!nPl) { toast('Aucun titre trouvé dans ces fichiers'); return; }
    toast(`${plural(nPl, 'playlist importée')} · ${plural(nTr, 'titre')}`, 3500);
    go({ name: 'library' });
    if (db.settings.apiKey) setTimeout(() => offerConvert(), 600);
  }
  function offerConvert() {
    const pending = Object.values(db.tracks).filter((t) => !t.videoId && t.status === 'pending').length;
    if (!pending) return;
    openSheet('Convertir les titres ?', `
      <p>${plural(pending, 'titre')} n'ont pas encore leur vidéo YouTube. Zik peut les chercher maintenant (environ 100 par jour avec la clé gratuite) ; sinon ils seront cherchés au moment où tu les écoutes.</p>
      <div class="btn-row"><button class="btn primary" data-action="convert-all">${ic.magic}Convertir maintenant</button><button class="btn" data-action="close-sheet">Plus tard</button></div>`);
  }

  // ---------- Sauvegarde ----------
  function exportBackup() {
    saveNow();
    const content = JSON.stringify({ app: 'zik', version: 1, exportedAt: new Date().toISOString(), data: db });
    const filename = `zik-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    if (nativeBridge) { sendNative({ type: 'share', filename, content }); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function restoreFromText(text) {
    let data;
    try { const j = JSON.parse(text); data = j && j.app === 'zik' ? j.data : j; } catch (e) { toast('Fichier de sauvegarde invalide'); return; }
    if (!data || !Array.isArray(data.playlists) || typeof data.tracks !== 'object') { toast('Fichier de sauvegarde invalide'); return; }
    if (!confirm(`Remplacer ta bibliothèque par cette sauvegarde (${plural(data.playlists.length, 'playlist')}) ?`)) return;
    const key = db.settings.apiKey;
    db = normalizeDb(data);
    if (!db.settings.apiKey) db.settings.apiKey = key;
    saveNow(); toast('Sauvegarde restaurée'); go({ name: 'library' });
  }

  // ---------- YouTube Data API ----------
  class ApiError extends Error {}
  function decodeEntities(s) { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }
  function bumpQuota() {
    const today = new Date().toISOString().slice(0, 10);
    if (db.quota.day !== today) db.quota = { day: today, count: 0 };
    db.quota.count++; save();
  }
  async function ytSearch(q, max = 5, embeddableOnly = true) {
    const key = (db.settings.apiKey || '').trim();
    if (!key) { const e = new ApiError('Pas de clé YouTube'); e.nokey = true; throw e; }
    const params = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: String(max), q, key, safeSearch: 'none' });
    if (embeddableOnly) params.set('videoEmbeddable', 'true');
    let r;
    try { r = await fetch('https://www.googleapis.com/youtube/v3/search?' + params); }
    catch (e) { const err = new ApiError('Pas de connexion internet'); err.network = true; throw err; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const reason = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || '';
      const err = new ApiError((j.error && j.error.message) || 'Erreur YouTube ' + r.status);
      if (/quota|rateLimit/i.test(reason)) err.quota = true;
      else if (r.status === 400 || r.status === 403) err.badkey = true;
      throw err;
    }
    bumpQuota();
    return (j.items || []).filter((it) => it.id && it.id.videoId).map((it) => ({
      videoId: it.id.videoId,
      title: decodeEntities(it.snippet.title || ''),
      channel: decodeEntities(it.snippet.channelTitle || ''),
      thumb: (it.snippet.thumbnails && (it.snippet.thumbnails.medium || it.snippet.thumbnails.default) || {}).url || `https://i.ytimg.com/vi/${it.id.videoId}/mqdefault.jpg`,
    }));
  }
  function handleApiError(e) {
    if (e.nokey) toast('Ajoute ta clé YouTube dans Réglages', 3500);
    else if (e.quota) toast('Limite YouTube du jour atteinte : ça repart demain. Tu peux coller un lien à la main.', 5000);
    else if (e.badkey) toast('Clé YouTube refusée : vérifie-la dans Réglages', 4500);
    else toast(e.message || 'Erreur', 3500);
  }
  function cleanTitle(t) {
    return t
      .replace(/\s*[-–]\s*(\d{4}\s+)?(digital(ly)?\s+)?remaster(ed)?(\s+\d{4})?(\s+version)?\s*$/i, '')
      .replace(/\s*[([]\s*(\d{4}\s+)?(digital(ly)?\s+)?remaster(ed)?[^)\]]*[)\]]/ig, '')
      .replace(/\s*[-–]\s*(mono|stereo|single|album)\s+(version|mix)\s*$/i, '')
      .trim();
  }
  const firstArtist = (a) => String(a || '').split(/,|&| feat\.? | ft\.? | x /i)[0].trim();
  function pickBest(results, t) {
    const bad = new Set(t.badIds || []);
    const nt = norm(cleanTitle(t.title)).replace(/\b(feat|ft)\b.*$/, '').trim();
    const na = norm(firstArtist(t.artist));
    const words = nt.split(' ').filter((w) => w.length > 1);
    const flags = ['live', 'cover', 'karaoke', 'instrumental', 'remix', 'sped up', 'slowed', 'nightcore', 'reaction', 'tutorial', 'lesson', '8d audio', 'reverb', 'extended', 'acoustic'];
    let best = null, bestScore = -Infinity;
    results.forEach((r, i) => {
      if (bad.has(r.videoId)) return;
      const title = norm(r.title), ch = norm(r.channel);
      let s = -i * 0.4;
      if (/ - topic$/i.test(r.channel)) s += 3;
      if (na && (title.includes(na) || ch.includes(na))) s += 2.5;
      if (words.length) s += 4 * words.filter((w) => title.includes(w)).length / words.length;
      if (/official (audio|video|music video)|audio officiel|clip officiel/i.test(r.title)) s += 1;
      for (const f of flags) if (title.includes(f) && !norm(t.title).includes(f)) s -= 3;
      if (s > bestScore) { bestScore = s; best = r; }
    });
    return best && bestScore > 1 ? best : null;
  }
  async function resolveTrack(t) {
    const q = `${firstArtist(t.artist)} ${cleanTitle(t.title)}`.trim();
    const results = await ytSearch(q, 6, true);
    const best = pickBest(results, t);
    if (best) { t.videoId = best.videoId; t.videoTitle = best.title; t.status = 'ok'; }
    else t.status = 'notfound';
    save();
    return t;
  }

  // ---------- Conversion en lot ----------
  const conv = { running: false, stop: false };
  function banner(html) { const b = $('#banner'); if (html) { b.innerHTML = html; b.classList.add('show'); } else b.classList.remove('show'); }
  async function convertTracks(ids) {
    if (!db.settings.apiKey) { closeSheet(); toast('Ajoute d\'abord ta clé YouTube'); go({ name: 'settings' }); return; }
    if (conv.running) { toast('Conversion déjà en cours'); return; }
    const todo = [...new Set(ids)].filter((id) => db.tracks[id] && !db.tracks[id].videoId && db.tracks[id].status !== 'notfound');
    closeSheet();
    if (!todo.length) { toast('Tout est déjà converti'); return; }
    conv.running = true; conv.stop = false;
    let done = 0, found = 0;
    const draw = () => banner(`<div class="bar">Conversion : ${done} / ${todo.length} (${found} trouvés)<div class="track-bar"><div style="width:${Math.round(done / todo.length * 100)}%"></div></div></div><button data-action="stop-convert">Arrêter</button>`);
    draw();
    try {
      for (const id of todo) {
        if (conv.stop) break;
        const t = db.tracks[id];
        if (t && !t.videoId) { await resolveTrack(t); if (t.videoId) found++; }
        done++; draw();
        if (done % 5 === 0) refreshView();
      }
      toast(conv.stop ? 'Conversion arrêtée' : `Conversion terminée : ${found} / ${todo.length} trouvés`, 3500);
    } catch (e) { handleApiError(e); }
    finally { conv.running = false; banner(''); saveNow(); refreshView(); }
  }
  const allPendingIds = () => Object.values(db.tracks).filter((t) => !t.videoId && t.status !== 'notfound').map((t) => t.id);

  // ---------- Lecteur ----------
  const P = { yt: null, ready: false, pendingVideo: null, list: [], order: [], pos: -1, shuffle: false, repeat: 'off', source: '', current: null, playing: false, token: 0, skips: 0, lastVideo: null };
  window.onYouTubeIframeAPIReady = () => {
    P.yt = new YT.Player('yt-player', {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, autoplay: 1, iv_load_policy: 3, origin: location.origin },
      events: {
        onReady: () => { P.ready = true; if (P.pendingVideo) { const v = P.pendingVideo; P.pendingVideo = null; loadVideo(v); } },
        onStateChange: onYtState,
        onError: onYtError,
      },
    });
  };
  function loadYtApi() {
    if (document.querySelector('script[data-yt]')) return;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.dataset.yt = '1';
    s.onerror = () => { s.remove(); setTimeout(loadYtApi, 5000); };
    document.head.appendChild(s);
  }
  const currentTrack = () => (P.current ? db.tracks[P.current] : null);
  function buildOrder(startIndex) {
    const n = P.list.length;
    P.order = [...Array(n).keys()];
    if (P.shuffle) {
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [P.order[i], P.order[j]] = [P.order[j], P.order[i]]; }
      if (startIndex != null && startIndex >= 0) { const k = P.order.indexOf(startIndex); [P.order[0], P.order[k]] = [P.order[k], P.order[0]]; }
      P.pos = 0;
    } else P.pos = Math.max(0, startIndex || 0);
  }
  function playList(ids, startIndex, opts = {}) {
    ids = ids.filter((id) => db.tracks[id]);
    if (!ids.length) { toast('Rien à lire'); return; }
    if (opts.shuffle != null) P.shuffle = opts.shuffle;
    P.list = ids; P.source = opts.source || '';
    buildOrder(startIndex == null ? (P.shuffle ? null : 0) : startIndex);
    P.skips = 0;
    playCurrent();
  }
  async function playCurrent() {
    const id = P.list[P.order[P.pos]];
    const t = db.tracks[id];
    if (!t) return;
    const token = ++P.token;
    P.current = id;
    document.body.classList.add('has-track');
    setStatus('');
    updatePlayerUI(); refreshView();
    if (!t.videoId) {
      if (!db.settings.apiKey) { pauseVideo(); toast('Choisis la vidéo de ce titre (ou ajoute ta clé YouTube dans Réglages)', 4000); openVideoChooser(id); return; }
      setStatus('Recherche…');
      try { await resolveTrack(t); }
      catch (e) { setStatus(''); handleApiError(e); if (e.quota) { pauseVideo(); openVideoChooser(id); } return; }
      if (token !== P.token) return;
      setStatus('');
      refreshView();
      if (!t.videoId) {
        toast(`Introuvable sur YouTube : ${t.title}`);
        if (++P.skips < 8) next(true); else pauseVideo();
        return;
      }
    }
    loadVideo(t.videoId);
    setMediaSession(t);
  }
  function loadVideo(videoId) {
    P.lastVideo = videoId;
    if (!P.ready) { P.pendingVideo = videoId; loadYtApi(); return; }
    try { P.yt.loadVideoById(videoId); } catch (e) { P.pendingVideo = videoId; }
  }
  function pauseVideo() { try { P.ready && P.yt.pauseVideo(); } catch (e) { /* rien */ } }
  function onYtState(e) {
    const st = e.data;
    if (st === 1) { P.playing = true; P.skips = 0; setStatus(''); }
    else if (st === 2 || st === 0 || st === -1 || st === 5) P.playing = false;
    if (st === 3) setStatus('Chargement…'); else if (st === 1) setStatus('');
    updatePlayButtons(); applyKeepAwake();
    if (st === 0) next(true);
  }
  function onYtError(e) {
    const t = currentTrack();
    if (!t) return;
    const code = e && e.data;
    if (code === 2 && !t.videoId) return;
    if (t.videoId) { t.badIds = [...new Set([...(t.badIds || []), t.videoId])]; }
    t.videoId = null; t.status = 'pending'; save();
    if (db.settings.apiKey && (t.badIds || []).length < 3) { toast('Vidéo non lisible ici, j\'en cherche une autre…'); playCurrent(); }
    else { toast(`Lecture impossible : ${t.title}`); if (++P.skips < 8) next(true); }
  }
  function togglePlay() {
    if (!P.current) { toast('Choisis un titre à écouter'); return; }
    if (!P.ready) return;
    const st = P.yt.getPlayerState ? P.yt.getPlayerState() : -1;
    if (st === 1 || st === 3) P.yt.pauseVideo();
    else if (st === 2 || st === 5 || st === 0) P.yt.playVideo();
    else playCurrent();
  }
  function next(auto = false) {
    if (!P.list.length) return;
    if (auto && P.repeat === 'one') { try { P.yt.seekTo(0, true); P.yt.playVideo(); } catch (e) { /* rien */ } return; }
    if (P.pos + 1 >= P.order.length) {
      if (P.repeat === 'all' || !auto) { if (P.shuffle) buildOrder(null); P.pos = 0; }
      else { P.playing = false; updatePlayButtons(); return; }
    } else P.pos++;
    playCurrent();
  }
  function prev() {
    if (!P.list.length) return;
    try { if (P.ready && P.yt.getCurrentTime() > 3) { P.yt.seekTo(0, true); return; } } catch (e) { /* rien */ }
    if (P.pos > 0) P.pos--; else if (P.repeat === 'all') P.pos = P.order.length - 1;
    playCurrent();
  }
  function toggleShuffle() {
    P.shuffle = !P.shuffle;
    if (P.list.length) {
      const curIdx = P.order[P.pos];
      buildOrder(curIdx);
      if (!P.shuffle) P.pos = curIdx;
    }
    toast(P.shuffle ? 'Lecture aléatoire activée' : 'Lecture aléatoire désactivée', 1500);
    updatePlayerUI();
  }
  function toggleRepeat() {
    P.repeat = P.repeat === 'off' ? 'all' : P.repeat === 'all' ? 'one' : 'off';
    toast({ off: 'Répétition désactivée', all: 'Répéter la file', one: 'Répéter ce titre' }[P.repeat], 1500);
    updatePlayerUI();
  }
  function setStatus(s) { const el = $('#pl-status'); if (el) el.textContent = s; }
  function updatePlayButtons() {
    const icon = P.playing ? ic.pause : ic.play;
    $('#mini-play').innerHTML = icon; $('#pl-play').innerHTML = icon;
  }
  function updatePlayerUI() {
    const t = currentTrack();
    $('#mini-title').textContent = t ? t.title : '';
    $('#mini-artist').textContent = t ? t.artist : '';
    $('#pl-title').textContent = t ? t.title : '';
    $('#pl-artist').textContent = t ? t.artist : '';
    const src = P.source ? getPlaylist(P.source) : null;
    $('#player-src').textContent = src ? src.name : 'Zik';
    const liked = t && isLiked(t.id);
    for (const el of [$('#mini-like'), $('#pl-like')]) { el.innerHTML = liked ? ic.heartFill : ic.heart; el.classList.toggle('liked', !!liked); }
    $('#mini-next').innerHTML = ic.next;
    $('#pl-shuffle').classList.toggle('on', P.shuffle);
    $('#pl-repeat').classList.toggle('on', P.repeat !== 'off');
    $('#pl-repeat').innerHTML = P.repeat === 'one' ? ic.repeat1 : ic.repeat;
    if (t) document.getElementById('player').style.setProperty('--player-tint', `hsl(${hue(t.artist + t.title)} 45% 28%)`);
    updatePlayButtons();
  }
  // Barre de progression
  let seeking = false;
  const seek = $('#pl-seek');
  seek.addEventListener('input', () => {
    seeking = true;
    const d = P.ready && P.yt.getDuration ? P.yt.getDuration() : 0;
    $('#pl-cur').textContent = fmt(d * seek.value / 1000);
    seek.style.setProperty('--p', seek.value / 10 + '%');
  });
  seek.addEventListener('change', () => {
    const d = P.ready && P.yt.getDuration ? P.yt.getDuration() : 0;
    if (d) P.yt.seekTo(d * seek.value / 1000, true);
    seeking = false;
  });
  setInterval(() => {
    if (!P.ready || !P.current || !P.yt.getDuration) return;
    let d = 0, c = 0;
    try { d = P.yt.getDuration() || 0; c = P.yt.getCurrentTime() || 0; } catch (e) { return; }
    const pct = d ? Math.min(100, c / d * 100) : 0;
    $('#mini-bar').style.width = pct + '%';
    if (!seeking && document.body.classList.contains('player-open')) {
      seek.value = Math.round(pct * 10);
      seek.style.setProperty('--p', pct + '%');
      $('#pl-cur').textContent = fmt(c);
      $('#pl-dur').textContent = fmt(d);
    }
  }, 500);

  function setMediaSession(t) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album || '',
        artwork: t.videoId ? [{ src: `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }] : [] });
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    } catch (e) { /* non supporté */ }
  }
  let wakeLock = null;
  async function applyKeepAwake() {
    const on = !!(db.settings.keepAwake && P.playing);
    if (nativeBridge) { sendNative({ type: 'keepAwake', on }); return; }
    try {
      if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }

  function openPlayer() { if (!P.current) return; document.body.classList.add('player-open'); $('#player').setAttribute('aria-hidden', 'false'); }
  function closePlayer() { document.body.classList.remove('player-open'); $('#player').setAttribute('aria-hidden', 'true'); }

  function showQueue() {
    if (!P.list.length) return;
    const items = P.order.map((idx, pos) => ({ pos, t: db.tracks[P.list[idx]] })).filter((x) => x.t);
    const upcoming = items.slice(P.pos, P.pos + 200);
    openSheet('File d\'attente', `<ul class="list">${upcoming.map(({ pos, t }) => `
      <li class="track${pos === P.pos ? ' playing' : ''}" data-action="queue-jump" data-pos="${pos}">
        <div class="li-main"><div class="li-title">${esc(t.title)}</div><div class="li-sub">${esc(t.artist)}</div></div></li>`).join('')}</ul>
      ${items.length - P.pos > 200 ? `<p>… et ${items.length - P.pos - 200} autres</p>` : ''}`);
  }

  // ---------- Choix manuel de la vidéo ----------
  function parseYouTubeId(s) {
    s = String(s || '').trim();
    const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
  }
  let chooser = { trackId: null, results: [] };
  function openVideoChooser(trackId) {
    const t = db.tracks[trackId]; if (!t) return;
    chooser = { trackId, results: [] };
    const q = `${firstArtist(t.artist)} ${cleanTitle(t.title)}`.trim();
    openSheet('Choisir la vidéo', `
      <p><b style="color:var(--text)">${esc(t.title)}</b> — ${esc(t.artist)}</p>
      ${t.videoId ? `<p>Vidéo actuelle : ${esc(t.videoTitle || t.videoId)}</p>` : ''}
      <h3>Coller un lien YouTube</h3>
      <div class="row2"><input type="text" id="vc-link" placeholder="https://youtu.be/…" autocapitalize="off" autocomplete="off"><button class="btn primary" data-action="vc-link">OK</button></div>
      <div class="btn-row"><a class="btn" href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}" target="_blank" rel="noopener">${ic.yt}Chercher sur YouTube</a></div>
      <p>Astuce : dans YouTube, touche « Partager » → « Copier le lien », puis reviens coller le lien ici.</p>
      ${db.settings.apiKey ? `<h3>Ou choisis un résultat</h3>
      <form class="row2" id="vc-form"><input type="search" id="vc-q" value="${esc(q)}" autocomplete="off"><button class="btn" type="submit">${ic.search}</button></form>
      <ul class="list" id="vc-results"><div class="empty">Appuie sur la loupe pour chercher.</div></ul>` : ''}`);
    const f = $('#vc-form');
    if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const box = $('#vc-results'); box.innerHTML = '<div class="empty">Recherche…</div>';
      try {
        chooser.results = await ytSearch($('#vc-q').value, 10, true);
        box.innerHTML = chooser.results.map((r, i) => `<li data-action="vc-pick" data-index="${i}"><img class="thumb" src="${esc(r.thumb)}" alt="" loading="lazy">
          <div class="li-main"><div class="li-title">${esc(r.title)}</div><div class="li-sub">${esc(r.channel)}</div></div></li>`).join('') || '<div class="empty">Aucun résultat.</div>';
      } catch (err) { box.innerHTML = ''; handleApiError(err); }
    });
  }
  function assignVideo(trackId, videoId, videoTitle) {
    const t = db.tracks[trackId]; if (!t) return;
    t.videoId = videoId; t.videoTitle = videoTitle || ''; t.status = 'manual';
    if (t.badIds) t.badIds = t.badIds.filter((v) => v !== videoId);
    save(); closeSheet(); toast('Vidéo enregistrée pour ce titre');
    if (P.current === trackId) { loadVideo(videoId); }
    refreshView();
  }

  // ---------- Menus ----------
  function trackMenu(trackId) {
    const t = db.tracks[trackId]; if (!t) return;
    const inPl = route.name === 'playlist' ? getPlaylist(route.id) : null;
    openSheet(t.title, `<p>${esc(t.artist)}${t.album ? ' · ' + esc(t.album) : ''}</p><ul class="menu">
      <li><button data-action="m-play-next" data-id="${esc(t.id)}">${ic.queue}Lire ensuite</button></li>
      <li><button data-action="m-like" data-id="${esc(t.id)}">${isLiked(t.id) ? ic.heartFill + 'Retirer des titres likés' : ic.heart + 'Ajouter aux titres likés'}</button></li>
      <li><button data-action="m-add" data-id="${esc(t.id)}">${ic.plus}Ajouter à une playlist</button></li>
      <li><button data-action="m-video" data-id="${esc(t.id)}">${ic.yt}${t.videoId ? 'Changer la vidéo YouTube' : 'Choisir la vidéo YouTube'}</button></li>
      ${inPl ? `<li><button class="danger" data-action="m-remove" data-id="${esc(t.id)}">${ic.trash}Retirer de cette playlist</button></li>` : ''}
    </ul>`);
  }
  function addToPlaylistSheet(trackIds) {
    chooserAdd = trackIds;
    openSheet('Ajouter à une playlist', `<ul class="menu">
      <li><button data-action="add-new-pl">${ic.plus}Nouvelle playlist</button></li>
      <li><button data-action="add-to-pl" data-id="${LIKED}">${ic.heartFill}Titres likés</button></li>
      ${db.playlists.map((p) => `<li><button data-action="add-to-pl" data-id="${esc(p.id)}">${ic.list}${esc(p.name)}</button></li>`).join('')}
    </ul>`);
  }
  let chooserAdd = [];
  function addTracksTo(plId, ids) {
    const pl = getPlaylist(plId); if (!pl) return;
    let n = 0;
    for (const id of ids) if (!pl.tracks.includes(id)) { if (pl.id === LIKED) pl.tracks.unshift(id); else pl.tracks.push(id); n++; }
    save(); closeSheet();
    toast(n ? `Ajouté à « ${pl.name} »` : 'Déjà dans cette playlist');
    updatePlayerUI(); refreshView();
  }
  function playlistMenu() {
    const pl = getPlaylist(route.id); if (!pl) return;
    openSheet(pl.name, `<ul class="menu">
      <li><button data-action="convert-playlist">${ic.magic}Convertir les titres de la playlist</button></li>
      ${pl.special ? '' : `<li><button data-action="rename-playlist">${ic.edit}Renommer</button></li>
      <li><button class="danger" data-action="delete-playlist">${ic.trash}Supprimer la playlist</button></li>`}
    </ul>`);
  }

  // ---------- Actions ----------
  const actions = {
    tab: (el) => { closePlayer(); go({ name: el.dataset.tab }); },
    'open-playlist': (el) => go({ name: 'playlist', id: el.dataset.id }),
    'new-playlist': () => {
      const name = prompt('Nom de la nouvelle playlist', 'Ma playlist');
      if (name && name.trim()) { const pl = createPlaylist(name.trim()); go({ name: 'playlist', id: pl.id }); }
    },
    'open-import': openImport,
    'pick-csv': () => $('#file-csv').click(),
    'import-paste': () => {
      const text = $('#paste-text').value;
      const name = $('#paste-name').value.trim() || 'Playlist collée';
      const items = text.split(/\r?\n/).map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).map(splitArtistTitle);
      if (!items.length) { toast('Colle au moins un titre'); return; }
      const { nTr } = importGroups([{ name, items }]);
      closeSheet(); toast(`Playlist « ${name} » : ${plural(nTr, 'titre')}`);
      go({ name: 'library' });
      if (db.settings.apiKey) setTimeout(offerConvert, 600);
    },
    'play-playlist': () => { const pl = getPlaylist(route.id); if (pl) playList(pl.tracks, 0, { shuffle: false, source: pl.id }); },
    'shuffle-playlist': () => { const pl = getPlaylist(route.id); if (pl) playList(pl.tracks, null, { shuffle: true, source: pl.id }); },
    'play-from': (el) => {
      const pl = getPlaylist(route.id); if (!pl) return;
      const idx = Number(el.dataset.index);
      if (P.current === pl.tracks[idx] && P.source === pl.id) { openPlayer(); return; }
      playList(pl.tracks, idx, { source: pl.id });
    },
    'play-single': (el) => playList([el.dataset.id], 0, { source: '' }),
    'play-yt': (el) => { const r = ui.ytResults && ui.ytResults[Number(el.dataset.index)]; if (r) playList([ytResultToTrack(r)], 0, { source: '' }); },
    'yt-menu': (el) => { const r = ui.ytResults && ui.ytResults[Number(el.dataset.index)]; if (r) trackMenu(ytResultToTrack(r)); },
    'track-menu': (el) => trackMenu(el.dataset.id),
    'playlist-menu': playlistMenu,
    'm-play-next': (el) => {
      const id = el.dataset.id; closeSheet();
      if (!P.list.length) { playList([id], 0); return; }
      P.list.push(id); P.order.splice(P.pos + 1, 0, P.list.length - 1);
      toast('Sera lu ensuite');
    },
    'm-like': (el) => { closeSheet(); toggleLike(el.dataset.id); },
    'm-add': (el) => addToPlaylistSheet([el.dataset.id]),
    'm-video': (el) => openVideoChooser(el.dataset.id),
    'm-remove': (el) => {
      const pl = getPlaylist(route.id); if (!pl) return;
      const i = pl.tracks.indexOf(el.dataset.id); if (i >= 0) pl.tracks.splice(i, 1);
      save(); closeSheet(); refreshView(); toast('Retiré de la playlist');
    },
    'add-to-pl': (el) => addTracksTo(el.dataset.id, chooserAdd),
    'add-new-pl': () => {
      const name = prompt('Nom de la nouvelle playlist', 'Ma playlist');
      if (!name || !name.trim()) return;
      const pl = createPlaylist(name.trim());
      addTracksTo(pl.id, chooserAdd);
    },
    'convert-playlist': () => { const pl = getPlaylist(route.id); if (pl) convertTracks(pl.tracks); },
    'rename-playlist': () => {
      const pl = getPlaylist(route.id); if (!pl) return;
      const name = prompt('Nouveau nom', pl.name);
      if (name && name.trim()) { pl.name = name.trim(); save(); closeSheet(); render(); }
    },
    'delete-playlist': () => {
      const pl = getPlaylist(route.id); if (!pl) return;
      if (!confirm(`Supprimer la playlist « ${pl.name} » ?`)) return;
      db.playlists = db.playlists.filter((p) => p.id !== pl.id);
      pruneTracks(); save(); closeSheet(); go({ name: 'library' }); toast('Playlist supprimée');
    },
    'convert-all': () => convertTracks(allPendingIds()),
    'retry-notfound': () => {
      Object.values(db.tracks).forEach((t) => { if (!t.videoId && t.status === 'notfound') t.status = 'pending'; });
      save(); convertTracks(allPendingIds());
    },
    'stop-convert': () => { conv.stop = true; },
    'save-key': () => {
      const v = $('#api-key').value.trim();
      db.settings.apiKey = v; saveNow();
      if (!v) { toast('Clé supprimée'); render(); return; }
      toast('Test de la clé…', 1500);
      ytSearch('test', 1, false).then(() => { toast('Clé YouTube OK ✓'); render(); }).catch((e) => { handleApiError(e); render(); });
    },
    export: exportBackup,
    restore: () => $('#file-json').click(),
    wipe: () => {
      if (!confirm('Effacer toutes tes playlists et titres ? (ta clé YouTube est conservée)')) return;
      const key = db.settings.apiKey; db = blank(); db.settings.apiKey = key; saveNow();
      P.list = []; P.order = []; P.current = null; pauseVideo(); document.body.classList.remove('has-track');
      go({ name: 'library' }); toast('Bibliothèque effacée');
    },
    'open-player': openPlayer,
    'close-player': closePlayer,
    'toggle-play': togglePlay,
    next: () => next(false),
    prev,
    'toggle-shuffle': toggleShuffle,
    'toggle-repeat': toggleRepeat,
    'like-current': () => toggleLike(P.current),
    'add-current': () => { if (P.current) addToPlaylistSheet([P.current]); },
    'choose-video-current': () => { if (P.current) openVideoChooser(P.current); },
    'show-queue': showQueue,
    'queue-jump': (el) => { P.pos = Number(el.dataset.pos); closeSheet(); playCurrent(); },
    'close-sheet': closeSheet,
    'vc-link': () => {
      const vid = parseYouTubeId($('#vc-link').value);
      if (!vid) { toast('Lien YouTube non reconnu'); return; }
      assignVideo(chooser.trackId, vid, '');
      if (P.current === chooser.trackId && !P.playing) loadVideo(vid);
    },
    'vc-pick': (el) => { const r = chooser.results[Number(el.dataset.index)]; if (r) assignVideo(chooser.trackId, r.videoId, r.title); },
  };
  function pruneTracks() {
    const used = new Set(db.liked);
    db.playlists.forEach((p) => p.tracks.forEach((id) => used.add(id)));
    if (P.list) P.list.forEach((id) => used.add(id));
    for (const id of Object.keys(db.tracks)) if (!used.has(id)) delete db.tracks[id];
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    if (el.tagName === 'A') return; // les liens s'ouvrent normalement
    e.preventDefault();
    e.stopPropagation();
    fn(el, e);
  });
  $('#file-csv').addEventListener('change', (e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) importFiles(files); });
  $('#file-json').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreFromText(await f.text()); });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'Escape') { if (document.body.classList.contains('sheet-open')) closeSheet(); else closePlayer(); }
    else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  });

  // Point d'entrée pour l'appli iOS (ex. reprise après mise en veille)
  window.zik = { pause: pauseVideo, version: VERSION };

  render();
  updatePlayerUI();
  loadYtApi();
})();
