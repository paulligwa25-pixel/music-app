// API Configuration
const API_URL = window.location.origin;

// State
let tracks = [];
let currentTrackIndex = 0;
let isPlaying = false;
let audio = null;
let progressInterval = null;
let shuffle = false;
let repeat = false;
let likedTracks = new Set();

// DOM Elements
const coverImg = document.getElementById('coverImage');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressFill = document.getElementById('progressFill');
const progressBar = document.getElementById('progressBar');
const currentTimeSpan = document.getElementById('currentTime');
const totalTimeSpan = document.getElementById('totalTime');
const playlistContainer = document.getElementById('playlistContainer');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const likeBtn = document.getElementById('likeBtn');
const likeCount = document.getElementById('likeCount');
const volumeSlider = document.getElementById('volumeSlider');
const uploadBtn = document.getElementById('uploadBtn');
const uploadModal = document.getElementById('uploadModal');
const closeModal = document.getElementById('closeModal');
const uploadForm = document.getElementById('uploadForm');
const trackCount = document.getElementById('trackCount');

// Helper Functions
function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Fetch tracks from server
async function fetchTracks() {
    try {
        const response = await fetch(`${API_URL}/api/tracks`);
        tracks = await response.json();
        trackCount.textContent = tracks.length;
        renderPlaylist();
        if (tracks.length > 0) {
            loadTrack(0);
        }
    } catch (error) {
        console.error('Error fetching tracks:', error);
    }
}

// Load track
function loadTrack(index) {
    if (audio) {
        audio.pause();
        audio = null;
        clearInterval(progressInterval);
        progressInterval = null;
        isPlaying = false;
        playIcon.className = 'fas fa-play';
    }

    if (!tracks.length || index >= tracks.length) return;

    const track = tracks[index];
    currentTrackIndex = index;

    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;
    coverImg.src = track.cover || '/api/placeholder/400/400';

    // Update playlist active
    document.querySelectorAll('.playlist-item').forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });

    progressFill.style.width = '0%';
    currentTimeSpan.textContent = '0:00';
    totalTimeSpan.textContent = formatTime(track.duration);

    // Create audio element
    audio = new Audio(`${API_URL}/api/stream/${track.id}`);
    
    audio.addEventListener('loadedmetadata', function() {
        if (audio.duration) {
            totalTimeSpan.textContent = formatTime(audio.duration);
        }
    });

    audio.addEventListener('timeupdate', function() {
        if (audio && audio.currentTime !== undefined) {
            const pct = Math.min(100, (audio.currentTime / (audio.duration || track.duration)) * 100);
            progressFill.style.width = pct + '%';
            currentTimeSpan.textContent = formatTime(audio.currentTime);
        }
    });

    audio.addEventListener('ended', function() {
        if (repeat) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        } else {
            nextTrack();
        }
    });

    audio.volume = parseFloat(volumeSlider.value);

    isPlaying = false;
    playIcon.className = 'fas fa-play';

    // Track recent played
    fetch(`${API_URL}/api/playlist/recent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id })
    }).catch(() => {});
}

// Play/Pause
function togglePlay() {
    if (!audio) {
        if (tracks.length > 0) {
            loadTrack(currentTrackIndex);
            setTimeout(() => playAudio(), 100);
        }
        return;
    }

    if (isPlaying) {
        audio.pause();
        isPlaying = false;
        playIcon.className = 'fas fa-play';
        clearInterval(progressInterval);
        progressInterval = null;
    } else {
        playAudio();
    }
}

function playAudio() {
    if (!audio) return;
    
    audio.play().catch(error => {
        console.error('Error playing audio:', error);
        // Try reloading
        if (audio.src) {
            audio.load();
            audio.play().catch(() => {});
        }
    });
    
    isPlaying = true;
    playIcon.className = 'fas fa-pause';
    
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        if (audio && audio.currentTime !== undefined && tracks[currentTrackIndex]) {
            const track = tracks[currentTrackIndex];
            const pct = Math.min(100, (audio.currentTime / (audio.duration || track.duration)) * 100);
            progressFill.style.width = pct + '%';
            currentTimeSpan.textContent = formatTime(audio.currentTime);
        }
    }, 150);
}

function nextTrack() {
    if (!tracks.length) return;
    let next = (currentTrackIndex + 1) % tracks.length;
    if (shuffle) {
        let newIdx;
        do {
            newIdx = Math.floor(Math.random() * tracks.length);
        } while (newIdx === currentTrackIndex && tracks.length > 1);
        next = newIdx;
    }
    loadTrack(next);
    if (isPlaying) {
        setTimeout(() => playAudio(), 100);
    }
}

function prevTrack() {
    if (!tracks.length) return;
    let prev = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    if (shuffle) {
        let newIdx;
        do {
            newIdx = Math.floor(Math.random() * tracks.length);
        } while (newIdx === currentTrackIndex && tracks.length > 1);
        prev = newIdx;
    }
    loadTrack(prev);
    if (isPlaying) {
        setTimeout(() => playAudio(), 100);
    }
}

// Progress bar click
function handleProgressClick(e) {
    if (!audio || !tracks[currentTrackIndex]) return;
    const rect = progressBar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const track = tracks[currentTrackIndex];
    const seekTime = ratio * (audio.duration || track.duration);
    audio.currentTime = seekTime;
    currentTimeSpan.textContent = formatTime(seekTime);
    progressFill.style.width = (ratio * 100) + '%';
}

// Render playlist
function renderPlaylist() {
    playlistContainer.innerHTML = '';
    if (!tracks.length) {
        playlistContainer.innerHTML = '<div style="padding:1rem; text-align:center; color:#6e8fc9;">No tracks uploaded yet. Upload some music!</div>';
        return;
    }

    tracks.forEach((track, idx) => {
        const item = document.createElement('div');
        item.className = `playlist-item ${idx === currentTrackIndex ? 'active' : ''}`;
        item.innerHTML = `
            <span class="idx">${idx+1}</span>
            <div class="info">
                <div class="title">${track.title}</div>
                <div class="artist">${track.artist}</div>
            </div>
            <span class="duration">${formatTime(track.duration)}</span>
            <span class="play-indicator"><i class="fas fa-${idx === currentTrackIndex && isPlaying ? 'pause' : 'play'}-circle"></i></span>
        `;
        item.addEventListener('click', () => {
            if (idx === currentTrackIndex) {
                togglePlay();
            } else {
                loadTrack(idx);
                setTimeout(() => {
                    if (audio && isPlaying) {
                        playAudio();
                    } else if (audio) {
                        // If was playing, auto-play new track
                        isPlaying = true;
                        playAudio();
                    }
                }, 100);
            }
        });
        playlistContainer.appendChild(item);
    });
}

// Like functionality
async function toggleLike() {
    if (!tracks[currentTrackIndex]) return;
    const trackId = tracks[currentTrackIndex].id;
    
    try {
        const response = await fetch(`${API_URL}/api/playlist/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackId })
        });
        const data = await response.json();
        const isLiked = likedTracks.has(trackId);
        
        if (isLiked) {
            likedTracks.delete(trackId);
            likeBtn.innerHTML = '<i class="far fa-heart"></i>';
            likeBtn.classList.remove('liked');
        } else {
            likedTracks.add(trackId);
            likeBtn.innerHTML = '<i class="fas fa-heart" style="color:#f05a7a;"></i>';
            likeBtn.classList.add('liked');
        }
        
        // Update like count
        const favResponse = await fetch(`${API_URL}/api/playlist/favorites`);
        const favorites = await favResponse.json();
        likeCount.textContent = favorites.length;
        
    } catch (error) {
        console.error('Error toggling like:', error);
    }
}

