const API_URL = 'http://localhost:3000/api';
// Ändere auf false, wenn das MySQL Backend läuft:
const USE_DEMO_MODE = true; 

let state = {
    user: { id: 1, name: 'Admin' }, view: 'home', songs: [], likedSongIds: [],
    searchQuery: '', webdavConfig: { url: '', username: '', password: '' },
    currentSong: null, isPlaying: false, progress: 0, isSyncing: false
};
let progressInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setupNavigation();
    setupEventListeners();
    
    // Check if mobile for UI tweaks
    if(window.innerWidth <= 768) {
        document.getElementById('close-sidebar-btn').style.display = 'block';
        document.getElementById('mobile-play-wrapper').style.display = 'flex';
    }
    
    loadInitialData();
});

async function loadInitialData() {
    if (USE_DEMO_MODE) {
        state.webdavConfig = { url: 'https://demo-nas.local/webdav', username: 'demo', password: '' };
        state.songs = [
            { id: 1, title: 'MySQL Groove', artist: 'Database Admin', album: 'Queries', cover: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=300&h=300&fit=crop', duration: '3:45', streamUrl: '' },
            { id: 2, title: 'REST API Chill', artist: 'Node.js', album: 'Backend', cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop', duration: '4:20', streamUrl: '' },
            { id: 3, title: 'Neon Drive', artist: 'Synthwave', album: 'Night', cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop', duration: '5:12', streamUrl: '' }
        ];
        state.likedSongIds = [1];
        updateUI();
        return;
    }

    try {
        const [settingsRes, songsRes, likedRes] = await Promise.all([
            fetch(`${API_URL}/settings/${state.user.id}`), fetch(`${API_URL}/songs/${state.user.id}`), fetch(`${API_URL}/liked/${state.user.id}`)
        ]);
        if (settingsRes.ok) state.webdavConfig = await settingsRes.json();
        if (songsRes.ok) state.songs = await songsRes.json();
        if (likedRes.ok) {
            const likedData = await likedRes.json();
            state.likedSongIds = likedData.map(item => item.song_id);
        }
        updateUI();
    } catch (error) { showToast("Verbindungsfehler"); }
}

function navigateTo(viewName) {
    state.view = viewName;
    toggleMobileMenu(false);
    
    ['home', 'search', 'liked', 'admin'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden-view');
    });
    document.getElementById(`view-${viewName}`).classList.remove('hidden-view');
    document.getElementById('main-scroll-area').scrollTop = 0;
    
    updateUI();
}

function toggleMobileMenu(forceOpen = null) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    const isOpen = forceOpen !== null ? forceOpen : !sidebar.classList.contains('open');
    
    if (isOpen) {
        sidebar.classList.add('open');
        overlay.classList.remove('hidden-view');
    } else {
        sidebar.classList.remove('open');
        overlay.classList.add('hidden-view');
    }
}

function setupNavigation() {
    const createNavItem = (item) => `
        <div onclick="navigateTo('${item.id}')" class="nav-item ${state.view === item.id ? 'active' : ''}">
            <i data-lucide="${item.icon}" style="width: 24px; height: 24px;"></i>
            ${item.label}
        </div>
    `;
    document.getElementById('nav-main').innerHTML = [
        { id: 'home', label: 'Start', icon: 'home' },
        { id: 'search', label: 'Suchen', icon: 'search' }
    ].map(createNavItem).join('');
    document.getElementById('nav-library').innerHTML = [{ id: 'liked', label: 'Lieblingssongs', icon: 'heart' }].map(createNavItem).join('');
    document.getElementById('nav-bottom').innerHTML = [{ id: 'admin', label: 'Einstellungen', icon: 'settings' }].map(createNavItem).join('');
}

function updateUI() {
    setupNavigation();
    
    const inputUrl = document.getElementById('input-url');
    if (inputUrl) inputUrl.value = state.webdavConfig.url || '';
    const inputUsername = document.getElementById('input-username');
    if (inputUsername) inputUsername.value = state.webdavConfig.username || '';
    const inputPassword = document.getElementById('input-password');
    if (inputPassword) inputPassword.value = state.webdavConfig.password || '';

    if (state.view === 'home') renderGrid('grid-home', state.songs, "Deine Bibliothek ist leer.");
    else if (state.view === 'search') {
        const query = state.searchQuery.toLowerCase();
        const filtered = state.songs.filter(s => s.title.toLowerCase().includes(query) || s.artist.toLowerCase().includes(query));
        renderGrid('grid-search', filtered, "Keine Treffer.");
    } else if (state.view === 'liked') {
        const likedSongs = state.songs.filter(s => state.likedSongIds.includes(s.id));
        document.getElementById('liked-count').innerText = `${likedSongs.length} Songs`;
        renderGrid('grid-liked', likedSongs, "Noch keine Favoriten.");
    }
    updatePlayerUI();
    lucide.createIcons();
}

function renderGrid(containerId, songsArray, emptyMessage) {
    const container = document.getElementById(containerId);
    if (songsArray.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; margin-top: 3rem;">
                <i data-lucide="music" style="width: 48px; height: 48px; color: var(--text-muted); margin: 0 auto 1rem;"></i>
                <h3 style="margin-bottom: 0.5rem;">Nichts gefunden</h3>
                <p style="color: var(--text-muted);">${emptyMessage}</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="song-grid">
            ${songsArray.map(song => {
                const isLiked = state.likedSongIds.includes(song.id);
                const isPlaying = state.currentSong && state.currentSong.id === song.id && state.isPlaying;
                return `
                <div class="song-card" onclick="playSpecificSong(${song.id})">
                    <div class="cover-container">
                        <img src="${song.cover}" class="cover-image" />
                        <button onclick="handleLikeClick(event, ${song.id})" class="btn-like-corner ${isLiked ? 'liked' : ''}">
                            <i data-lucide="heart" style="width: 16px; height: 16px;" ${isLiked ? 'fill="currentColor"' : ''}></i>
                        </button>
                        <button class="btn-play-round ${isPlaying ? 'force-show' : ''}">
                            <i data-lucide="${isPlaying ? 'pause' : 'play'}" style="width: 24px; height: 24px; ${isPlaying?'':'margin-left: 2px;'}" fill="currentColor"></i>
                        </button>
                    </div>
                    <div class="song-title truncate">${song.title}</div>
                    <div class="song-artist truncate">${song.artist}</div>
                </div>`;
            }).join('')}
        </div>`;
}

function setupEventListeners() {
    document.getElementById('input-search').addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if(state.view === 'search') updateUI();
    });
    document.getElementById('form-settings').addEventListener('submit', async (e) => {
        e.preventDefault();
        state.webdavConfig = {
            url: document.getElementById('input-url').value,
            username: document.getElementById('input-username').value,
            password: document.getElementById('input-password').value
        };
        if (USE_DEMO_MODE) return showToast("Gespeichert (Demo)");
        try {
            const res = await fetch(`${API_URL}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, config: state.webdavConfig }) });
            showToast(res.ok ? "Gespeichert!" : "Fehler");
        } catch (err) { showToast("Backend Fehler"); }
    });
}

