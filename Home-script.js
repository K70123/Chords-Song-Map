// --- Data Model and Persistence ---
const currentUser = localStorage.getItem('currentUser') || 'guest';
let appData = JSON.parse(localStorage.getItem(`chordAppData_${currentUser}`));
if (!Array.isArray(appData)) {
  appData = [];
}

function saveData() {
  localStorage.setItem(`chordAppData_${currentUser}`, JSON.stringify(appData));
}

// Load or initialize liveSongsData
let liveSongsData = JSON.parse(localStorage.getItem(`liveSongsData_${currentUser}`) || '{}');

// Changing the title
document.querySelector('#title').textContent = `🎵Welcome ${currentUser}🎵`;

// --- UI Rendering ---
function renderUI() {
  if (Array.isArray(appData) && appData.length > 0) {
    document.querySelector('.noArtist').style.display = 'none';
  }
  else{
    document.querySelector('.noArtist').style.display = 'block';
  }

  let lastTap = 0;
  const tapThreshold = 300; // max ms between taps to count as double-tap


  // Dark Mode
  const isDarkMode = localStorage.getItem(`darkMode_${currentUser}`) === 'true';
  const darkBtnSpan = document.querySelector('#darkBtnSpan');
  const darkBtnIcon = document.querySelector('#darkBtnIcon');
  if (darkBtnSpan && darkBtn) {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      darkBtnSpan.textContent = 'Light Mode';
      darkBtnIcon.textContent = '☼';
      darkBtnIcon.style.height = '62px';
      darkBtnIcon.style.width = '64.5px';
      if (window.innerWidth < 600) {
        darkBtnIcon.style.height = '36px';
        darkBtnIcon.style.width = '95px';
      }
    } 
    else {
    document.body.classList.remove('dark-mode');
    darkBtnSpan.textContent = 'Dark Mode';
    darkBtnIcon.textContent = '☾⋆';
    }
  }


  const container = document.querySelector('.container');
  container.innerHTML = '';
  appData.forEach((artistObj, artistIdx) => { /*artistObj is an object with artist name and songs array
    artistObj = { artist: 'Artist Name', songs: [{ name: 'Song 1', url: 'link1' }, { name: 'Song 2', url: 'link2' }] }
  */
    // Artist container
    const songContainer = document.createElement('div');
    songContainer.className = 'songContainer';

    // Top bar
    const topContainer = document.createElement('div');
    topContainer.className = 'topContainer';

    // Artist name
    const artistDiv = document.createElement('div');
    artistDiv.className = 'artist';
    artistDiv.textContent = artistObj.artist;

    // Dropdown arrow in a separate span
    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'artist-arrow';
    arrowSpan.textContent = ' ▼';
    artistDiv.appendChild(arrowSpan);

    topContainer.appendChild(artistDiv);

    // Right-click the artist name to show buttons
    artistDiv.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      // Hide all other containerBtn first
      document.querySelectorAll('.containerBtn').forEach(btn => {
      btn.style.display = 'none';
      });
      // Show this artist's buttons
      containerBtn.style.display = 'block';
    });

    // Double tap to show the artist name edit button
    artistDiv.addEventListener('touchstart', function (e) {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;

      if (tapLength < tapThreshold && tapLength > 0) {
      e.preventDefault();
      document.querySelectorAll('.containerBtn').forEach(btn => {
        btn.style.display = 'none';
      });
      // Show this artist's buttons
      containerBtn.style.display = 'block';
      }

      lastTap = currentTime;
    });

    // Artist buttons
    const containerBtn = document.createElement('div');
    containerBtn.className = 'containerBtn';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'containerRenameBtn';
    renameBtn.textContent = 'Rename';

    // Rename artist button
    renameBtn.onclick = () => {
      // Make artistDiv contenteditable, but not the arrowSpan
      artistDiv.contentEditable = 'true';
      arrowSpan.contentEditable = 'false';
      artistDiv.focus();

      // Move cursor to the end of the artist name (before the arrow)
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(artistDiv.firstChild, artistDiv.firstChild.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      // Prevent editing the arrowSpan
      function enforceNoArrowEdit() {
      // Remove any accidental edits to the arrow
      if (!artistDiv.textContent.endsWith(arrowSpan.textContent)) {
        artistDiv.textContent = artistDiv.textContent.replace(arrowSpan.textContent, '');
        artistDiv.appendChild(arrowSpan);
      }
      }

      artistDiv.addEventListener('input', enforceNoArrowEdit);

      function finishEdit() {
      artistDiv.removeEventListener('input', enforceNoArrowEdit);
      artistDiv.contentEditable = 'false';
      // Save new name (without the arrow)
      const newName = artistDiv.textContent.replace(arrowSpan.textContent, '').trim() || 'Unknown';
      appData[artistIdx].artist = newName;
      saveData();
      renderUI();
      }

      artistDiv.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit();
      }
      });

      artistDiv.addEventListener('blur', finishEdit, { once: true });
    };


    // Artist delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'containerDeleteBtn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      if (confirm('Delete this artist and all songs?\n(This action cannot be undone)')) {
        const artistSongs = appData[artistIdx].songs.map(song => song.name); // get song names

        // Get current live songs
        let liveSongsRaw = localStorage.getItem(`liveSongs_${currentUser}`);
        let liveSongs = [];
        if (liveSongsRaw && liveSongsRaw !== "undefined") {
          liveSongs = JSON.parse(liveSongsRaw);
          // Filter out songs that no longer exist in appData
          liveSongs = liveSongs.filter(songName =>
            appData.some(artist => artist.songs.some(song => song.name === songName))
          );
          // Save the filtered list back to localStorage if changed
          localStorage.setItem(`liveSongs_${currentUser}`, JSON.stringify(liveSongs));
        }

        // Remove from liveSongsData
        let liveSongsDataObj = {};
        const liveSongsDataRaw = localStorage.getItem(`liveSongsData_${currentUser}`);
        if (liveSongsDataRaw && liveSongsDataRaw !== "undefined") {
          liveSongsDataObj = JSON.parse(liveSongsDataRaw);
        }
        // Remove from liveSongsData
        artistSongs.forEach(song => {
          delete liveSongsDataObj[song];
        });
        localStorage.setItem(`liveSongsData_${currentUser}`, JSON.stringify(liveSongsDataObj));

        
        appData.splice(artistIdx, 1);
        saveData();
        renderUI();
      }
    };


    // Hide all containerBtn when clicking outside of .containerBtn or .artist
    document.addEventListener('click', function(e) {
    if (!e.target.closest('.containerBtn') && !e.target.classList.contains('artist')) {
      document.querySelectorAll('.containerBtn').forEach(btn => {
        btn.style.display = 'none';
      });
    }
  });


    containerBtn.appendChild(renameBtn);
    containerBtn.appendChild(deleteBtn);
    topContainer.appendChild(containerBtn);

    songContainer.appendChild(topContainer);


    // Dropdown menu
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'dropdown-menu';

    const songList = document.createElement('ul');
    songList.className = 'songList';

    artistObj.songs.forEach((song, songIdx) => {
      const songItem = document.createElement('li');
      songItem.className = 'songItem';

      const songName = document.createElement('span');
      songName.className = 'songName';

      const songLink = document.createElement('a');
      songLink.className = 'songLink';
      songLink.textContent = song.name;
      songLink.href = song.url;

      songName.appendChild(songLink);
      songItem.appendChild(songName);

      // Add click event to update the current song title
      songLink.onclick = (e) => {
        e.preventDefault(); // Prevent default link behavior
        localStorage.setItem(`currentSongTitle_${currentUser}`, song.name);
        window.location.href = song.url; // Navigate to the song URL
      };

      // Song edit buttons
      const editBtn = document.createElement('span');
      editBtn.className = 'editBtn';

      // Rename song button
      const renameSongBtn = document.createElement('button');
      renameSongBtn.className = 'renameBtn';
      renameSongBtn.textContent = '✏️';
      renameSongBtn.onclick = () => {
        // Temporarily store href and disable the link
        const originalHref = songLink.getAttribute('href');
        songLink.removeAttribute('href');
        songLink.style.pointerEvents = 'none';
        songLink.setAttribute('contenteditable', 'true');
        songLink.focus();

        // Select all text inside the link
        const range = document.createRange();
        range.selectNodeContents(songLink);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        function restore() {
          songLink.removeAttribute('contenteditable');
          const newName = songLink.textContent.trim() || 'Untitled';
          songLink.setAttribute('href', originalHref);

          // Store the index of the artist whose dropdown should be open
          localStorage.setItem(`openDropdownArtistIdx_${currentUser}`, artistIdx);

          // Update the song name
          appData[artistIdx].songs[songIdx].name = newName;

          // Sort songs alphabetically by name (case-insensitive)
          appData[artistIdx].songs.sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          );

          saveData();
          renderUI();
        }
        songLink.addEventListener('blur', restore);
        songLink.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault(); // prevent newline
          songLink.blur(); // trigger blur to save
          }
        });
      };

      // Delete song button
      const deleteSongBtn = document.createElement('button');
      deleteSongBtn.className = 'deleteBtn';
      deleteSongBtn.textContent = '🗑️';
      deleteSongBtn.onclick = () => {
        if (confirm('Delete this song?\n (This action cannot be undone)')) {
          // Store the song name before removing it from the array
          const songName = song.name;
          appData[artistIdx].songs.splice(songIdx, 1);

          // Remove the song from live songs if it exists
          let liveSongsRaw = localStorage.getItem(`liveSongs_${currentUser}`);
          let liveSongs = [];
          if (liveSongsRaw && liveSongsRaw !== "undefined") {
            liveSongs = JSON.parse(liveSongsRaw);
            // Filter out songs that no longer exist in appData
            liveSongs = liveSongs.filter(songName =>
              appData.some(artist => artist.songs.some(song => song.name === songName))
          );
          // Save the filtered list back to localStorage if changed
          localStorage.setItem(`liveSongs_${currentUser}`, JSON.stringify(liveSongs));
        }

          // Also remove from liveSongsData
          const liveSongsDataRaw = localStorage.getItem(`liveSongsData_${currentUser}`);
          let liveSongsDataObj = {};
          if (liveSongsDataRaw && liveSongsDataRaw !== "undefined") {
            liveSongsDataObj = JSON.parse(liveSongsDataRaw);
          }
          delete liveSongsDataObj[songName];
          localStorage.setItem(`liveSongsData_${currentUser}`, JSON.stringify(liveSongsDataObj));


          // Remember which dropdown should stay open
          saveData();

          // Store the index of the artist whose dropdown should be open
          localStorage.setItem(`openDropdownArtistIdx_${currentUser}`, artistIdx);

          renderUI();
        }
      };

      // Add to live button
      const addToLiveBtn = document.createElement('button');
      addToLiveBtn.className = 'addToLiveBtn';
      addToLiveBtn.textContent = '🔴';
      addToLiveBtn.onclick = () => {
        // Get current live songs from localStorage or start with an empty array
        let liveSongsRaw = localStorage.getItem(`liveSongs_${currentUser}`);
        let liveSongs = [];
        if (liveSongsRaw && liveSongsRaw !== "undefined") {
          liveSongs = JSON.parse(liveSongsRaw);
          // Filter out songs that no longer exist in appData
          liveSongs = liveSongs.filter(songName =>
            appData.some(artist => artist.songs.some(song => song.name === songName))
          );
          // Save the filtered list back to localStorage if changed
          localStorage.setItem(`liveSongs_${currentUser}`, JSON.stringify(liveSongs));
        }
        // Add the new song if not already in the list
        if (!liveSongs.includes(song.name)) {
        liveSongs.push(song.name);
        } 
        // Save back to localStorage
        localStorage.setItem(`liveSongs_${currentUser}`, JSON.stringify(liveSongs));

        // Remember which dropdown should stay open
        saveData();

        // Store the index of the artist whose dropdown should be open
        localStorage.setItem(`openDropdownArtistIdx_${currentUser}`, artistIdx);

        renderUI();

      }

      editBtn.appendChild(renameSongBtn);
      editBtn.appendChild(deleteSongBtn);
      editBtn.appendChild(addToLiveBtn);
      songItem.appendChild(editBtn);

      songList.appendChild(songItem);

      // Hold tap the song name to show edit buttons
      songName.addEventListener('touchstart', function (e) {
        // Start the timer
        holdTimeout = setTimeout(() => {
          e.preventDefault(); // Prevent default link behavior
        }, 100);
      });
    });


    // Add New Song button
    const addSongLi = document.createElement('li');
    const newSongBtn = document.createElement('button');
    newSongBtn.className = 'newSongBtn';
    newSongBtn.textContent = 'Add New Song';
    newSongBtn.onclick = () => {
    // Add new song
    appData[artistIdx].songs.push({ name: 'Untitled', url: 'Main Page.html' });

    // Sort songs alphabetically by name (case-insensitive)
    appData[artistIdx].songs.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    saveData();
    // Store the index of the artist whose dropdown should be open
    localStorage.setItem(`openDropdownArtistIdx_${currentUser}`, artistIdx);
    renderUI();
  };


    addSongLi.appendChild(newSongBtn);
    songList.appendChild(addSongLi);

    dropdownMenu.appendChild(songList);
    songContainer.appendChild(dropdownMenu);

    container.appendChild(songContainer);

    
    // Dropdown toggle
    artistDiv.onclick = () => {
      dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== dropdownMenu) menu.style.display = 'none';
      });
    };

    artistDiv.ontouchstart = () => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTap;

      if (timeDiff < tapThreshold && timeDiff > 0) {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        // Close other dropdowns
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
          if (menu !== dropdownMenu) menu.style.display = 'none';
        });
      }
      lastTap = currentTime;
    }
    
  });


  // Restore the open dropdown if it was saved
  const openIdx = localStorage.getItem(`openDropdownArtistIdx_${currentUser}`);
  if (openIdx !== null) {
    // Find the nth .dropdown-menu and open it
    const dropdowns = document.querySelectorAll('.dropdown-menu');
  if (dropdowns[openIdx]) {
    dropdowns[openIdx].style.display = 'block';
  }
  // Remove the marker so it doesn't affect other actions
  localStorage.removeItem(`openDropdownArtistIdx_${currentUser}`);
  }
}


