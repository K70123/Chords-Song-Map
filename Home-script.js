// --- Data Model and Persistence ---
let appData = JSON.parse(localStorage.getItem('chordAppData'));
if (!Array.isArray(appData)) {
  appData = [];
}

function saveData() {
  localStorage.setItem('chordAppData', JSON.stringify(appData));
}

// --- UI Rendering ---
function renderUI() {
  // Dark Mode
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  const darkBtnSpan = document.querySelector('#darkBtnSpan');
  const darkBtnIcon = document.querySelector('#darkBtnIcon');
  if (darkBtnSpan && darkBtn) {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      darkBtnSpan.textContent = 'Light Mode';
      darkBtnIcon.textContent = '☼';
      darkBtnIcon.style.height = '62px';
      darkBtnIcon.style.width = '64.5px';
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
    artistDiv.textContent = artistObj.artist + ' ▼';
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


    // Artist buttons
    const containerBtn = document.createElement('div');
    containerBtn.className = 'containerBtn';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'containerRenameBtn';
    renameBtn.textContent = 'Rename';


    // Rename artist button
    renameBtn.onclick = () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = artistObj.artist;
      input.className = 'artistInput';
      artistDiv.replaceWith(input);
      input.focus();

      // Mirror for width
      const mirror = document.createElement('span');
      mirror.className = 'artistInput-mirror';
      document.body.appendChild(mirror);
      function updateInputWidth() {
        mirror.textContent = input.value || ' ';
        input.style.width = (mirror.offsetWidth) + 'px';
      }
      updateInputWidth();
      input.addEventListener('input', updateInputWidth);

      function restore() {
        appData[artistIdx].artist = input.value.trim() || 'Unknown';

        saveData();
        renderUI();
        document.body.removeChild(mirror);
      }
      input.addEventListener('keydown', e => {
         if (e.key === 'Enter') restore();
        });
      input.addEventListener('blur', restore);
    };


    // Artist delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'containerDeleteBtn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      if (confirm('Delete this artist and all songs?\n(This action cannot be undone)')) {
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
        localStorage.setItem('currentSongTitle', song.name);
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
        const input = document.createElement('input');
        input.type = 'text';
        input.value = song.name;
        input.className = 'linkInput';
        songLink.replaceWith(input);
        input.focus();

        // Mirror for width
        const mirror = document.createElement('span');
        mirror.className = 'linkInput-mirror';
        document.body.appendChild(mirror);
        function updateInputWidth() {
          mirror.textContent = input.value || ' ';
          input.style.width = (mirror.offsetWidth) + 'px';
        }
        updateInputWidth();
        input.addEventListener('input', updateInputWidth);

        function restore() {
          // Store the index of the artist whose dropdown should be open
          localStorage.setItem('openDropdownArtistIdx', artistIdx);

          // Update the song name
          appData[artistIdx].songs[songIdx].name = input.value.trim() || 'Untitled';

          // Sort songs alphabetically by name (case-insensitive)
          appData[artistIdx].songs.sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          );

          document.body.removeChild(mirror);
          saveData();
          renderUI();
        }
        input.addEventListener('blur', restore);
      };

      // Delete song button
      const deleteSongBtn = document.createElement('button');
      deleteSongBtn.className = 'deleteBtn';
      deleteSongBtn.textContent = '🗑️';
      deleteSongBtn.onclick = () => {
        if (confirm('Delete this song?\n (This action cannot be undone)')) {
          appData[artistIdx].songs.splice(songIdx, 1);

          // Remove the song from live songs if it exists
          const songName = song.name;
          let liveSongsRaw = localStorage.getItem('liveSongs');
          let liveSongs = [];
          if (liveSongsRaw && liveSongsRaw !== "undefined") {
            liveSongs = JSON.parse(liveSongsRaw);
          }
          liveSongs = liveSongs.filter(liveSong => liveSong !== songName);
          localStorage.setItem('liveSongs', JSON.stringify(liveSongs));

          // Remember which dropdown should stay open
          saveData();

          // Store the index of the artist whose dropdown should be open
          localStorage.setItem('openDropdownArtistIdx', artistIdx);

          renderUI();
        }
      };

      // Add to live button
      const addToLiveBtn = document.createElement('button');
      addToLiveBtn.className = 'addToLiveBtn';
      addToLiveBtn.textContent = '🔴';
      addToLiveBtn.onclick = () => {
        // Get current live songs from localStorage or start with an empty array
        let liveSongsRaw = localStorage.getItem('liveSongs');
        let liveSongs = [];
        if (liveSongsRaw && liveSongsRaw !== "undefined") {
          liveSongs = JSON.parse(liveSongsRaw);
        }
        // Add the new song if not already in the list
        if (!liveSongs.includes(song.name)) {
        liveSongs.push(song.name);
        } 
        // Save back to localStorage
        localStorage.setItem('liveSongs', JSON.stringify(liveSongs));

        // Remember which dropdown should stay open
        saveData();

        // Store the index of the artist whose dropdown should be open
        localStorage.setItem('openDropdownArtistIdx', artistIdx);

        renderUI();

      }

      editBtn.appendChild(renameSongBtn);
      editBtn.appendChild(deleteSongBtn);
      editBtn.appendChild(addToLiveBtn);
      songItem.appendChild(editBtn);

      songList.appendChild(songItem);
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
    localStorage.setItem('openDropdownArtistIdx', artistIdx);
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
  });


  // Restore the open dropdown if it was saved
  const openIdx = localStorage.getItem('openDropdownArtistIdx');
  if (openIdx !== null) {
    // Find the nth .dropdown-menu and open it
    const dropdowns = document.querySelectorAll('.dropdown-menu');
  if (dropdowns[openIdx]) {
    dropdowns[openIdx].style.display = 'block';
  }
  // Remove the marker so it doesn't affect other actions
  localStorage.removeItem('openDropdownArtistIdx');
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
    } else {
      iconSpan.textContent = '☾⋆';
      textSpan.textContent = 'Dark Mode';
      iconSpan.style.height = '70px';
      iconSpan.style.width = '70px';
    }
  localStorage.setItem('darkMode', isDarkMode);
  }
}


// --- Go To Live Section ---
function liveSection() {
  window.location.href = " Main Page.html";
  localStorage.setItem('liveSection', 'true'); // Set a flag to indicate we're in the live section
}