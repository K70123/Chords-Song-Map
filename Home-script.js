const firebaseConfig = {
    apiKey: "AIzaSyDq2yjYSfyhiIbrviV0WhW-NKzdfk7ABrQ",
    authDomain: "chords-and-song-maps.firebaseapp.com",
    projectId: "chords-and-song-maps",
    storageBucket: "chords-and-song-maps.appspot.com",
    messagingSenderId: "364224410651",
    appId: "1:364224410651:web:d26213bf0e0b536aae34be",
    measurementId: "G-CQEJKPQX1C"
};

// Prevent double init
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

let appData = [];
let currentUser = null;
let liveSongs = [];
let liveSongsData = {};
let globalClickHandlersInitialized = false;

const mainPageUrl = 'Main Page.html';

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hideAllMenus() {
    document.querySelectorAll('.artist-actions-menu').forEach(menu => menu.style.display = 'none');
    document.querySelectorAll('.song-actions-menu').forEach(menu => menu.style.display = 'none');
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.style.display = 'none');
    hideLiveHover();
}

function initializeGlobalClickHandler() {
    if (globalClickHandlersInitialized) return;
    globalClickHandlersInitialized = true;

    document.addEventListener('click', (e) => {
        hideAllMenus();
    });
}

/**
 * ============================================
 * DEFENSIVE DATA INITIALIZATION & VALIDATION
 * ============================================
 */

/**
 * Ensures a song object has all required fields with safe defaults
 * Prevents crashes from missing chords, originalKey, or songMap
 */
function ensureSongDataIntegrity(song) {
    if (!song) return null;

    try {
        // Ensure basic fields exist
        if (!song.name) song.name = "Untitled";
        if (!song.url) song.url = mainPageUrl;

        // CRITICAL: Initialize missing chord data with safe defaults
        if (!Array.isArray(song.chords) || song.chords.length === 0) {
            song.chords = [
                {
                    section: "Intro",
                    chords: [
                        { beats: 4, chordLine: "• • • •" }
                    ]
                }
            ];
        }

        // CRITICAL: Ensure originalKey is set (required for transposition)
        if (!song.originalKey) {
            song.originalKey = "C"; // Safe default
        }

        // CRITICAL: Initialize songMap if missing
        if (!Array.isArray(song.songMap)) {
            song.songMap = [];
        }

        // Safe defaults for playback parameters
        if (!song.beatsPerBar || song.beatsPerBar < 1) {
            song.beatsPerBar = 4;
        }

        if (!song.chordsPerRow || song.chordsPerRow < 1 || song.chordsPerRow > 10) {
            song.chordsPerRow = 4;
        }

        return song;
    } catch (err) {
        console.error("Error ensuring song data integrity:", err);
        return song;
    }
}

/**
 * Validates song is safe to add to live section
 * Returns {valid: boolean, errors: string[]}
 */
