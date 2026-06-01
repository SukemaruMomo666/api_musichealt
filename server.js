import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Mendapatkan Access Token dari URL RESMI Spotify
async function getSpotifyToken() {
  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return response.data.access_token;
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { moodText } = req.body;

    // 1. Doktrin Gemini agar patuh pada request artis/genre
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Saya sedang merasa atau ingin: "${moodText}".
    Sebagai asisten musik cerdas:
    1. Jika saya menyebut genre spesifik (rap, rock, dll) atau artis, WAJIB jadikan itu keyword utama (Contoh: "Eminem rap", "Upbeat Rock").
    2. Jika hanya curhat, berikan keyword mood bahasa Inggris (contoh: "lofi sleep", "sad piano").
    3. Berikan 1 kalimat empati/reaksi asik bahasa Indonesia.
    
    Format balasan (harus persis begini, beda baris):
    Keyword: [kata kunci pencarian]
    Pesan: [kalimat empati / reaksi]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const keywordMatch = responseText.match(/Keyword:\s*(.*)/i);
    const pesanMatch = responseText.match(/Pesan:\s*(.*)/i);
    
    const keyword = keywordMatch ? keywordMatch[1].trim() : "chill lofi";
    const pesan = pesanMatch ? pesanMatch[1].trim() : "Musik ini disiapkan khusus buat kamu.";

    // 2. Minta lagu ke URL RESMI Spotify Search API
    const token = await getSpotifyToken();
    const spotifyUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(keyword)}&type=track&limit=3`;
    
    const spotifyResponse = await axios.get(spotifyUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 3. Ekstrak data lengkap untuk 3 tombol di frontend
    const songsData = spotifyResponse.data.tracks.items.map(track => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      cover: track.album.images[0]?.url,
      previewUrl: track.preview_url || track.external_urls.spotify,
      spotifyUrl: track.external_urls.spotify,
      genre: "Spotify Track" 
    }));

    res.json({ pesan, keyword, songs: songsData });

  } catch (error) {
    console.error("Error Sistem:", error.response?.data || error.message);
    res.status(500).json({ error: "Gagal mengambil data dari Spotify." });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server Spotify Ready di http://localhost:${PORT}`));