async function handleSync() {
    if (!state.webdavConfig.url) return showToast("Bitte URL eingeben.");
    const btn = document.getElementById('btn-sync');
    state.isSyncing = true;
    if (btn) btn.innerHTML = `<i data-lucide="refresh-cw" style="width: 20px; height: 20px; animation: spin 1s linear infinite;"></i> Synchronisiere...`;
    lucide.createIcons();

    if (USE_DEMO_MODE) {
        setTimeout(() => {
            state.songs.push({ id: Date.now(), title: 'New Track', artist: 'WebDAV Scanner', album: 'Fresh', cover: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f08d5e?w=300&h=300&fit=crop', duration: '2:55', streamUrl: '' });
            finishSync("Erfolgreich (Demo)");
        }, 1500);
        return;
    }
    try {
        const res = await fetch(`${API_URL}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, config: state.webdavConfig }) });
        if (res.ok) { state.songs = await res.json(); finishSync("Synchronisiert!"); }
        else finishSync("Fehler");
    } catch (err) { finishSync("Backend Fehler"); }
}

function finishSync(msg) {
    state.isSyncing = false;
    const btn = document.getElementById('btn-sync');
    if (btn) btn.innerHTML = `<i data-lucide="refresh-cw" style="width: 20px; height: 20px;"></i> Jetzt Synchronisieren`;
    showToast(msg);
    updateUI();
}

async function handleDeleteAll() {
    if(!confirm("Wirklich alle löschen?")) return;
    if (USE_DEMO_MODE) { state.songs = []; state.likedSongIds = []; state.currentSong = null; state.isPlaying = false; clearInterval(progressInterval); showToast("Geleert (Demo)"); updateUI(); return; }
    try {
        const res = await fetch(`${API_URL}/songs/${state.user.id}`, { method: 'DELETE' });
        if (res.ok) { state.songs = []; state.currentSong = null; state.isPlaying = false; clearInterval(progressInterval); showToast("Geleert"); updateUI(); }
    } catch(e) { showToast("Backend Fehler"); }
}

async function handleLikeClick(event, songId) {
    event.stopPropagation();
    const isLiked = state.likedSongIds.includes(songId);
    if (USE_DEMO_MODE) {
        if (isLiked) state.likedSongIds = state.likedSongIds.filter(id => id !== songId);
        else state.likedSongIds.push(songId);
        updateUI(); return;
    }
    try {
        const res = await fetch(`${API_URL}/liked`, { method: isLiked ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, songId }) });
        if (res.ok) {
            if (isLiked) state.likedSongIds = state.likedSongIds.filter(id => id !== songId);
            else state.likedSongIds.push(songId);
            updateUI();
        }
    } catch (error) { showToast("Netzwerkfehler beim Liken"); }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function playSpecificSong(songId) {
    const song = state.songs.find(s => s.id === songId);
    if (!song) return;
    if (state.currentSong && state.currentSong.id === songId) togglePlay();
    else { state.currentSong = song; state.isPlaying = true; state.progress = 0; startProgressTimer(); updateUI(); }
}

function togglePlay() {
    if (!state.currentSong && state.songs.length > 0) { state.currentSong = state.songs[0]; state.isPlaying = true; }
    else if (state.currentSong) state.isPlaying = !state.isPlaying;
    if(state.isPlaying) startProgressTimer(); else clearInterval(progressInterval);
    updateUI();
}

function playNext() {
    if (state.songs.length === 0) return;
    if (!state.currentSong) return togglePlay();
    playSpecificSong(state.songs[(state.songs.findIndex(s => s.id === state.currentSong.id) + 1) % state.songs.length].id);
}

function playPrev() {
    if (state.songs.length === 0) return;
    if (!state.currentSong) return togglePlay();
    const idx = state.songs.findIndex(s => s.id === state.currentSong.id);
    playSpecificSong(state.songs[(idx - 1 + state.songs.length) % state.songs.length].id);
}

function startProgressTimer() {
    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        let totalSecs = 200; // Standardwert als Fallback
        if (state.currentSong && state.currentSong.duration) {
            const timeParts = state.currentSong.duration.split(':');
            if (timeParts.length === 2) {
                totalSecs = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
            }
        }
        state.progress += (100 / totalSecs);
        if (state.progress >= 100) { state.progress = 100; playNext(); } else updatePlayerUIProgressOnly();
    }, 1000);
}

function updatePlayerUIProgressOnly() {
    const w = `${state.progress}%`;
    
    const pbDesktop = document.getElementById('progress-bar-desktop');
    if (pbDesktop) pbDesktop.style.width = w;
    const pbMobile = document.getElementById('progress-bar-mobile');
    if (pbMobile) pbMobile.style.width = w;
    const pKnob = document.getElementById('progress-knob');
    if (pKnob) pKnob.style.right = `calc(100% - ${state.progress}% - 6px)`;
    
    const tCurr = document.getElementById('time-current');
    if (state.isPlaying && tCurr && state.currentSong) {
        const timeParts = state.currentSong.duration.split(':');
        if (timeParts.length === 2) {
            const totalSecs = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
            const currSecs = Math.floor((state.progress / 100) * totalSecs);
            const m = Math.floor(currSecs / 60);
            const s = currSecs % 60;
            tCurr.innerText = `${m}:${s.toString().padStart(2, '0')}`;
        }
    }
}

function updatePlayerUI() {
    const infoContainer = document.getElementById('player-info');
    const playBtnDesk = document.getElementById('btn-play-desktop');
    const playBtnMob = document.getElementById('btn-play-mobile');

    if (state.currentSong) {
        const isLiked = state.likedSongIds.includes(state.currentSong.id);
        infoContainer.innerHTML = `
            <img src="${state.currentSong.cover}" class="player-cover" />
            <div class="player-left" style="display:flex; flex-direction:column; justify-content:center;">
                <div style="font-size:0.875rem; font-weight:bold; color:white;">${state.currentSong.title}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${state.currentSong.artist}</div>
            </div>
            <i data-lucide="heart" style="width:16px; height:16px; cursor:pointer; color:${isLiked ? 'var(--accent)' : 'var(--text-muted)'}; margin-left:1rem;" ${isLiked ? 'fill="currentColor"' : ''} onclick="handleLikeClick(event, ${state.currentSong.id})"></i>
        `;
        document.getElementById('time-total').innerText = state.currentSong.duration;
    }

    if (playBtnDesk && playBtnMob) {
        playBtnDesk.innerHTML = `<i data-lucide="${state.isPlaying ? 'pause' : 'play'}" style="width: 24px; height: 24px; ${state.isPlaying ? '' : 'margin-left: 2px;'}" fill="currentColor"></i>`;
        playBtnMob.innerHTML = `<i data-lucide="${state.isPlaying ? 'pause' : 'play'}" style="width: 24px; height: 24px; ${state.isPlaying ? '' : 'margin-left: 2px;'}" fill="currentColor"></i>`;
    }
    updatePlayerUIProgressOnly();
    lucide.createIcons();
}