function validateSongForLive(song) {
    const errors = [];

    if (!song || !song.name) errors.push("Song has no name");
    if (!song.originalKey) errors.push("Song missing original key");
    if (!Array.isArray(song.chords) || song.chords.length === 0) {
        errors.push("Song missing chords section");
    }
    // songMap is optional, so we don't require it

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Safely adds song to live section with validation and auto-repair
 */
async function safeAddToLiveSection(song) {
    try {
        // Ensure data integrity first
        const repaired = ensureSongDataIntegrity(song);
        if (!repaired) {
            console.error("Cannot add song to live section: data repair failed");
            return false;
        }

        // Check validation
        const validation = validateSongForLive(repaired);
        if (!validation.valid) {
            // Auto-repair missing data
            const repairedWithDefaults = ensureSongDataIntegrity(repaired);
            // Update the original song object
            Object.assign(song, repairedWithDefaults);
        }

        // Add to live songs if not already there
        if (!liveSongs.includes(song.name)) {
            liveSongs.push(song.name);
            // Create a deep copy for live editing
            liveSongsData[song.name] = JSON.parse(JSON.stringify(song));
        }

        return true;
    } catch (err) {
        console.error("Error adding song to live section:", err);
        return false;
    }
}

/**
 * ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

function goToMainSong(artistName, songName) {
    if (!currentUser) {
        console.error("No user logged in");
        return;
    }

    // Preselect song and keep portal to live section
    localStorage.setItem(`currentSongTitle_${currentUser}`, songName);
    localStorage.setItem(`openMapForSong_${currentUser}`, songName);
    localStorage.setItem(`liveSection_${currentUser}`, 'true');
    window.location.href = mainPageUrl;
}

/**
 * ============================================
 * SEARCH BAR FUNCTIONALITY
 * ============================================
 */

function renderSearchResults() {
    const searchInput = document.getElementById('songSearchInput');
    const searchResults = document.getElementById('searchResults');
    if (!searchInput || !searchResults) return;

    const query = searchInput.value.trim().toLowerCase();
    if (query.length === 0) {
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
        return;
    }

    const items = [];
    (appData || []).forEach((artistObj) => {
        const artistLabel = (artistObj.artist || '').toString();
        const artistLower = artistLabel.toLowerCase();

        if (artistLower.includes(query)) {
            (artistObj.songs || []).forEach(song => {
                items.push({ artist: artistLabel, song: song.name || '' });
            });
        } else {
            (artistObj.songs || []).forEach(song => {
                const songName = (song.name || '').toString();
                if (songName.toLowerCase().includes(query)) {
                    items.push({ artist: artistLabel, song: songName });
                }
            });
        }
    });

    if (items.length === 0) {
        searchResults.innerHTML = '<div class="empty">No songs found.</div>';
        searchResults.style.display = 'block';
        return;
    }

    // Keep first 25 results
    const limited = items.slice(0, 25);
    searchResults.innerHTML = limited.map(item =>
        `<div class="search-result-item" data-artist="${item.artist.replace(/"/g, '&quot;')}" data-song="${item.song.replace(/"/g, '&quot;')}">` +
        `<strong>${item.song}</strong> <span style="opacity:.7; margin-left: 7px;">by ${item.artist}</span></div>`
    ).join('');

    searchResults.style.display = 'block';

    Array.from(searchResults.children).forEach(el => {
        el.addEventListener('click', () => {
            const artistName = el.getAttribute('data-artist');
            const songName = el.getAttribute('data-song');
            goToMainSong(artistName, songName);
        });
    });
}

function initSearchBar() {
    const searchInput = document.getElementById('songSearchInput');
    const searchResults = document.getElementById('searchResults');
    if (!searchInput || !searchResults) return;

    // === FORCE HARDWARE FOCUS FOR IPAD/STYLUS ===
    // 'pointerdown' fires before click/touch can be suppressed by global listeners
    searchInput.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); // Stops the parent container from dropping focus
        this.focus();
    });

    // Fallback for strict touch-devices 
    searchInput.addEventListener('touchstart', function (e) {
        e.stopPropagation();
        this.focus();
    });

    searchInput.addEventListener('input', renderSearchResults);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchResults.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.style.display = 'none';
        }
    });
}

/**
 * ============================================
 * FIREBASE AUTHENTICATION & DATA LOADING
 * ============================================
 */

firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user.uid;
    console.log("Authenticated user:", currentUser);

    try {
        const doc = await firebase.firestore().collection('users').doc(currentUser).get();

        if (doc.exists) {
            const userData = doc.data();
            appData = safeArray(userData.appData);
            liveSongs = safeArray(userData.liveSongs);
            liveSongsData = safeObject(userData.liveSongsData);

            // Normalize appData and ensure song integrity
            appData = appData.map((artist) => {
                return {
                    ...artist,
                    songs: safeArray(artist.songs).map(song => ensureSongDataIntegrity(song))
                };
            });

            // Validate and repair live songs data on load
            if (Array.isArray(liveSongs)) {
                liveSongs = liveSongs.filter(songName => {
                    if (!liveSongsData[songName]) {
                        // Try to find original song
                        for (const artist of appData) {
                            const orig = artist.songs.find(s => s.name === songName);
                            if (orig) {
                                liveSongsData[songName] = ensureSongDataIntegrity(
                                    JSON.parse(JSON.stringify(orig))
                                );
                                return true;
                            }
                        }
                        return false; // Remove if not found
                    }
                    // Ensure data integrity
                    ensureSongDataIntegrity(liveSongsData[songName]);
                    return true;
                });
            }

            const isDarkMode = userData.darkMode === true;
            if (isDarkMode) {
                document.body.classList.add('dark-mode');
                const darkbtn = document.getElementById('darkBtn');
                const textSpan = document.querySelector('#darkBtnSpan');
                if (darkbtn && textSpan) {
                    darkbtn.innerHTML = '☼';
                    textSpan.textContent = 'Light Mode';
                }
            } else {
                document.body.classList.remove('dark-mode');
                const darkbtn = document.getElementById('darkBtn');
                const textSpan = document.querySelector('#darkBtnSpan');
                if (darkbtn && textSpan) {
                    darkbtn.innerHTML = '☾⋆';
                    textSpan.textContent = 'Dark Mode';
                }
            }
        } else {
            appData = [];
            document.body.classList.remove('dark-mode');
        }

        renderUI();
        initSearchBar();
        document.body.classList.remove('loading');
    } catch (error) {
        console.error("Error loading user data from Firestore:", error);
    }
});

/**
 * ============================================
 * DATA PERSISTENCE
 * ============================================
 */

async function saveData() {
    if (!currentUser) {
        console.error("User not logged in, cannot save data.");
        return;
    }

    // Defensive checks
    if (!Array.isArray(appData)) {
        console.error("appData is not an array, resetting...");
        appData = [];
    }
    if (!Array.isArray(liveSongs)) {
        console.error("liveSongs is not an array, resetting...");
        liveSongs = [];
    }
    if (!liveSongsData || typeof liveSongsData !== 'object') {
        console.error("liveSongsData is not an object, resetting...");
        liveSongsData = {};
    }

    try {
        await firebase.firestore().collection('users').doc(currentUser).set({
            appData: appData,
            liveSongs: liveSongs,
            liveSongsData: liveSongsData
        }, { merge: true });
    } catch (error) {
        console.error("Error saving app data to Firestore:", error);
    }
}

/**
 * ============================================
 * UI RENDERING WITH TOUCH-FRIENDLY INTERACTIONS
 * ============================================
 */

// Add new artist button
document.getElementById('addArtistBtn').addEventListener('click', function () {
    if (!firebase.auth().currentUser) {
        console.error("No user logged in to add artist.");
        return;
    }

    appData.push({ artist: 'Unknown Artist', songs: [] });
    appData.sort((a, b) => a.artist.toLowerCase().localeCompare(b.artist.toLowerCase()));

    saveData();
    renderUI();
});

