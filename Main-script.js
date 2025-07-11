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

let appData = []; // Initialize globally, will be populated by Firestore
let currentUser = null; // Will store the user UID

let currentArtistIndex = -1;
let currentSongIndex = -1;
let currentSongData = null;

let liveSongs = [];
let liveSongsData = {};

let beatsPerBar = 4;
let chordsPerRow = 6;

// --- Data Model and Persistence ---
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html"; // Redirect to login if not authenticated
    return;
  }

  currentUser = user.uid; // Set currentUser UID
  console.log("Authenticated user:", currentUser);

  try {
    const doc = await firebase.firestore().collection('users').doc(currentUser).get();

    // Dark mode loading
    if (doc.exists) {
      const userData = doc.data();
      appData = userData.appData || []; // Load appData into your global variable
      liveSongs = userData.liveSongs || []; // Load liveSongs into your global variable
      liveSongsData = userData.liveSongsData || {}; // Load liveSongsData into your global variable
      const isDarkMode = userData.darkMode === true; // Load darkMode state

      const darkBtn = document.querySelector('#darkBtn');

      if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkBtn.textContent = '☼';
      }
      else {
        document.body.classList.remove('dark-mode');
        darkBtn.textContent = '☾⋆';
      }
    } 
    else {
      appData = []; // Default to empty array if no user data found
      liveSongs = []; // Default to empty array if no live songs found
      document.body.classList.remove('dark-mode'); // Default to light mode if no data
    }

    renderUI(); // Render UI after all data (appData and dark mode) is loaded
    document.body.classList.remove('loading'); // Remove loading class to show content
  } 
  catch (error) {
    console.error("Error loading user data from Firestore:", error);
    // Potentially redirect to an error page or show a user-friendly message
  }
});


// Save data to Firestore
async function saveData() {
  if (!currentUser) { // Ensure currentUser is available
    console.error("User not logged in, cannot save data.");
    return;
  }
  // Add a defensive check here to ensure appData is an array before saving
  if (!Array.isArray(appData)) {
      console.error("appData is not an array, cannot save:", appData);
      appData = []; // Reset to empty array to prevent future errors
  }

  try {
    await firebase.firestore().collection('users').doc(currentUser).set({
      appData: appData, // THIS refers to the global `appData` variable
      liveSongs: liveSongs,
      liveSongsData: liveSongsData
    }, { merge: true });  
  } 
  catch (error) {
    console.error("Error saving app data to Firestore:", error);
  }
}


window.keyList = [
  'A', 'A#', 'Bb', 'B', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'Num'
];

let nextChordFocus = null; // To track the next chord to focus after editing
let nextSongMapFocusIdx = null; // To track the next song map part to focus after editing

localStorage.setItem(`nashvilleMode_${currentUser}`, 'false');

