const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Remove spaces and special characters
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, Date.now() + '_' + safeName);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg'];
        if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|ogg)$/)) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    },
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Sample music data - in production this would be a database
let musicLibrary = [
    {
        id: 1,
        title: "Midnight Glow",
        artist: "Luna Echo",
        duration: 196,
        cover: "/api/placeholder/400/400",
        file: "/assets/sample1.mp3"
    },
    {
        id: 2,
        title: "Neon Waves",
        artist: "Astral Pilot",
        duration: 204,
        cover: "/api/placeholder/400/400",
        file: "/assets/sample2.mp3"
    },
    {
        id: 3,
        title: "Velvet Sky",
        artist: "Rhea Solar",
        duration: 178,
        cover: "/api/placeholder/400/400",
        file: "/assets/sample3.mp3"
    },
    {
        id: 4,
        title: "Ocean Drive",
        artist: "Polaris Beats",
        duration: 212,
        cover: "/api/placeholder/400/400",
        file: "/assets/sample4.mp3"
    },
    {
        id: 5,
        title: "Golden Hour",
        artist: "Aurora Sky",
        duration: 163,
        cover: "/api/placeholder/400/400",
        file: "/assets/sample5.mp3"
    },
    {
        id: 6,
        title: "Echo Park",
        artist: "Night Tempo",
        duration: 189,
        cover: "/api/placeholder/400/400",
        file: "/assets/sample6.mp3"
    }
];

let playlists = {
    favorites: [],
    recentlyPlayed: []
};

// API Routes

// Get all tracks
app.get('/api/tracks', (req, res) => {
    res.json(musicLibrary);
});

// Get a single track
app.get('/api/tracks/:id', (req, res) => {
    const track = musicLibrary.find(t => t.id === parseInt(req.params.id));
    if (track) {
        res.json(track);
    } else {
        res.status(404).json({ error: 'Track not found' });
    }
});

// Stream audio file
app.get('/api/stream/:id', (req, res) => {
    const track = musicLibrary.find(t => t.id === parseInt(req.params.id));
    if (!track) {
        return res.status(404).json({ error: 'Track not found' });
    }

    const filePath = path.join(__dirname, 'public', track.file);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        // Return a sample audio or error
        return res.status(404).json({ error: 'Audio file not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// Upload new track
app.post('/api/upload', upload.single('audio'), (req, res) => {
    try {
        const { title, artist } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const newTrack = {
            id: musicLibrary.length + 1,
            title: title || path.parse(file.originalname).name,
            artist: artist || 'Unknown Artist',
            duration: 0, // You would need to get this from audio metadata
            cover: '/api/placeholder/400/400',
            file: `/assets/${file.filename}`
        };

        musicLibrary.push(newTrack);
        res.status(201).json(newTrack);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete track
app.delete('/api/tracks/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const trackIndex = musicLibrary.findIndex(t => t.id === id);
    
    if (trackIndex === -1) {
        return res.status(404).json({ error: 'Track not found' });
    }

    const track = musicLibrary[trackIndex];
    // Delete file if exists
    const filePath = path.join(__dirname, 'public', track.file);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    musicLibrary.splice(trackIndex, 1);
    res.json({ message: 'Track deleted successfully' });
});

// Update playlist (favorites)
app.post('/api/playlist/favorites', (req, res) => {
    const { trackId } = req.body;
    const track = musicLibrary.find(t => t.id === trackId);
    
    if (!track) {
        return res.status(404).json({ error: 'Track not found' });
    }

    const index = playlists.favorites.indexOf(trackId);
    if (index === -1) {
        playlists.favorites.push(trackId);
        res.json({ message: 'Added to favorites', favorites: playlists.favorites });
    } else {
        playlists.favorites.splice(index, 1);
        res.json({ message: 'Removed from favorites', favorites: playlists.favorites });
    }
});

// Get favorites
app.get('/api/playlist/favorites', (req, res) => {
    const favoriteTracks = musicLibrary.filter(t => playlists.favorites.includes(t.id));
    res.json(favoriteTracks);
});

// Track recently played
app.post('/api/playlist/recent', (req, res) => {
    const { trackId } = req.body;
    const track = musicLibrary.find(t => t.id === trackId);
    
    if (track) {
        playlists.recentlyPlayed = playlists.recentlyPlayed.filter(id => id !== trackId);
        playlists.recentlyPlayed.unshift(trackId);
        if (playlists.recentlyPlayed.length > 50) {
            playlists.recentlyPlayed.pop();
        }
    }
    res.json({ recentlyPlayed: playlists.recentlyPlayed });
});

// Get recently played
app.get('/api/playlist/recent', (req, res) => {
    const recentTracks = musicLibrary.filter(t => playlists.recentlyPlayed.includes(t.id));
    res.json(recentTracks);
});

// Serve the main page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🎵 Music server running on http://localhost:${PORT}`);
    console.log(`📁 Upload directory: ${uploadDir}`);
});