function renderUI() {
    appData = safeArray(appData);
    const container = document.querySelector('.container');
    if (!container) return;

    if (appData.length > 0) {
        document.querySelector('.noArtist').style.display = 'none';
    } else {
        document.querySelector('.noArtist').style.display = 'block';
    }

    container.innerHTML = '';

    appData.forEach((artistObj, artistIdx) => {
        // Artist container
        const songContainer = document.createElement('div');
        songContainer.className = 'songContainer';

        // Top bar with artist name and action menu
        const topContainer = document.createElement('div');
        topContainer.className = 'topContainer';

        // Artist name
        const artistDiv = document.createElement('div');
        artistDiv.className = 'artist';
        artistDiv.textContent = artistObj.artist;

        const artistActionsBtn = document.createElement('button');
        artistActionsBtn.className = 'artist-actions-btn';
        artistActionsBtn.setAttribute('aria-label', `Actions for artist ${artistObj.artist}`);
        artistActionsBtn.innerHTML = '⋮'; // Three dots menu icon
        artistActionsBtn.setAttribute('data-artist-idx', artistIdx);

        topContainer.appendChild(artistDiv);
        topContainer.appendChild(artistActionsBtn);

        // Artist action menu (initially hidden)
        const artistActionsMenu = document.createElement('div');
        artistActionsMenu.className = 'artist-actions-menu';
        artistActionsMenu.style.display = 'none';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'artist-menu-btn';
        renameBtn.textContent = '✏️ Rename Artist';
        renameBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleArtistRename(artistIdx, artistDiv, artistActionsMenu);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'artist-menu-btn artist-menu-btn-delete';
        deleteBtn.textContent = '🗑️ Delete Artist';
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`Delete "${artistObj.artist}" and all its songs?\n(This cannot be undone)`)) {
                const artistSongs = appData[artistIdx].songs.map(s => s.name);
                artistSongs.forEach(songName => {
                    liveSongs = liveSongs.filter(n => n !== songName);
                    delete liveSongsData[songName];
                });
                appData.splice(artistIdx, 1);
                await saveData();
                renderUI();
            }
            artistActionsMenu.style.display = 'none';
        });

        artistActionsMenu.appendChild(renameBtn);
        artistActionsMenu.appendChild(deleteBtn);

        // Toggle menu visibility
        artistActionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other menus
            document.querySelectorAll('.artist-actions-menu').forEach(menu => {
                if (menu !== artistActionsMenu) menu.style.display = 'none';
            });
            artistActionsMenu.style.display =
                artistActionsMenu.style.display === 'none' ? 'block' : 'none';
        });

        topContainer.appendChild(artistActionsMenu);
        songContainer.appendChild(topContainer);

        // Dropdown menu for songs
        const dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'dropdown-menu';

        const songList = document.createElement('ul');
        songList.className = 'songList';
        const artistSongs = safeArray(artistObj.songs);

        artistSongs.forEach((song, songIdx) => {
            const songItem = document.createElement('li');
            songItem.className = 'songItem';

            const songNameContainer = document.createElement('div');
            songNameContainer.className = 'songNameContainer';

            const songName = document.createElement('span');
            songName.className = 'songName';

            const songLink = document.createElement('a');
            songLink.className = 'songLink';
            songLink.textContent = song.name;
            songLink.href = '#';

            songName.appendChild(songLink);
            songNameContainer.appendChild(songName);

            songLink.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                localStorage.setItem(`currentSongTitle_${currentUser}`, song.name);
                localStorage.setItem(`liveSection_${currentUser}`, 'false');
                localStorage.setItem(`openMapForSong_${currentUser}`, song.name);
                await saveData();
                window.location.href = mainPageUrl;
            });

            songNameContainer.addEventListener('click', async (e) => {
                if (e.target.closest('.song-actions-btn') || e.target.closest('.song-actions-menu')) return;
                e.preventDefault();
                e.stopPropagation();
                localStorage.setItem(`currentSongTitle_${currentUser}`, song.name);
                localStorage.setItem(`liveSection_${currentUser}`, 'false');
                localStorage.setItem(`openMapForSong_${currentUser}`, song.name);
                await saveData();
                window.location.href = mainPageUrl;
            });

            const songActionsBtn = document.createElement('button');
            songActionsBtn.className = 'song-actions-btn';
            songActionsBtn.setAttribute('aria-label', `Actions for song ${song.name}`);
            songActionsBtn.innerHTML = '⋮';
            songActionsBtn.setAttribute('data-song-idx', songIdx);

            const songActionsMenu = document.createElement('div');
            songActionsMenu.className = 'song-actions-menu';
            songActionsMenu.style.display = 'none';

            // Rename song
            const renameSongBtn = document.createElement('button');
            renameSongBtn.className = 'song-menu-btn';
            renameSongBtn.textContent = '✏️ Rename';
            renameSongBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSongRename(artistIdx, songIdx, song, songLink);
                songActionsMenu.style.display = 'none';
            });

            // Delete song
            const deleteSongBtn = document.createElement('button');
            deleteSongBtn.className = 'song-menu-btn song-menu-btn-delete';
            deleteSongBtn.textContent = '🗑️ Delete';
            deleteSongBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm(`Delete "${song.name}"?\n(This cannot be undone)`)) {
                    const songNameToDelete = song.name;
                    appData[artistIdx].songs.splice(songIdx, 1);
                    liveSongs = liveSongs.filter(n => n !== songNameToDelete);
                    delete liveSongsData[songNameToDelete];
                    await saveData();
                    renderUI();
                }
                songActionsMenu.style.display = 'none';
            });

            // Add to live section
            const addToLiveBtn = document.createElement('button');
            addToLiveBtn.className = 'song-menu-btn';
            const isLive = liveSongs.includes(song.name);
            addToLiveBtn.textContent = isLive ? '🔴 Remove from Live' : '🟢 Add to Live';
            addToLiveBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const songName = song.name;

                if (!liveSongs.includes(songName)) {
                    // Validate and repair song before adding to live
                    const songToAdd = JSON.parse(JSON.stringify(song));
                    const repaired = ensureSongDataIntegrity(songToAdd);
                    const validation = validateSongForLive(repaired);

                    if (!validation.valid) {
                        // Show warning about missing data
                        const warning = `Song is missing: ${validation.errors.join(', ')}. Auto-initializing...`;
                        console.warn(warning);
                    }

                    liveSongs.push(songName);
                    liveSongsData[songName] = repaired;
                    addToLiveBtn.textContent = '🔴 Remove from Live';
                } else {
                    liveSongs = liveSongs.filter(n => n !== songName);
                    delete liveSongsData[songName];
                    addToLiveBtn.textContent = '🟢 Add to Live';
                }

                await saveData();
                renderUI();
                songActionsMenu.style.display = 'none';
            });

            songActionsMenu.appendChild(renameSongBtn);
            songActionsMenu.appendChild(deleteSongBtn);
            songActionsMenu.appendChild(addToLiveBtn);

            songActionsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.song-actions-menu').forEach(menu => {
                    if (menu !== songActionsMenu) menu.style.display = 'none';
                });

                const isHidden = songActionsMenu.style.display === 'none';
                if (isHidden) {
                    songActionsMenu.style.display = 'block';
                    // Check if menu overflows right edge
                    setTimeout(() => {
                        const rect = songActionsMenu.getBoundingClientRect();
                        if (rect.right > window.innerWidth) {
                            songActionsMenu.classList.add('flipped');
                        } else {
                            songActionsMenu.classList.remove('flipped');
                        }
                    }, 0);
                } else {
                    songActionsMenu.style.display = 'none';
                    songActionsMenu.classList.remove('flipped');
                }
            });

            songNameContainer.appendChild(songActionsBtn);
            songNameContainer.appendChild(songActionsMenu);
            songItem.appendChild(songNameContainer);

            songList.appendChild(songItem);
        });

        // Add new song button
        const addSongLi = document.createElement('li');
        const newSongBtn = document.createElement('button');
        newSongBtn.className = 'newSongBtn';
        newSongBtn.textContent = '+ Add New Song';
        newSongBtn.addEventListener('click', () => {
            // Create song with safe defaults
            const newSong = {
                name: 'Untitled',
                url: mainPageUrl,
                chords: [
                    {
                        section: 'Intro',
                        chords: [{ beats: 4, chordLine: '• • • •' }]
                    }
                ],
                originalKey: 'C',
                beatsPerBar: 4,
                chordsPerRow: 4,
                songMap: []
            };

            appData[artistIdx].songs.push(newSong);
            appData[artistIdx].songs.sort((a, b) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            );

            saveData();
            renderUI();
        });

        addSongLi.appendChild(newSongBtn);
        songList.appendChild(addSongLi);

        dropdownMenu.appendChild(songList);
        songContainer.appendChild(dropdownMenu);

        // Toggle dropdown visibility
        artistDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdownMenu.style.display === 'block';
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.style.display = 'none';
            });
            dropdownMenu.style.display = isOpen ? 'none' : 'block';
        });

        container.appendChild(songContainer);
    });

    initializeGlobalClickHandler();
    hideAllMenus();
}

