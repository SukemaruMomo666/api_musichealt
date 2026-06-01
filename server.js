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

    // Doktrin baru: Gemini jadi Detektif Lagu & Pakar TikTok
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Kamu adalah pakar musik TikTok, pop culture, dan trivia lagu.
    User mencari lagu berdasarkan lirik samar, deskripsi video, referensi film, atau sekadar mood: "${moodText}".
    
    Tugasmu:
    1. TEBAK LAGU SPESIFIKNYA. Jika user memberi petunjuk lirik atau adegan (misal: "cowok duduk di jalan running back to corner"), kamu harus tahu itu "The Script - The Man Who Can't Be Moved".
    2. Jika user hanya curhat galau biasa, pilihkan 1 judul lagu dan artis yang paling pas dan hits.
    3. WAJIB ubah tebakanmu menjadi keyword pencarian literal untuk API Spotify. HANYA isi dengan "Nama Artis Judul Lagu" tanpa embel-embel genre/mood.
    4. Berikan 1 kalimat pesan asik, gaul, atau empati yang nyambung dengan tebakan lagumu.

    Format balasan (harus persis begini, beda baris):
    Keyword: [Nama Artis Judul Lagu]
    Pesan: [Kalimat reaksimu]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const keywordMatch = responseText.match(/Keyword:\s*(.*)/i);
    const pesanMatch = responseText.match(/Pesan:\s*(.*)/i);
    
    // Default fallback jika format meleset
    const keyword = keywordMatch ? keywordMatch[1].trim() : "The Script The Man Who Can't Be Moved";
    const pesan = pesanMatch ? pesanMatch[1].trim() : "Tebakan lagumu agak susah nih, tapi cobain yang ini deh!";

    const token = await getSpotifyToken();
    
    // Lempar Keyword spesifik (Artis + Judul) ke Spotify
    const spotifyUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(keyword)}&type=track&limit=3`;
    
    const spotifyResponse = await axios.get(spotifyUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

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