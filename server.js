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
const prompt = `Kamu adalah "Entitas Musik Tertinggi", gabungan dari algoritma FYP TikTok, sejarawan musik global, psikolog, dan kurator playlist kelas dewa.
    Pasien (user) akan memberikan input acak yang bisa berupa: curhatan, lirik salah dengar, tren meme, skenario khayal, atau vibes spesifik.
    Input user: "${moodText}"
    
    TUGAS MUTLAK & SOP:
    1. DEKODE INPUT ABSURD:
       - Jika Lirik Salah Dengar (misal: "kenli mabo"): temukan judul aslinya ("Mariah Carey - Without You").
       - Jika Skenario Spesifik ("naik motor malam hujan", "perang dunia", "ngoding ngantuk"): berikan lagu yang SECARA UNIVERSAL dipakai untuk vibe tersebut (Phonk, Lofi, Synthwave, dll).
       - Jika Tren TikTok/Sosmed ("sigma", "ngedit orang ganteng", "skena", "jedag-jedug", "sadboy"): berikan sound FYP yang paling ikonik (Contoh: Tame Impala, The Weeknd, Arctic Monkeys, Hindia, Danilla, Bernadya).
       - Jika Curhatan Mental: berikan lagu healing/validasi emosi yang liriknya 100% relate (bukan lagu random).
    
    2. KEYWORD SPOTIFY (SANGAT KRUSIAL): 
       Mesin pencari Spotify sangat bodoh jika diberi kata sifat. WAJIB hasilkan SATU Nama Artis dan SATU Judul Lagu nyata yang ada di Spotify. DILARANG KERAS menuliskan genre, mood, atau simbol aneh di baris Keyword. 
       Benar: "The Weeknd - Starboy"
       Salah: "Lagu jedag jedug Starboy"
       
    3. PESAN REAKSI ADAPTIF: 
       Buat 1-2 kalimat respon. Sesuaikan persona dengan input! 
       - Jika user narsis/ngedit -> hype & gaul ("Menyala abangku🔥 Transisi lu bakal makin brutal pake ini.")
       - Jika user sedih/galau -> empati & hangat ("Berat ya? Nangis aja gapapa, lagu ini nemenin kamu malam ini.")
       - Jika input aneh/lucu -> tanggapi dengan sarkas asik atau ketawa.

    Format Wajib (Harus persis ini, tanpa markdown tambahan):
    Keyword: [Nama Artis - Judul Lagu]
    Pesan: [Reaksi adaptifmu]`;

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