/**
 * Helper: Handle artist rename with inline editing
 */
function handleArtistRename(artistIdx, artistDiv, menu) {
    const currentName = artistDiv.textContent;
    const newName = prompt('Enter new artist name:', currentName);

    if (newName && newName.trim()) {
        appData[artistIdx].artist = newName.trim();
        appData.sort((a, b) => a.artist.toLowerCase().localeCompare(b.artist.toLowerCase()));
        saveData();
        renderUI();
    }

    menu.style.display = 'none';
}

/**
 * Helper: Handle song rename with inline editing
 */
function handleSongRename(artistIdx, songIdx, song, songLink) {
    const currentName = song.name;
    const newName = prompt('Enter new song name:', currentName);

    if (newName && newName.trim()) {
        const oldName = song.name;
        const trimmedName = newName.trim();

        appData[artistIdx].songs[songIdx].name = trimmedName;
        appData[artistIdx].songs.sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );

        // Update live songs
        const liIdx = liveSongs.indexOf(oldName);
        if (liIdx !== -1) {
            liveSongs[liIdx] = trimmedName;
        }
        if (liveSongsData[oldName]) {
            liveSongsData[trimmedName] = liveSongsData[oldName];
            delete liveSongsData[oldName];
        }

        saveData();
        renderUI();
    }
}