// --- UI Rendering ---
function renderUI() {
  let lastTap = 0;
  const dblTapThreshold = 300; // max ms between taps to count as double-tap
  const holdTapThreshold = 350; // min ms time to count as hold tap

  const buttons = document.querySelectorAll('.menuBtn');
  const menu = document.querySelector('.menu');

  if (window.innerWidth < 600){
    buttons.forEach(button => {
    button.style.display = 'none';
    button.style.fontSize = '18px';
    button.style.margin = '0';
    document.getElementById('hideShowBtn').style.display = 'block'
    });
    menu.style.width = '20px';
    menu.style.height = '22px';
  }

  // Left Container
  const leftContainer = document.querySelector('.leftContainer');
  leftContainer.innerHTML = ''; // Clear previous content

  const liveTitle = document.createElement('div');
  liveTitle.className = 'liveTitle';
  liveTitle.textContent = 'Live Song ▼';
  leftContainer.appendChild(liveTitle);

  const liveContainer = document.createElement('div');
  liveContainer.className = 'liveContainer';
  leftContainer.appendChild(liveContainer);

  // Always show the liveContainer when rendering UI
  liveContainer.style.display = 'block';

  // Use the static dropdown-menu if it exists, otherwise create it
  let dropdownMenu = document.querySelector('.dropdown-menu');
  if (!dropdownMenu) {
    dropdownMenu = document.createElement('ul');
    dropdownMenu.className = 'dropdown-menu';
    liveContainer.appendChild(dropdownMenu);
  }
  dropdownMenu.innerHTML = ''; // Clear previous content

  liveSongs.forEach(songName => {
    const li = document.createElement('li');
    li.className = 'songName';
    li.textContent = songName;
    dropdownMenu.appendChild(li);

    // Add click event to each song name
    li.addEventListener('click', function() {
      localStorage.setItem(`currentSongTitle_${currentUser}`, songName);
      if (title) title.textContent = songName; // Update the title
      liveContainer.style.display = 'none'; // Hide the dropdown after selection
      const rightContainer = document.querySelector('.rightContainer');
      if (rightContainer) rightContainer.innerHTML = `<div class="chordsContainer"></div>`;

      saveData(); // Save the current song title
      renderUI(); // Re-render UI to reflect changes
    });

    // Remove live songs from localStorage on right-click
    li.addEventListener('contextmenu', async function(e) {
      e.preventDefault();
      // Remove the right-clicked song from the liveSongs array
      liveSongs = liveSongs.filter(name => name !== songName);

      // Remove this song from liveSongsData
      delete liveSongsData[songName];
      // Remove the song from the dropdown menu
      li.remove();
      await saveData(); // Save the updated liveSongs and liveSongsData
    });

    li.addEventListener('touchstart', async function (e) {
      // Start the timer
      holdTimeout = setTimeout(() => {
        e.preventDefault();
        // Remove the right-clicked song from the liveSongs array
        liveSongs = liveSongs.filter(name => name !== songName);

        // Remove this song from liveSongsData
        delete liveSongsData[songName];
        // Remove the song from the dropdown menu
        li.remove();
      }, holdTapThreshold);
      await saveData(); // Save the updated liveSongs and liveSongsData
    });

    li.addEventListener('touchend', function () {
      // Cancel if released early
      clearTimeout(holdTimeout);
    });

    li.addEventListener('touchmove', function () {
      // Cancel if they move finger
      clearTimeout(holdTimeout);
    });
  });

  let title = document.querySelector('.title');


  // Double-click to display all live songs and set the title
  liveTitle.addEventListener('dblclick', function() {
    localStorage.setItem(`openMapForSong_${currentUser}`, null);
    showAllLiveSongsAndSections();
  });

  let holdTimeout = null;
  // Hold-Tap to display all live songs and set the title
  liveTitle.addEventListener('touchstart', function () {
    // Start the timer
    holdTimeout = setTimeout(() => {
      // If the user holds long enough, do this:
      localStorage.setItem(`openMapForSong_${currentUser}`, null);
      document.querySelector('.title').style.display = 'none';
      showAllLiveSongsAndSections();
    }, holdTapThreshold);
  });

  liveTitle.addEventListener('touchend', function () {
    // Cancel if released early
    clearTimeout(holdTimeout);
  });

  liveTitle.addEventListener('touchmove', function () {
    // Cancel if they move finger
    clearTimeout(holdTimeout);
  });

  
  function showAllLiveSongsAndSections() {
    const rightContainer = document.querySelector('.rightContainer');
    rightContainer.innerHTML = "";

    const liveRightContainer = document.createElement('div');
    liveRightContainer.className = 'liveRightContainer'
    rightContainer.appendChild(liveRightContainer);

    const songMapContainer = document.querySelector('.songMapContainer');
    if (songMapContainer.style.display === 'block'){
      songMapContainer.style.display = 'none';
    }

    // Song Map Container
    const liveSongMapContainer = document.createElement('div');
    liveSongMapContainer.className = 'liveSongMapContainer';
    liveRightContainer.appendChild(liveSongMapContainer);

    // Title
    const songMapTitle = document.createElement('div');
    songMapTitle.className = 'songMapTitle';
    songMapTitle.textContent = 'Song Map';
    liveSongMapContainer.appendChild(songMapTitle);
   

  // Find and render each live song
  liveSongs.forEach(songName => {
    let songObj = null;
    for (const artistObj of appData) {
      const originalSongObj = artistObj.songs.find(song => song.name === songName);
      if (!originalSongObj) continue;
      // Use live data if it exists, otherwise clone the original
      if (liveSongsData[songName] !== undefined) {
          songObj = liveSongsData[songName]; // Use the actual object, not a copy!
      }
      else {
        songObj = JSON.parse(JSON.stringify(originalSongObj));
        if (!Array.isArray(songObj.songMap) || songObj.songMap.length === 0) {
          songObj.songMap = Array.isArray(originalSongObj.songMap)
          ? [...originalSongObj.songMap]
          : [];
        }
        liveSongsData[songName] = songObj; // Save the copy for future edits
      }
      break;
    }
    if (!songObj){
      console.warn(`Live song "${songName}" not found in appData. It might have been deleted.`);
      return;
    }
    // --- Restore focus on nextChord or nextSongMapPart in live view ---
    setTimeout(() => {
      if (nextChordFocus) {
        const section = document.querySelectorAll('.songSectionContainer')[nextChordFocus.sectionIdx];
        if (section) {
          const chord = section.querySelectorAll('.chord')[nextChordFocus.chordIdx];
          if (chord) {
            chord.contentEditable = true;
            chord.focus();
            document.execCommand('selectAll', false, null);
          }
        }
        nextChordFocus = null;
      }

      if (nextSongMapFocusIdx !== null) {
        const part = document.querySelectorAll('.songMapPart')[nextSongMapFocusIdx];
        if (part) {
          part.contentEditable = true;
          part.focus();
          document.execCommand('selectAll', false, null);
        }
        nextSongMapFocusIdx = null;
      }
    }, 0);  
    if (songObj) {
      // Show Song Map
      function showSongMap(songObj, songMapList, changeSongMapBtn, addPartBtn, e) {
        document.querySelector('.warning').style.display = 'none';

        if (!liveSongsData[songObj.name]) {
          liveSongsData[songObj.name] = JSON.parse(JSON.stringify(songObj));
        }

        document.querySelectorAll('.liveSongMapContainer .songMapList').forEach(list => {
          list.style.display = 'none';
        });

        songMapList.style.display = 'block';
        
        // Remove color from all buttons
        document.querySelectorAll('.changeSongMapBtn').forEach(b => 
        b.classList.remove('changeSongMapBtnColor'));

        // Add color to the clicked button
        (e?.target || changeSongMapBtn).classList.add('changeSongMapBtnColor');

        songMapList.innerHTML = '';
        if (songObj && Array.isArray(songObj.songMap)) {
          songObj.songMap.forEach(part => {
            const li = document.createElement('li');
            li.className = 'songMapPart';
            li.textContent = part;
            songMapList.appendChild(li);
          });
          attachSongMapPartListeners(songObj, songMapList);
        }   

        // Add Song Map Part Button
        if (addPartBtn) { 
          const newAddPartBtn = addPartBtn.cloneNode(true);
          addPartBtn.replaceWith(newAddPartBtn);
          newAddPartBtn.addEventListener('click', async function() {
            if (songObj) {
              if (!Array.isArray(songObj.songMap)) {
                songObj.songMap = [];
              }
              songObj.songMap.push("Unknown");
              // Remebers which song map list to open
              localStorage.setItem(`openMapForSong_${currentUser}`, songObj.name);
              await saveData(); // Save the updated liveSongsData
              showAllLiveSongsAndSections();
            }
          });
        }
      };


      function attachSongMapPartListeners(songObj, songMapList) {
        const songMapParts = songMapList.querySelectorAll('.songMapPart');
        songMapParts.forEach(part => {
          part.addEventListener('dblclick', function (e) {
            e.preventDefault();
            part.contentEditable = true;
            part.focus();
            document.execCommand('selectAll', false, null);
            nextChordFocus = null;
          });
          // Double tap to show the artist name edit button
          part.addEventListener('touchend', function () {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;

            if (tapLength < dblTapThreshold && tapLength > 0) {
              part.contentEditable = true;
              part.focus();
              // Select all text of the part
              document.execCommand('selectAll', false, null);
              nextChordFocus = null;
            }
            lastTap = currentTime;
          });

            part.addEventListener('keydown', function(e) {
              if (e.key === 'Enter') {
                e.preventDefault();
                const allParts = Array.from(document.querySelectorAll('.songMapPart'));
                const idx = allParts.indexOf(part);
                if (idx !== -1 && idx + 1 < allParts.length) {
                  nextSongMapFocusIdx = idx + 1;
                } else {
                  nextSongMapFocusIdx = null;
                }
                setTimeout(() => part.blur(), 0);
              }
            });

          part.addEventListener('blur', async function () {
            part.contentEditable = false;
            const allParts = Array.from(songMapList.querySelectorAll('.songMapPart'));
            const idx = allParts.indexOf(part);
            if (songObj && songObj.songMap) {
              songObj.songMap[idx] = part.textContent.trim();
              if (part.textContent.trim() === '') {
                songObj.songMap.splice(idx, 1);
                part.remove(); // Remove the empty part from the DOM
              }
              localStorage.setItem(`openMapForSong_${currentUser}`, songObj.name);
              await saveData(); // Save the updated liveSongsData
              showAllLiveSongsAndSections();
            }
          });
        });

        const parts = songMapList.querySelectorAll('.songMapPart');

        // --- Desktop ---
        parts.forEach(part => {
        part.setAttribute('draggable', 'true');

        part.addEventListener('dragstart', function(e) {
          e.dataTransfer.effectAllowed = 'move';
          part.classList.add('dragging');
          window.draggedPart = part;
        });
        part.addEventListener('dragend', async function() {
          part.classList.remove('dragging');
          window.draggedPart = null;
          const reorderedParts = Array.from(songMapList.querySelectorAll('.songMapPart'))
          .map(p => p.textContent.trim());

          songObj.songMap = reorderedParts;

          liveSongsData[songObj.name] = songObj;
          await saveData(); // Save the updated liveSongsData
        });

        // --- Mobile: touch-based drag ---
        let startY = 0;
        part.addEventListener('touchstart', function (e) {
          e.preventDefault();
          window.draggedPart = part;
          part.classList.add('dragging');
          startY = e.touches[0].clientY;
        });

        part.addEventListener('touchmove', function (e) {
          e.preventDefault();
          const touchY = e.touches[0].clientY;
          const afterElement = getDragAfterElement(songMapList, touchY);
          const dragging = document.querySelector('.dragging');
          if (afterElement == null) {
            songMapList.appendChild(dragging);
          } else {
            songMapList.insertBefore(dragging, afterElement);
          }
        });

        part.addEventListener('touchend', function () {
          const dragging = document.querySelector('.dragging');
          if (dragging) {
            dragging.classList.remove('dragging');
            window.draggedPart = null;
            saveSongMapOrder();
          }
        });
      });

      // --- Desktop Dragover ---
      songMapList.addEventListener('dragover', function(e) {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (!dragging) return;
          const afterElement = getDragAfterElement(songMapList, e.clientY);
        if (afterElement == null) {
          songMapList.appendChild(dragging);
        } 
        else {
          songMapList.insertBefore(dragging, afterElement);
        }
      });

      function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.songMapPart:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
          }   
          else {
            return closest;
          }
        }, { offset: -Infinity }).element;
      }

      // --- Save the new order ---
      async function saveSongMapOrder() {
        const reorderedParts = Array.from(songMapList.querySelectorAll('.songMapPart'))
          .map(p => p.textContent.trim());

          songObj.songMap = reorderedParts;
          liveSongsData[songObj.name] = songObj;
          await saveData(); // Save the updated liveSongsData
      }
    }
        

      // Container for song title and changeSongMapBtn
      const topContainer = document.createElement('div');
      topContainer.className = 'topContainer';
      if (window.innerWidth < 600) {
        topContainer.style.justifyContent = 'left';
        topContainer.style.paddingLeft = '40px';
      }
      liveRightContainer.appendChild(topContainer);

      // Song title
      const songTitle = document.createElement('div');
      songTitle.className = 'title';
      songTitle.textContent = songObj.name;
      topContainer.appendChild(songTitle);

      // Add Part Button
      if (!liveSongMapContainer.querySelector('.addPartBtn')){
        const addPartBtn = document.createElement('button');
        addPartBtn.className = 'addPartBtn';
        addPartBtn.textContent = '+';
        liveSongMapContainer.appendChild(addPartBtn);

        // Warning (or whatever you want to call it)
        const warning = document.createElement('div');
        warning.style.fontSize = '30px';
        if (window.innerWidth < 600) {
          warning.style.fontSize = '13px';
        }
        warning.className = 'warning'
        warning.textContent = 'No Song Map Displayed'
        liveSongMapContainer.appendChild(warning);
      }
      const addPartBtn = liveSongMapContainer.querySelector('.addPartBtn');

      // Unique list
      const songMapList = document.createElement('ul');
      songMapList.className = 'songMapList';
      songMapList.dataset.songName = songObj.name;
      liveSongMapContainer.insertBefore(songMapList, addPartBtn);

      // Change Song Map Button
      const changeSongMapBtn = document.createElement('button');
      changeSongMapBtn.className = 'changeSongMapBtn';
      changeSongMapBtn.textContent = '🗺️';
      topContainer.insertBefore(changeSongMapBtn, songTitle);
      changeSongMapBtn.onclick = function() {
        localStorage.setItem(`openMapForSong_${currentUser}`, songObj.name);
        showAllLiveSongsAndSections();
      };

      const openMapForSong = localStorage.getItem(`openMapForSong_${currentUser}`);
      if (openMapForSong === songObj.name || openMapForSong === 'null') {
        showSongMap(songObj, songMapList, changeSongMapBtn, addPartBtn);
        localStorage.removeItem(`openMapForSong_${currentUser}`);
      }


      // ChordsContainer
      const chordsContainer = document.createElement('div');
      chordsContainer.className = 'chordsContainer';
      liveRightContainer.appendChild(chordsContainer);

      // Original key
      const originalKeySpan = document.createElement('span');
      originalKeySpan.className = 'originalKey';
      const oriKey = songObj.originalKey || 'Unknown';
      if (originalKeySpan) {
        originalKeySpan.textContent = "Original Key: " + oriKey; // Display the original key
      }
      chordsContainer.appendChild(originalKeySpan);


      // Beats per bar
      const beatDisplay = document.createElement('span');
      beatDisplay.innerHTML = `Beats Per Bar: <span class="beatSpan">${songObj?.beatsPerBar || '4'}</span>`;
      beatDisplay.style.fontSize = '30px';
      if (window.innerWidth < 600) {
        beatDisplay.style.fontSize = '13px';
      }
      chordsContainer.appendChild(beatDisplay);

      // Add the chordsperrow span
      const chordsPerRowSpan = document.createElement('span');
      chordsPerRowSpan.innerHTML = `Chords Per Row: <span class="chordsPerRow">${songObj?.chordsPerRow || '4'}</span>`;
      chordsPerRowSpan.style.fontSize = '30px';
      if (window.innerWidth < 600) {
        chordsPerRowSpan.style.fontSize = '13px';
      }
      chordsContainer.appendChild(chordsPerRowSpan);

      chordsContainer.querySelector('.beatSpan').ondblclick = function(e) {
        e.preventDefault();
        const newBeatSpan = prompt('Enter The New Beats Per Bar:');
        if (newBeatSpan !== "") {
          songObj.beatsPerBar = newBeatSpan;
          saveData();
          showAllLiveSongsAndSections();
        }
      }
      // Set the original key on hold tap
      chordsContainer.querySelector('.beatSpan').addEventListener('touchstart', function (e) {
        // Start the timer
        holdTimeout = setTimeout(() => {
          e.preventDefault();
          const newBeatSpan = prompt('Enter The New Beats Per Bar');
          if (newBeatSpan !== "") {
            songObj.beatsPerBar = newBeatSpan;
            saveData();
            showAllLiveSongsAndSections();
          }
        }, holdTapThreshold);
      });
      chordsContainer.querySelector('.beatSpan').addEventListener('touchend', function () {
        // Cancel if released early
        clearTimeout(holdTimeout);
      });

      chordsContainer.querySelector('.beatSpan').addEventListener('touchmove', function () {
        // Cancel if they move finger
        clearTimeout(holdTimeout);
      });


      // --- Handle Chords Per Row Editing ---
      function editChordsPerRowPrompt() {
        const newChordsPerRow = prompt('Enter the number of chords per row (1–10):');
        const value = parseInt(newChordsPerRow, 10);
        if (!isNaN(value) && value > 0 && value <= 10) {
          songObj.chordsPerRow = value;
          saveData().then(showAllLiveSongsAndSections());
        } 
        else if (newChordsPerRow !== null) {
          alert("Please enter a valid number between 1 and 10.");
        }
      }


      chordsContainer.querySelector('.chordsPerRow').ondblclick = async function(e) {
        e.preventDefault();
        editChordsPerRowPrompt();
      }
      // Set the original key on hold tap
      chordsContainer.querySelector('.chordsPerRow').addEventListener('touchstart', async function (e) {
        // Start the timer
        holdTimeout = setTimeout(() => {
          e.preventDefault();
          editChordsPerRowPrompt();
        }, holdTapThreshold);
      });
      chordsContainer.querySelector('.chordsPerRow').addEventListener('touchend', function () {
        // Cancel if released early
        clearTimeout(holdTimeout);
      });

      chordsContainer.querySelector('.chordsPerRow').addEventListener('touchmove', function () {
        // Cancel if they move finger
        clearTimeout(holdTimeout);
      });


      // Key Container
      if (Array.isArray(window.keyList)) {
        const keyContainer = document.createElement('div');
        keyContainer.className = 'keyContainer';
        window.keyList.forEach(key => {
          const keyBtn = document.createElement('button');
          keyBtn.className = 'key';
          keyBtn.textContent = key;
          if (keyBtn.textContent === 'Num'){
            keyBtn.classList.add('numKey');
          }
          // Highlight the selected key
          if (key === (songObj?.currentKey || songObj?.originalKey)) {
            keyBtn.classList.add('selectedKey');
          }
          else if (key === 'Num' && localStorage.getItem(`nashvilleMode_${currentUser}`) === 'true'){
            keyBtn.classList.add('selectedNumKey');
          }
          keyBtn.addEventListener('click', async function() {
            if (songObj) {
              // Always operate on the liveSongsData copy
              if (!liveSongsData[songObj.name]) {
                liveSongsData[songObj.name] = JSON.parse(JSON.stringify(songObj));
              }
              if (keyBtn.textContent === 'Num') {
                // Add Nashville toggle button
                const current = localStorage.getItem(`nashvilleMode_${currentUser}`) === 'true';
                localStorage.setItem(`nashvilleMode_${currentUser}`, (!current).toString());
                localStorage.setItem(`openMapForSong_${currentUser}`, songObj.name);
                showAllLiveSongsAndSections();
              }
              else {
                liveSongsData[songObj.name].currentKey = key; // Store the selected key in live data
                localStorage.setItem(`openMapForSong_${currentUser}`, songObj.name);
                await saveData(); // Save the updated liveSongsData
                showAllLiveSongsAndSections();
              }
            }
          });
          keyContainer.appendChild(keyBtn);
        });
        liveRightContainer.insertBefore(keyContainer, chordsContainer); // Insert above chordsContainer
      }


      // Chord sections
      if (Array.isArray(songObj.chords)) {
        songObj.chords.forEach((section, sectionIdx) => {
          const sectionDiv = document.createElement('div');
          sectionDiv.className = 'songSectionContainer';
          // Section name
          const sectionTitle = document.createElement('div');
          sectionTitle.className = 'sectionTitle';
          sectionTitle.textContent = section.section;
          sectionDiv.appendChild(sectionTitle);

          const chords = document.createElement('div');
          chords.className = 'chords';

          chordsPerRow = songObj.chordsPerRow || 4;
          for (let i = 0; i < section.chords.length; i += chordsPerRow) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'chord-row';

            // Add starting line
            const startLine = document.createElement('span');
            startLine.className = 'line';
            startLine.textContent = '|';
            rowDiv.appendChild(startLine);

            for (let j = 0; j < chordsPerRow && (i + j) < section.chords.length; j++) {
              
              const chordSpan = document.createElement('span');
              chordSpan.className = 'chord';
              const fromKey = songObj.originalKey;
              const toKey = songObj.currentKey || fromKey;
              const displayChord = transposeChordLine(section.chords[i + j], fromKey, toKey);
              chordSpan.textContent = displayChord;
              rowDiv.appendChild(chordSpan);

              const line = document.createElement('span');
              line.className = 'line';
              line.textContent = '|';
              rowDiv.appendChild(line);
            }
            chords.appendChild(rowDiv);
            }
            sectionDiv.appendChild(chords);
            chordsContainer.appendChild(sectionDiv);

            // Add Edit Button
            const editBtn = document.createElement('button');
            editBtn.className = 'editBtn';

            // Add Chord Buttons
            const addChordBtn = document.createElement('button');
            addChordBtn.className = 'addChordBtn';
            addChordBtn.textContent = '+';
            addChordBtn.addEventListener('click', async function() {
              if (!liveSongsData[songObj.name]) {
                liveSongsData[songObj.name] = JSON.parse(JSON.stringify(songObj));
              }
              liveSongsData[songObj.name].chords[sectionIdx].chords.push("• • • •");
              if (!liveSongsData[songObj.name]) {
                liveSongsData[songObj.name] = JSON.parse(JSON.stringify(songObj));
              }
              localStorage.setItem(`openMapForSong_${currentUser}`, songObj.name);
              await saveData(); // Save the updated liveSongsData
              showAllLiveSongsAndSections();
            });

            // Delete Section Button
            const deleteSectionBtn = document.createElement('button');
            deleteSectionBtn.className = 'deleteSectionBtn';
            deleteSectionBtn.textContent = '🗑️';
            deleteSectionBtn.addEventListener('click', async function() {
              // Ensure liveSongsData for this song exists, or create it as a copy of the original
              if (!liveSongsData[songObj.name]) {
                liveSongsData[songObj.name] = JSON.parse(JSON.stringify(songObj));
              }
              // Remove the section at sectionIdx from the live data
              liveSongsData[songObj.name].chords.splice(sectionIdx, 1);

              // Save changes to localStorage if needed
              localStorage.setItem(`openMapForSong_${currentUser}`, songObj.name);
              await saveData(); // Save the updated liveSongsData
              showAllLiveSongsAndSections();
            });
      
            chords.appendChild(editBtn);
            editBtn.appendChild(addChordBtn);
            editBtn.appendChild(deleteSectionBtn);


            // Only add these after the last section
            if (sectionIdx === songObj.chords.length - 1) {
              const hr = document.createElement('hr');
              chordsContainer.appendChild(hr);

              const addChordSectionBtn = document.createElement('button');
              addChordSectionBtn.className = 'addChordSectionBtn';
              addChordSectionBtn.textContent = '+';

                addChordSectionBtn.addEventListener('click', async function() {
                if (!liveSongsData[songObj.name]) {
                  liveSongsData[songObj.name] = JSON.parse(JSON.stringify(songObj));
                }
                if (!Array.isArray(liveSongsData[songObj.name].chords)) {
                  liveSongsData[songObj.name].chords = [];
                }
                // Always use beatsPerBar from the original song object
                if (songObj && songObj.beatsPerBar) {
                  beatsPerBar = parseInt(songObj.beatsPerBar, 10) || 4;
                }
                const dots = Array(beatsPerBar).fill('•').join(' ');
                liveSongsData[songObj.name].chords.push({ section: "New Section", chords: [dots] });
                // Also update beatsPerBar in the live data to match the original
                liveSongsData[songObj.name].beatsPerBar = beatsPerBar;
                localStorage.setItem(`openMapForSong_${currentUser}`, songObj.name);
                await saveData(); // Save the updated liveSongsData
                showAllLiveSongsAndSections();
                });

              chordsContainer.appendChild(addChordSectionBtn);
             }

            function attachChordSpanListeners(chordSpan, sectionDiv, sectionIdx, chordsContainer, songObj) {
              chordSpan.addEventListener('dblclick', (e) => {
                e.preventDefault();
                chordSpan.contentEditable = true;
                chordSpan.focus();
                document.execCommand('selectAll', false, null);
              });

              chordSpan.addEventListener('touchend', () => {
                const currentTime = Date.now();
                const tapLength = currentTime - lastTap;
                if (tapLength < dblTapThreshold && tapLength > 0) {
                  chordSpan.contentEditable = true;
                  chordSpan.focus();
                  document.execCommand('selectAll', false, null);
                }
                lastTap = currentTime;
              });

              chordSpan.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const allSections = Array.from(chordsContainer.querySelectorAll('.songSectionContainer'));
                  const allChords = Array.from(sectionDiv.querySelectorAll('.chord'));
                  const chordIdx = allChords.indexOf(chordSpan);

                  // Set focus target for next
                  if (chordIdx < allChords.length - 1) {
                    nextChordFocus = { sectionIdx, chordIdx: chordIdx + 1 };
                  } else if (sectionIdx < allSections.length - 1) {
                    nextChordFocus = { sectionIdx: sectionIdx + 1, chordIdx: 0 };
                  } else {
                    nextChordFocus = null;
                  }
                  setTimeout(() => chordSpan.blur(), 0);
                }
              });

              chordSpan.addEventListener('blur', async () => {
                chordSpan.contentEditable = false;
                const allChords = Array.from(sectionDiv.querySelectorAll('.chord'));
                const chordIdx = allChords.indexOf(chordSpan);
                const text = chordSpan.textContent.trim();

                if (!liveSongsData[songObj.name]) {
                  liveSongsData[songObj.name] = JSON.parse(JSON.stringify(songObj));
                }

                if (text === '') {
                  liveSongsData[songObj.name].chords[sectionIdx].chords.splice(chordIdx, 1);

                  const line = chordSpan.previousElementSibling;
                  if (line && line.classList.contains('line')) line.remove();
                  chordSpan.remove();

                  if (liveSongsData[songObj.name].chords[sectionIdx].chords.length === 0) {
                    liveSongsData[songObj.name].chords.splice(sectionIdx, 1);
                  }
                }
                else {
                  const originalKey = songObj.originalKey || 'C';
                  const selectedKey = songObj.currentKey || originalKey;
                  const nashvilleMode = localStorage.getItem(`nashvilleMode_${currentUser}`) === 'true';

                  let finalChord;

                  // Handle Nashville numbers
                  const numberRegex = /^([1-7])([b#]?)(.*)$/;
                  if (numberRegex.test(text) && !nashvilleMode) {
                    // Convert Nashville number to actual chord
                    const [ , number, accidental, suffix ] = text.match(numberRegex);
                    const interpreted = transposeChord(number + accidental + suffix, 'C', selectedKey); // 'C' as root of Nashville
                    finalChord = transposeChord(interpreted, selectedKey, originalKey);
                  } else {
                    // Convert regular chord from display key to original key
                    finalChord = transposeChord(text, selectedKey, originalKey);
                  }

                  // Update chord in data
                  liveSongsData[songObj.name].chords[sectionIdx].chords[chordIdx] = finalChord;
                }
                localStorage.setItem(`openMapForSong_${currentUser}`, songObj.name);
                await saveData(); // Save the updated liveSongsData
                showAllLiveSongsAndSections();
              });
            }

            // Double click to edit chords
            const chordSpans = sectionDiv.querySelectorAll('.chord');
            chordSpans.forEach(chordSpan => {
              attachChordSpanListeners(chordSpan, sectionDiv, sectionIdx, chordsContainer, songObj);
            });

            // Rename Chord Section (attach only once per section)
            sectionTitle.addEventListener('dblclick', function() {
              sectionTitle.contentEditable = true;
              sectionTitle.focus();
              sectionTitle.addEventListener('keydown', function(e) {
                if (e.key === 'Enter'){
                  e.preventDefault();
                  sectionTitle.blur();
                }
              });
              sectionTitle.addEventListener('blur', async function() {
                sectionTitle.contentEditable = false;
                newSectionName = sectionTitle.textContent;
                if (newSectionName !== null && newSectionName.trim() !== "") {
                  // Find the index of this sectionTitle among all section titles within the current song's container
                  const allSectionTitles = Array.from(sectionDiv.parentNode.querySelectorAll('.sectionTitle'));
                  const idx = allSectionTitles.indexOf(sectionTitle);
                  if (idx !== -1 && liveSongsData[songObj.name] && liveSongsData[songObj.name].chords[idx]) {
                    liveSongsData[songObj.name].chords[idx].section = newSectionName;
                    await saveData(); // Save the updated liveSongsData
                  }
                }
              });
            });
          });
        }
      }
    });

    // If no live songs, show a message
    if (liveSongs.length === 0) {
      liveRightContainer.innerHTML = '<div align="center">No Live Songs Selected.</div>';
    }
  }



  // Add event listener to liveTitle to toggle dropdown
  liveTitle.addEventListener('click', function() {
    dropdownMenu.classList.toggle('show');
  });


  // Get the current song title from localStorage
  const currentSongTitle = localStorage.getItem(`currentSongTitle_${currentUser}`);
  let currentSongObj = null;
  for (const artistObj of appData) {
    currentSongObj = artistObj.songs.find(song => song.name === currentSongTitle);
    if (currentSongObj) break;
  }

  const rightContainer = document.querySelector('.rightContainer');
  rightContainer.innerHTML = `<div class="chordsContainer"></div>`;

  // Add this block to create the title for the current song
  const titleDiv = document.createElement('div');
  titleDiv.className = 'title';
  titleDiv.textContent = currentSongTitle || "Untitled";
  rightContainer.prepend(titleDiv);

  const container = document.querySelector('.rightContainer .chordsContainer');
  container.innerHTML = ""; // Clear previous content
  
  // Always add the "Original Key" span at the top
  const oriKeySpan = document.createElement('span');
  oriKeySpan.innerHTML = `Original Key: <span class="originalKey">${currentSongObj?.originalKey || 'Unknown'}</span>`;
  container.appendChild(oriKeySpan);


  // Beats per bar
  const beatDisplay = document.createElement('span');
  beatDisplay.innerHTML = `Beats Per Bar: <span class="beatSpan">${currentSongObj?.beatsPerBar || '4'}</span>`;
  beatDisplay.style.fontSize = '30px';
  if (window.innerWidth < 600) {
    beatDisplay.style.fontSize = '13px';
  }
  container.appendChild(beatDisplay);

  // Add the chordsperrow span
  const chordsPerRowSpan = document.createElement('span');
  chordsPerRowSpan.innerHTML = `Chords Per Row: <span class="chordsPerRow">${currentSongObj?.chordsPerRow || '4'}</span>`;
  chordsPerRowSpan.style.fontSize = '30px';
  if (window.innerWidth < 600) {
    chordsPerRowSpan.style.fontSize = '13px';
  }
  container.appendChild(chordsPerRowSpan);

  container.querySelector('.beatSpan').ondblclick = function(e) {
    e.preventDefault();
    const newBeatSpan = prompt('Enter The New Beats Per Bar:');
    if (newBeatSpan !== "") {
      currentSongObj.beatsPerBar = newBeatSpan;
      saveData();
      renderUI();
    }
  }
  // Set the original key on hold tap
  container.querySelector('.beatSpan').addEventListener('touchstart', function (e) {
    // Start the timer
    holdTimeout = setTimeout(() => {
      e.preventDefault();
      const newBeatSpan = prompt('Enter The New Beats Per Bar');
      if (newBeatSpan !== "") {
        currentSongObj.beatsPerBar = newBeatSpan;
        saveData();
        renderUI();
      }
    }, holdTapThreshold);
  });
  container.querySelector('.beatSpan').addEventListener('touchend', function () {
    // Cancel if released early
    clearTimeout(holdTimeout);
  });

  container.querySelector('.beatSpan').addEventListener('touchmove', function () {
    // Cancel if they move finger
    clearTimeout(holdTimeout);
  });


  // --- Handle Chords Per Row Editing ---
  function editChordsPerRowPrompt() {
    const newChordsPerRow = prompt('Enter the number of chords per row (1–10):');
    const value = parseInt(newChordsPerRow, 10);
    if (!isNaN(value) && value > 0 && value <= 10) {
      currentSongObj.chordsPerRow = value;
      saveData().then(renderUI);
    } 
    else if (newChordsPerRow !== null) {
      alert("Please enter a valid number between 1 and 10.");
    }
  }


  container.querySelector('.chordsPerRow').ondblclick = async function(e) {
    e.preventDefault();
    editChordsPerRowPrompt();
  }
  // Set the original key on hold tap
  container.querySelector('.chordsPerRow').addEventListener('touchstart', async function (e) {
    // Start the timer
    holdTimeout = setTimeout(() => {
      e.preventDefault();
      editChordsPerRowPrompt();
    }, holdTapThreshold);
  });
  container.querySelector('.chordsPerRow').addEventListener('touchend', function () {
    // Cancel if released early
    clearTimeout(holdTimeout);
  });

  container.querySelector('.chordsPerRow').addEventListener('touchmove', function () {
    // Cancel if they move finger
    clearTimeout(holdTimeout);
  });


  // Change the chords when you click a selected key
  if (Array.isArray(window.keyList)) {
    const keyContainer = document.createElement('div');
    keyContainer.className = 'keyContainer';
    window.keyList.forEach(key => {
      const keyBtn = document.createElement('button');
      keyBtn.className = 'key';
      keyBtn.textContent = key;
      if (keyBtn.textContent === 'Num'){
        keyBtn.classList.add('numKey');
      }
      // Highlight the selected key
      if (key === (currentSongObj?.currentKey || currentSongObj?.originalKey)) {
        keyBtn.classList.add('selectedKey');
      }
      else if (key === 'Num' && localStorage.getItem(`nashvilleMode_${currentUser}`) === 'true'){
        keyBtn.classList.add('selectedNumKey');
      }
      keyBtn.addEventListener('click', function() {
        if (currentSongObj) {
          if (keyBtn.textContent === 'Num'){
            const current = localStorage.getItem(`nashvilleMode_${currentUser}`) === 'true';
            localStorage.setItem(`nashvilleMode_${currentUser}`, (!current).toString());
            renderUI();
          }
          else{
            currentSongObj.currentKey = key; // Store the selected key
          }
          saveData();
          renderUI();
        }
      });
      keyContainer.appendChild(keyBtn);
    });

    const rightContainer = document.querySelector('.rightContainer');
    rightContainer.insertBefore(keyContainer, container); // Insert above chordsContainer
  }
  
  function transposeChord(chord, fromKey, toKey) {
    const nashvilleMode = localStorage.getItem(`nashvilleMode_${currentUser}`) === 'true';

    // Chromatic scales
    const chromaticSharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const chromaticFlats  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    function usesFlat(note) {
      return note.includes('b') || note.includes('♭');
    }

    chord = chord.replace('♭', 'b');
    fromKey = fromKey.replace('♭', 'b');
    toKey = toKey.replace('♭', 'b');

    // Convert Nashville number (e.g. "6b", "4#", etc.) to letter chord before continuing
    const numberMatch = chord.match(/^([1-7])([b#]?)(.*)$/);
    if (numberMatch) {
      const [ , number, accidental, suffix ] = numberMatch;
      const numberIndex = parseInt(number, 10) - 1;
      const scaleSemitones = [0, 2, 4, 5, 7, 9, 11];
      const sharpScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

      const baseSemitone = scaleSemitones[numberIndex];
      let finalSemitone = baseSemitone;

      if (accidental === '#') finalSemitone = (baseSemitone + 1) % 12;
      if (accidental === 'b') finalSemitone = (baseSemitone + 11) % 12;

      const chordRoot = sharpScale[finalSemitone];

      chord = chordRoot + (suffix || '');
    }

    const match = chord.match(/^([A-G][b#]?)(.*)$/);
    if (!match) return chord;

    let [ , root, suffix ] = match;
    const useFlats = usesFlat(root) || usesFlat(toKey);
    const chromatic = useFlats ? chromaticFlats : chromaticSharps;

    const fromIdx = chromaticSharps.indexOf(fromKey) !== -1
      ? chromaticSharps.indexOf(fromKey)
      : chromaticFlats.indexOf(fromKey);

    const toIdx = chromaticSharps.indexOf(toKey) !== -1
      ? chromaticSharps.indexOf(toKey)
      : chromaticFlats.indexOf(toKey);

    const rootIdx = chromatic.indexOf(root);
    if (fromIdx === -1 || toIdx === -1 || rootIdx === -1) return chord;

    const shift = (toIdx - fromIdx + 12) % 12;
    const newIndex = (rootIdx + shift) % 12;
    const newRoot = chromatic[newIndex];

    if (nashvilleMode) {
      const nashvilleNumbersSharps = ['1', '1#', '2', '2#', '3', '4', '4#', '5', '5#', '6', '6#', '7'];
      const nashvilleNumbersFlats  = ['1', '2b', '2', '3b', '3', '4', '5b', '5', '6b', '6', '7b', '7'];

      let keyIdx = chromatic.indexOf(toKey);
      if (keyIdx === -1) keyIdx = chromatic.indexOf(fromKey);
      const relIdx = (chromatic.indexOf(newRoot) - keyIdx + 12) % 12;
      const nashNum = useFlats ? nashvilleNumbersFlats[relIdx] : nashvilleNumbersSharps[relIdx];

      return nashNum + suffix;
    }

    return newRoot + suffix;
  }

  function getMajorScale(key) {
    const semitoneMap = {
      C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
      E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8,
      A: 9, 'A#': 10, Bb: 10, B: 11,
    };

    const sharpScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const steps = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals in semitones

    const startIndex = semitoneMap[key];
    if (startIndex === undefined) return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

    return steps.map(step => sharpScale[(startIndex + step) % 12]);
  }
  function convertToNashville(chord, key) {
    const scale = getMajorScale(key);
    const match = chord.match(/^([A-G][#b]?)(.*)?$/);
    if (!match) return chord;

    const [ , root, suffix ] = match;
    const index = scale.indexOf(root);
    if (index === -1) return chord;

    return (index + 1).toString() + (suffix || '');
  }


  function transposeChordLine(line, fromKey, toKey) {
    const nashvilleMode = localStorage.getItem(`nashvilleMode_${currentUser}`) === 'true';

    return line
    .split(/(\s+|·+)/) // split by space OR dot, keep separators
    .map(part => {
      const trimmed = part.trimStart();

      // In Nashville mode, skip numbers like "1", "1/3", "6b", etc.
      if (nashvilleMode && /^[1-7](b|#)?(\/[1-7](b|#)?)?$/.test(trimmed)) {
        return part;
      }

      // Detect slash chords like D/F# or C#m7/G
      if (trimmed.includes('/')) {
        const [chordPart, bassPart] = trimmed.split('/');
        const transposedChord = /^[A-G][b#♭]?/.test(chordPart)
          ? transposeChord(chordPart, fromKey, toKey)
          : chordPart;
        const transposedBass = /^[A-G][b#♭]?/.test(bassPart)
          ? transposeChord(bassPart, fromKey, toKey)
          : bassPart;
        return transposedChord + '/' + transposedBass;
      }

      // Normal chords (not slash)
      if (/^[A-G][b#♭]?/.test(trimmed)) {
        return transposeChord(trimmed, fromKey, toKey);
      }
      return part;
    })
    .join('');
  }

  // Chord Sections Display
  chordsPerRow = currentSongObj?.chordsPerRow || 4;
  if (container && currentSongObj && Array.isArray(currentSongObj.chords)) {
    currentSongObj.chords.forEach(section => {
      const songSectionContainer = document.createElement('div');
      songSectionContainer.className = 'songSectionContainer';

      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'sectionTitle';
      sectionTitle.textContent = section.section;
      songSectionContainer.appendChild(sectionTitle);

      const chords = document.createElement('div');
      chords.className = 'chords';

      for (let i = 0; i < section.chords.length; i += chordsPerRow) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'chord-row';

        // Add starting line
        const startLine = document.createElement('span');
        startLine.className = 'line';
        startLine.textContent = '|';
        rowDiv.appendChild(startLine);

        for (let j = 0; j < chordsPerRow && (i + j) < section.chords.length; j++) {

          const chordSpan = document.createElement('span');
          chordSpan.className = 'chord';

          const fromKey = currentSongObj.originalKey;
          const toKey = currentSongObj.currentKey || fromKey;
          const displayChord = transposeChordLine(section.chords[i + j], fromKey, toKey);
          
          chordSpan.textContent = displayChord;
          rowDiv.appendChild(chordSpan);

          const line = document.createElement('span');
          line.className = 'line';
          line.textContent = '|';
          rowDiv.appendChild(line);
        }

        chords.appendChild(rowDiv);
      }

      // Add Edit Button
      const editBtn = document.createElement('button');
      editBtn.className = 'editBtn';

      // Add Chord Buttons
      const addChordBtn = document.createElement('button');
      addChordBtn.className = 'addChordBtn';
      addChordBtn.textContent = '+';
      addChordBtn.addEventListener('click', function() {
        if (currentSongObj) {
          if (!Array.isArray(currentSongObj.chords)) {
            currentSongObj.chords = [];
          }
          // Determine number of beats per bar (default to 4 if not set)
          const beats = parseInt(currentSongObj.beatsPerBar, 10) || 4;
          const dots = Array(beats).fill('•').join(' ');
          section.chords.push(dots);
          saveData();
          renderUI();
        }
      });


      // Delete Section Button
      const deleteSectionBtn = document.createElement('button');
      deleteSectionBtn.className = 'deleteSectionBtn';
      deleteSectionBtn.textContent = '🗑️';
      deleteSectionBtn.addEventListener('click', function() {
        if (currentSongObj) {
          const idx = currentSongObj.chords.indexOf(section);
          if (idx > -1) {
            currentSongObj.chords.splice(idx, 1);
            saveData();
            renderUI();
          }
        }
      });
      
      chords.appendChild(editBtn);
      editBtn.appendChild(addChordBtn);
      editBtn.appendChild(deleteSectionBtn);
      songSectionContainer.appendChild(chords);

      container.appendChild(songSectionContainer);
    });


    // Double click to edit chords
    const chordSpans = container.querySelectorAll('.chord');
    chordSpans.forEach(chordSpan => {
      chordSpan.addEventListener('dblclick', function(e) {
        e.preventDefault();
        chordSpan.contentEditable = true;
        chordSpan.focus();
      });
      // Double tap to edit chord
      chordSpan.addEventListener('touchend', function () {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;

        if (tapLength < dblTapThreshold && tapLength > 0) {
          chordSpan.contentEditable = true;
          chordSpan.focus();
        }
        lastTap = currentTime;
      });
      // Go to next chord on Enter key
        chordSpan.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default Enter behavior
            setTimeout(() => chordSpan.blur(), 0);
            // Find all chord spans in the current section
            const section = chordSpan.closest('.songSectionContainer');
            const allSections = Array.from(container.querySelectorAll('.songSectionContainer'));
            const sectionIdx = allSections.indexOf(section);
            const allChords = Array.from(section.querySelectorAll('.chord'));
            const idx = allChords.indexOf(chordSpan);

            // Focus the next chord in the section, if it exists
            if (idx > -1 && idx < allChords.length - 1) {
              nextChordFocus = { sectionIdx, chordIdx: idx + 1 };
            }
            else if (sectionIdx < allSections.length - 1) {
              nextChordFocus = { sectionIdx: sectionIdx + 1, chordIdx: 0 };
            }
            else {
              nextChordFocus = null; // No next chord to focus
            }  
            chordSpan.blur();   
          }
        });
        // Set the chordSpan to be uneditable
        chordSpan.addEventListener('blur', function() {
          chordSpan.contentEditable = false;

          const section = chordSpan.closest('.songSectionContainer');
          const allSections = Array.from(container.querySelectorAll('.songSectionContainer'));
          const sectionIdx = allSections.indexOf(section);
          const chordIdx = Array.from(section.querySelectorAll('.chord')).indexOf(chordSpan);

          const chordText = chordSpan.textContent.trim();
          
          const originalKey = currentSongObj.originalKey || "C";
          const selectedKey = currentSongObj.currentKey || originalKey;

          if (!currentSongObj) return;

          // If the chordSpan is empty, remove it
          if (chordText === '') {
            if (currentSongObj && currentSongObj.chords[sectionIdx] && currentSongObj.chords[sectionIdx].chords) {
              currentSongObj.chords[sectionIdx].chords.splice(chordIdx, 1);
              // Remove the line
              const line = chordSpan.previousElementSibling;
              if (line && line.classList.contains('line')) {
              line.remove();
              }

              chordSpan.remove();

              // Remove the section if no chords left
              if (currentSongObj.chords[sectionIdx].chords.length === 0) {
              currentSongObj.chords.splice(sectionIdx, 1);
              }
            }
          } 
          else {
            const numberRegex = /^([1-7])([b#]?)(.*)$/;
            const nashvilleMode = localStorage.getItem(`nashvilleMode_${currentUser}`) === 'true';

            if (numberRegex.test(chordText) && !nashvilleMode) {
              const [ , number, accidental, suffix ] = chordText.match(numberRegex);
              const converted = transposeChord(number + accidental + suffix, 'C', selectedKey);
              currentSongObj.chords[sectionIdx].chords[chordIdx] = transposeChord(converted, selectedKey, originalKey);
              chordSpan.textContent = converted;
            }
            else {
              const chordInOriginalKey = transposeChord(chordText, selectedKey, originalKey);
              currentSongObj.chords[sectionIdx].chords[chordIdx] = chordInOriginalKey;
              chordSpan.textContent = transposeChord(chordInOriginalKey, originalKey, selectedKey);
            }
          }
          saveData();
          renderUI();
        });
    });


    // Only one <hr> at the bottom
      const hr = document.createElement('hr');
      container.appendChild(hr);
      

    // Add chord section button
    const addChordSectionBtn = document.createElement('button');
    addChordSectionBtn.className = 'addChordSectionBtn';
    addChordSectionBtn.textContent = '+';

    addChordSectionBtn.addEventListener('click', function() {
      if (currentSongObj) {
        if (!Array.isArray(currentSongObj.chords)) {
          currentSongObj.chords = [];
        }
      if (currentSongObj && currentSongObj.beatsPerBar) {
        beatsPerBar = parseInt(currentSongObj.beatsPerBar, 10) || 4;
      }
      // Create the correct number of dots for the beats per bar
      const dots = Array(beatsPerBar).fill('•').join(' ');
      currentSongObj.chords.push({ section: "New Section", chords: [dots] });
        saveData();
        renderUI();
      }
    });
    container.appendChild(addChordSectionBtn);


    // Rename Chord Section
    const songSections = document.querySelectorAll('.sectionTitle');
    songSections.forEach(section => {
      section.addEventListener('dblclick', function() {
        section.contentEditable = true
        section.focus();
        section.addEventListener('keydown', function(e) {
          if (e.key === "Enter") {
            e.preventDefault();
            section.blur();
          }
        });
        section.addEventListener('blur', function() {
          const sectionTitle = section.textContent;
          if (sectionTitle !== null && sectionTitle.trim() !== "") {
            const idx = Array.from(songSections).indexOf(section);
            currentSongObj.chords[idx].section = sectionTitle;
            saveData();
            renderUI();
          }
        });
      });
      section.addEventListener('touchend', function () {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;

        if (tapLength < dblTapThreshold && tapLength > 0) {
          section.contentEditable = true
          section.focus();
          section.addEventListener('keydown', function(e) {
            if (e.key === "Enter") {
              e.preventDefault();
              section.blur();
          }
          });
          section.addEventListener('blur', function() {
            const sectionTitle = section.textContent;
            if (sectionTitle !== null && sectionTitle.trim() !== "") {
              const idx = Array.from(songSections).indexOf(section);
              currentSongObj.chords[idx].section = sectionTitle;
              saveData();
              renderUI();
            }
          });
        }
        lastTap = currentTime;
      });
    });
  }
  else {
    // If no chords exist, create a default section
    const songSectionContainer = document.createElement('div');
    songSectionContainer.className = 'songSectionContainer';

    const chords = document.createElement('div');
    chords.className = 'chords';

    // Add chord section button
    const addChordSectionBtn = document.createElement('button');
    addChordSectionBtn.className = 'addChordSectionBtn';
    addChordSectionBtn.textContent = '+';

    addChordSectionBtn.addEventListener('click', function() {
      if (currentSongObj) {
        if (!Array.isArray(currentSongObj.chords)) {
          currentSongObj.chords = [];
        }
        currentSongObj.chords.push({ section: "New Section", chords: ["• • • •"] });
        saveData();
        renderUI();
      }
    });

    const hr = document.createElement('hr');
    songSectionContainer.appendChild(hr);

    songSectionContainer.appendChild(addChordSectionBtn);
    songSectionContainer.appendChild(chords);

    container.appendChild(songSectionContainer);
  }


  // Set the original key for each song
  const keyContainer = document.querySelector('.keyContainer');
  const oriKey = currentSongObj ? currentSongObj.originalKey : 'Unknown';
  const originalKeySpan = document.querySelector('.originalKey');
  if (originalKeySpan) {
    originalKeySpan.textContent = oriKey; // Display the original key
  }
  
  if (keyContainer) {
    keyContainer.querySelectorAll('.key').forEach(btn => {
      // Highlight the original key button on render
      if (btn.textContent === oriKey) {
        btn.style.backgroundColor = '#1b61d1';
      } 
      else {
        btn.style.backgroundColor = '';
      }

      // Set the original key on double-click
      btn.ondblclick = function() {
        if (currentSongObj && btn.textContent !== 'Num') {
          currentSongObj.originalKey = btn.textContent; // Set per-song original key
          saveData(); // Save to localStorage
          renderUI(); // Re-render to update UI (which will handle highlighting)
        }
      };
      // Set the original key on hold tap
      btn.addEventListener('touchstart', function (e) {
        // Start the timer
        holdTimeout = setTimeout(() => {
          e.preventDefault();
          if (currentSongObj && btn.textContent !== 'Num') {
            currentSongObj.originalKey = btn.textContent; // Set per-song original key
            saveData(); // Save to localStorage
            renderUI(); // Re-render to update UI (which will handle highlighting)
          }
        }, holdTapThreshold);
      });
      btn.addEventListener('touchend', function () {
        // Cancel if released early
        clearTimeout(holdTimeout);
      });

      btn.addEventListener('touchmove', function () {
        // Cancel if they move finger
        clearTimeout(holdTimeout);
      });
    });
  }


  const songMapContainer = document.querySelector('.songMapContainer');
  songMapContainer.style.display = 'block';
  
  // Song Map
  const songMapList = document.querySelector('.songMapList');
  if (songMapList && currentSongObj && Array.isArray(currentSongObj.songMap)) {
    songMapList.innerHTML = '';
    currentSongObj.songMap.forEach(part => {
      const li = document.createElement('li');
      li.className = 'songMapPart';
      li.textContent = part;
      songMapList.appendChild(li);
    });
  }


   // Add chordsContainer for artists and their songs
  const artistContainer = document.createElement('div');
  artistContainer.className = 'artistContainer';
  leftContainer.appendChild(artistContainer);

  // Loop through each artist in appData
  if (Array.isArray(appData)) {
    appData.forEach(artistObj => {
      // Artist Name
      const artistName = document.createElement('div');
      artistName.className = 'artistName';
      artistName.textContent = artistObj.artist;
      artistContainer.appendChild(artistName);

      // Dropdown menu for songs
      const dropdownMenu = document.createElement('ul');
      dropdownMenu.className = 'dropdown-menu';
      dropdownMenu.style.display = 'none'; // Hide by default
      artistContainer.appendChild(dropdownMenu);

      // Add each song as a list item
      artistObj.songs.forEach(song => {
        const li = document.createElement('li');
        li.className = 'songName';
        li.textContent = song.name;
        dropdownMenu.appendChild(li);

        // Click event to set as current song
        li.addEventListener('click', function() {
          localStorage.setItem(`currentSongTitle_${currentUser}`, song.name);
          const title = document.querySelector('.title');
          if (title) title.textContent = song.name;
          liveContainer.style.display = 'none'; // Hide the dropdown after selection
          const rightContainer = document.querySelector('.rightContainer');
          if (rightContainer) rightContainer.innerHTML = `<div class="chordsContainer"></div>`;
          saveData(); // Save the current song title
          renderUI(); // Re-render UI to reflect changes
        });
      });

      // Toggle dropdown on artist name click
      artistName.addEventListener('click', function() {
        dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
      });
    });
  }


  // Add Song Map Part Button
  const addPartBtn = document.querySelector('.addPartBtn');
  if (addPartBtn) { 
    addPartBtn.replaceWith(addPartBtn.cloneNode(true));
    const newAddPartBtn = document.querySelector('.addPartBtn');
    newAddPartBtn.addEventListener('click', function() {
      if (currentSongObj) {
        if (!Array.isArray(currentSongObj.songMap)) {
          currentSongObj.songMap = [];
        }
        currentSongObj.songMap.push("Unknown");
        saveData();
        renderUI();
      }
    });
  }


  // Rename/Delete Song Map Part
  const songMapParts = document.querySelectorAll('.songMapPart');
  songMapParts.forEach(part => {
    part.addEventListener('dblclick', function(e) {
      e.preventDefault();
      part.contentEditable = true;
      part.focus();
      // Select all text of the part
      document.execCommand('selectAll', false, null);
      nextChordFocus = null; // Reset nextChordFocus since we're editing a part
    });

    // Double tap to show the artist name edit button
    part.addEventListener('touchend', function () {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;

      if (tapLength < dblTapThreshold && tapLength > 0) {
        part.contentEditable = true;
        part.focus();
        // Select all text of the part
        document.execCommand('selectAll', false, null);
        nextChordFocus = null;
      }

      lastTap = currentTime;
    });

    // Enter key to save changes and focus next part
    part.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const allParts = Array.from(document.querySelectorAll('.songMapPart'));
        const idx = allParts.indexOf(part);
        if (allParts[idx + 1]) {
          nextSongMapFocusIdx = idx + 1;
        } 
        else {
          nextSongMapFocusIdx = null;
        }
        part.blur(); // This will trigger renderUI via blur handler
      }
    });
    // Blur event to save changes
    part.addEventListener('blur', function() {
      part.contentEditable = false;
      const allParts = Array.from(document.querySelectorAll('.songMapPart'));
      const idx = allParts.indexOf(part);
      if (currentSongObj && currentSongObj.songMap) {
        currentSongObj.songMap[idx] = part.textContent.trim();
        // If the part is empty, remove it
        if (part.textContent.trim() === '') {
          currentSongObj.songMap.splice(idx, 1);
        }
        saveData();
        renderUI(); // Re-render to reflect changes
      }
    });
  });


  // Song Map List Draggable
  function makeSongMapPartsDraggable() {
    const list = document.querySelector('.songMapList');
    const parts = list.querySelectorAll('.songMapPart');

    parts.forEach(part => {
      part.setAttribute('draggable', 'true');

      part.addEventListener('dragstart', function(e) {
        e.dataTransfer.effectAllowed = 'move';
        part.classList.add('dragging');
        window.draggedPart = part;
      });

      part.addEventListener('dragend', function() {
        part.classList.remove('dragging');
        window.draggedPart = null;

        const list = document.querySelector('.songMapList');
        const partElements = list.querySelectorAll('.songMapPart');
        currentSongObj.songMap = Array.from(partElements).map(part => part.textContent.trim());

        saveData();
      });
    });

    list.addEventListener('dragover', function(e) {
      e.preventDefault();
      const dragging = document.querySelector('.dragging');
      if (!dragging) return;
        const afterElement = getDragAfterElement(list, e.clientY);
      if (afterElement == null) {
        list.appendChild(dragging);
      } 
      else {
        list.insertBefore(dragging, afterElement);
      }
    });

    function getDragAfterElement(container, y) {
      const draggableElements = [...container.querySelectorAll('.songMapPart:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } 
        else {
          return closest;
        }
      }, { offset: -Infinity }).element;
    }
  }

  // Call this after rendering songMapList
  makeSongMapPartsDraggable();


  // After rendering, check if nextChordFocus is set
  if (nextChordFocus) {
    const allSections = Array.from(container.querySelectorAll('.songSectionContainer'));
    const section = allSections[nextChordFocus.sectionIdx];
    if (section) {
      const chords = section.querySelectorAll('.chord');
      const nextChord = chords[nextChordFocus.chordIdx];
      if (nextChord) {
        nextChord.contentEditable = true;
        nextChord.focus();
        // Select all text of the next chord
        document.execCommand('selectAll', false, null);
        /* If it doessn't work, use this instead:
        const range = document.createRange();
        range.selectNodeContents(nextChord);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        */
      }
    }
    nextChordFocus = null;
  }


  // After rendering, check if nextSongMapFocusIdx is set
  if (nextSongMapFocusIdx !== null) {
    const allParts = Array.from(document.querySelectorAll('.songMapPart'));
    const nextPart = allParts[nextSongMapFocusIdx];
    if (nextPart) {
      nextPart.contentEditable = true;
      nextPart.focus();
      // Select all text of the next part
      document.execCommand('selectAll', false, null);
    }
    nextSongMapFocusIdx = null; // Reset after focusing
  }

  // Show live section if it was triggered from the main page
  if (localStorage.getItem(`liveSection_${currentUser}`) === 'true') {
    localStorage.setItem(`openMapForSong_${currentUser}`, null);
    document.querySelector('.title').style.textAlign = 'right';
    showAllLiveSongsAndSections();
    localStorage.removeItem(`liveSection_${currentUser}`);
  }
}


// --- Intial Render ---
renderUI();


// --- Dark Mode ---
async function darkMode(){
  const user = firebase.auth().currentUser;
  if (!user) return;

  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode'); // True if dark mode is active
  const darkBtn = document.querySelector('#darkBtn');
  if (darkBtn) {
    if (isDarkMode) {
      darkBtn.textContent = '☼';
    } 
    else {
      darkBtn.textContent = '☾⋆';
    }
    await firebase.firestore().collection('users').doc(user.uid).set({
      darkMode: isDarkMode
    }, { merge: true });
  }
}


// --- Go To Home Page ---
function home(){
    window.location.href = 'Home-index.html';
}


// --- Hide/Show Data ---

function hideShow() {
  const container = document.querySelector('.leftContainer');
  const buttons = document.querySelectorAll('.menuBtn');
  const menu = document.querySelector('.menu');

  if (container.style.display === 'none'  || container.style.display === '') {
    container.style.display = 'block';
    document.body.classList.add('dimmed');
    if (window.innerWidth < 600){
      buttons.forEach(button => {
        button.style.display = 'block';
        button.style.fontSize = '34px';
        button.style.margin = '10px';
      });
      menu.style.width = '38px';
      menu.style.height = '100%';
    }
  } 
  else {
    container.style.display = 'none';
    document.body.classList.remove('dimmed');

    if (window.innerWidth < 600){
      buttons.forEach(button => {
        button.style.display = 'none';
        button.style.fontSize = '18px';
        button.style.margin = '0';
        document.getElementById('hideShowBtn').style.display = 'block'
      });
      menu.style.width = '20px';
      menu.style.height = '22px';
    }
  }
}
// Hide the container if you click outside of it
document.addEventListener('click', function(e) {
  const container = document.querySelector('.leftContainer');

  // If the container is not visible, do nothing
  if (!container || container.style.display === 'none') return;

  // If the click is outside the container and not on the button that shows it
  if(!container.contains(e.target) && !e.target.matches('#hideShowBtn')) {
    container.style.display = 'none';
    document.body.classList.remove('dimmed');
  }
});

document.addEventListener('touchstart', function (e) {
  const container = document.querySelector('.leftContainer');
  const buttons = document.querySelectorAll('.menuBtn');
  const menu = document.querySelector('.menu');

  // If the container is not visible, do nothing
  if (!container || container.style.display === 'none') return;

  // If the user presses one of the button in the menu except the hideShowBtn
  if (menu.contains(e.target) && !e.target.matches('#hideShowBtn')){
    setTimeout(() => {
      container.style.display = 'none';
      document.body.classList.remove('dimmed');

      buttons.forEach(button => {
        button.style.display = 'none';
        button.style.fontSize = '18px';
        button.style.margin = '0';
        document.getElementById('hideShowBtn').style.display = 'block'
      });
      menu.style.width = '20px';
      menu.style.height = '22px';
    }, 300);
  }
  // If the click is outside the container and not on the button that shows it
  else if(!container.contains(e.target) && !e.target.matches('#hideShowBtn') ) {
    container.style.display = 'none';
    document.body.classList.remove('dimmed');

    buttons.forEach(button => {
      button.style.display = 'none';
      button.style.fontSize = '18px';
      button.style.margin = '0';
      document.getElementById('hideShowBtn').style.display = 'block'
    });
    menu.style.width = '20px';
    menu.style.height = '22px';
  } 
});



// --- Manual Page ---
function manual(){
  window.location.href = 'manual.html';
}