// Hide all dropdown menus when clicking outside of .dropdown-menu or .artist
document.addEventListener('click', function(e) {
  if (!e.target.closest('.dropdown-menu') && !e.target.classList.contains('artist')) {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  }
});


// --- Add New Artist Button ---
document.getElementById('addArtistBtn').addEventListener('click', function(){
  appData.push({ artist: 'Unknown Artist', songs: [] });
  saveData();
  renderUI();
});


// --- Initial Render ---
renderUI();


// --- Dark Mode ---
function darkMode(){
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  const iconSpan = document.querySelector('#darkBtnIcon');
  const textSpan = document.querySelector('#darkBtnSpan');
  if (iconSpan && textSpan) {
    if (isDarkMode) {
      iconSpan.textContent = '☼';
      textSpan.textContent = 'Light Mode';
      iconSpan.style.height = '62px';
      iconSpan.style.width = '64.5px';
      if (window.innerWidth < 600) {
        iconSpan.style.height = '36px';
        iconSpan.style.width = '95px';
      }
    } else {
      iconSpan.textContent = '☾⋆';
      textSpan.textContent = 'Dark Mode';
      iconSpan.style.height = '70px';
      iconSpan.style.width = '70px';
      if (window.innerWidth < 600) {
        iconSpan.style.height = '42px';
        iconSpan.style.width = '102px';
      }
    }
  localStorage.setItem(`darkMode_${currentUser}`, isDarkMode);
  }
}


// --- Go To Live Section ---
function liveSection() {
  // Count total number of songs
  const totalSongs = appData.reduce((sum, artist) => {
    return sum + (Array.isArray(artist.songs) ? artist.songs.length : 0);
  }, 0);

  if (totalSongs > 0) {
    window.location.href = "Main Page.html";
    localStorage.setItem(`liveSection_${currentUser}`, 'true');
  }
}


// --- Log Out ---
function logOut() {
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('currentUser');
  window.location.href = "index.html";
}