// Upload functionality
uploadBtn.addEventListener('click', () => {
    uploadModal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    uploadModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === uploadModal) {
        uploadModal.style.display = 'none';
    }
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    
    try {
        const response = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const newTrack = await response.json();
            tracks.push(newTrack);
            trackCount.textContent = tracks.length;
            renderPlaylist();
            uploadModal.style.display = 'none';
            uploadForm.reset();
            // Load the new track if it's the only one
            if (tracks.length === 1) {
                loadTrack(0);
            }
        } else {
            const error = await response.json();
            alert('Upload failed: ' + error.error);
        }
    } catch (error) {
        alert('Error uploading track: ' + error.message);
    }
});

// Event Listeners
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', prevTrack);
nextBtn.addEventListener('click', nextTrack);
progressBar.addEventListener('click', handleProgressClick);

shuffleBtn.addEventListener('click', () => {
    shuffle = !shuffle;
    shuffleBtn.style.color = shuffle ? '#7b9cf0' : '#a1bbec';
});

repeatBtn.addEventListener('click', () => {
    repeat = !repeat;
    repeatBtn.style.color = repeat ? '#7b9cf0' : '#a1bbec';
});

likeBtn.addEventListener('click', toggleLike);

volumeSlider.addEventListener('input', (e) => {
    if (audio) audio.volume = parseFloat(e.target.value);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlay();
    }
    if (e.code === 'ArrowRight' && e.target === document.body) {
        e.preventDefault();
        nextTrack();
    }
    if (e.code === 'ArrowLeft' && e.target === document.body) {
        e.preventDefault();
        prevTrack();
    }
});

// Initialize
fetchTracks();

// Check favorites on load
async function loadFavorites() {
    try {
        const response = await fetch(`${API_URL}/api/playlist/favorites`);
        const favorites = await response.json();
        favorites.forEach(t => likedTracks.add(t.id));
        likeCount.textContent = favorites.length;
    } catch (error) {
        console.error('Error loading favorites:', error);
    }
}
loadFavorites();

console.log('🎵 Vibe Music Player loaded!');
console.log(`📊 ${tracks.length} tracks available`);