/**
 * ============================================
 * DARK MODE TOGGLE
 * ============================================
 */

async function darkMode() {
    try {
        const isDarkMode = document.body.classList.contains('dark-mode');
        document.body.classList.toggle('dark-mode');

        const darkBtn = document.getElementById('darkBtn');
        const textSpan = document.querySelector('#darkBtnSpan');

        if (!isDarkMode) {
            if (darkBtn && textSpan) {
                darkBtn.innerHTML = '☼';
                textSpan.textContent = 'Light Mode';
            }
        } else {
            if (darkBtn && textSpan) {
                darkBtn.innerHTML = '☾⋆';
                textSpan.textContent = 'Dark Mode';
            }
        }

        if (currentUser) {
            await firebase.firestore().collection('users').doc(currentUser).set({
                darkMode: !isDarkMode
            }, { merge: true });
        }
    } catch (error) {
        console.error('Error toggling dark mode:', error);
    }
}

/**
 * ============================================
 * LIVE SECTION & LOGOUT
 * ============================================
 */

async function liveSection() {
    if (liveSongs.length === 0) {
        alert('No songs in the Live section. Add songs from the home page first.');
        return;
    }

    localStorage.setItem(`liveSection_${currentUser}`, 'true');
    window.location.href = mainPageUrl;
}

window.liveSection = liveSection;

function logOut() {
    if (confirm('Are you sure you want to log out?')) {
        firebase.auth().signOut().catch((error) => {
            console.error("Error logging out:", error);
        });
    }
}

/**
 * ============================================
 * CHANGE PASSWORD
 * ============================================
 */

document.getElementById('changePasswordBtn').addEventListener('click', async function () {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const newPassword = prompt('Enter your new password (min 6 characters):');
        if (!newPassword) return;

        if (newPassword.length < 6) {
            alert('Password must be at least 6 characters long.');
            return;
        }

        await user.updatePassword(newPassword);
        alert('Password changed successfully!');
    } catch (error) {
        if (error.code === 'auth/requires-recent-login') {
            alert('Please log out and log back in before changing your password.');
        } else {
            alert('Error: ' + error.message);
        }
    }
});

/**
 * ============================================
 * LIVE SECTION HOVER & DRAG HANDLING
 * ============================================
 */

const liveBtnContainer = document.querySelector('.live-btn-container');
if (liveBtnContainer) {
    liveBtnContainer.addEventListener('click', async (e) => {
        // Only navigate if clicking the main Live button, not the dropdown toggle
        if (e.target.id === 'liveDropdownToggle' || e.target.closest('#liveDropdownToggle')) {
            return; // Let the dropdown toggle handler deal with it
        }

        if (e.target.id !== 'liveBtn') return;

        e.preventDefault();
        e.stopPropagation();

        // Navigate to main page with live section open
        if (liveSongs.length === 0) {
            alert('No songs in the Live section. Add songs from the home page first.');
            return;
        }

        localStorage.setItem(`liveSection_${currentUser}`, 'true');
        window.location.href = mainPageUrl;
    });

    // Toggle dropdown when clicking the 3-dot button
    const dropdownToggle = document.getElementById('liveDropdownToggle');
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dropdown = document.getElementById('liveDropdown');
            if (dropdown?.style.display === 'block') {
                hideLiveHover();
            } else {
                showLiveHover();
            }
        });
    }
};

liveBtnContainer.addEventListener('mouseout', () => {
    hideLiveHover();
});


document.querySelector('.container')?.addEventListener('touchstart', () => {
    hideLiveHover();
});

function showLiveHover() {
    const dropdown = document.getElementById('liveDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '';

    if (liveSongs.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'live-hover-item';
        emptyMsg.style.padding = '15px';
        emptyMsg.textContent = 'No songs in live section';
        dropdown.appendChild(emptyMsg);
        dropdown.style.display = 'block';
        return;
    }

    // Drag-enabled live songs list
    liveSongs.forEach((songName, idx) => {
        const item = document.createElement('div');
        item.className = 'live-hover-item';
        item.dataset.index = idx;

        const handle = document.createElement('span');
        handle.className = 'live-drag-handle';
        handle.textContent = '≡';

        const title = document.createElement('span');
        title.className = 'live-song-title';
        title.textContent = songName;

        // Desktop right click to remove from live
        item.addEventListener('contextmenu', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            liveSongs.splice(idx, 1);
            delete liveSongsData[songName];
            await saveData();
            renderUI();
            showLiveHover();
        });

        // Mobile long-press to remove from live
        let touchTimer;
        item.addEventListener('touchstart', () => {
            touchTimer = setTimeout(() => {
                item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
            }, 2000);
        });

        item.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
        });

        item.appendChild(handle);
        item.appendChild(title);

        item.draggable = false;
        handle.draggable = true;

        /* DESKTOP DRAGGING */
        // Drag events for reordering
        handle.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('dragging');
            window.draggedLiveIdx = idx;
        });

        handle.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            window.draggedLiveIdx = null;
        });

        handle.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.classList.add('drag-over');
        });

        handle.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        handle.addEventListener('drop', async (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            if (window.draggedLiveIdx !== null && window.draggedLiveIdx !== idx) {
                // Reorder live songs
                const draggedSong = liveSongs[window.draggedLiveIdx];
                liveSongs.splice(window.draggedLiveIdx, 1);
                liveSongs.splice(idx, 0, draggedSong);
                await saveData();
                showLiveHover();
            }
        });

        /* MOBILE DRAGGING (using touch events) */
        let touchStartY = 0;
        let isDragging = false;
        handle.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            isDragging = true;
            item.classList.add('dragging');
            window.draggedLiveIdx = idx;
        });

        handle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const touchY = e.touches[0].clientY;
            const deltaY = touchY - touchStartY;
            item.style.transform = `translateY(${deltaY}px)`;

            // Determine potential drop target
            const siblings = Array.from(dropdown.children);
            siblings.forEach(sib => sib.classList.remove('drag-over'));
            const hovered = siblings.find(sib => {
                const rect = sib.getBoundingClientRect();
                return touchY > rect.top && touchY < rect.bottom;
            });

            if (hovered && hovered !== item) {
                hovered.classList.add('drag-over');
            }
        });

        handle.addEventListener('touchend', () => {
            isDragging = false;
            item.classList.remove('dragging');
        });
        handle.addEventListener('touchend', async (e) => {
            const siblings = Array.from(dropdown.children);
            const hovered = siblings.find(sib => sib.classList.contains('drag-over'));
            if (window.draggedLiveIdx !== null && hovered && hovered !== item) {
                const hoveredIdx = parseInt(hovered.dataset.index);
                const draggedSong = liveSongs[window.draggedLiveIdx];
                liveSongs.splice(window.draggedLiveIdx, 1);
                liveSongs.splice(hoveredIdx, 0, draggedSong);
                await saveData();
                showLiveHover();
            }
            item.style.transform = '';
            siblings.forEach(sib => sib.classList.remove('drag-over'));
            window.draggedLiveIdx = null;
        });

        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}

function hideLiveHover() {
    const dropdown = document.getElementById('liveDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

// Initialize on load
renderUI();
initSearchBar();
