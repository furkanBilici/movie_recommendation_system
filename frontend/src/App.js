import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Chatbot state'leri
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null); 

  // Mesaj gelince aşağı kaydır
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Türleri çek
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/genres');
        if (response.ok) {
          const data = await response.json();
          setGenres(data);
        }
      } catch (e) {
        console.error("Tür hatası:", e);
      }
    };
    fetchGenres();
  }, []);

  // Filmleri çek
  const fetchMovies = async (query = '', genreId = '', page = 1) => {
    setLoading(true);
    setError(null);
    let url = 'http://localhost:5000/api/recommend';

    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (genreId) params.append('genre_id', genreId);
    params.append('page', page);

    if (params.toString()) url = `${url}?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("API Hatası");
      const data = await response.json();
      setMovies(data);
    } catch (e) {
      setError("Filmler yüklenirken bir sorun oluştu.");
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  // İlk yükleme
  useEffect(() => {
    fetchMovies();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMovies(searchTerm, '');
    setSelectedGenre('');
  };

  const handleGenreChange = (e) => {
    const genreId = e.target.value;
    setSelectedGenre(genreId);
    setSearchTerm('');
    fetchMovies('', genreId);
  };

  // Chatbot Gönderim
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok) throw new Error("Chat hatası");

      const data = await response.json();
      
      // Eğer chatbot film önerdiyse ana listeyi güncelle
      if (data.recommendations && data.recommendations.length > 0) {
        setMovies(data.recommendations);
      }

      setChatMessages(prev => [...prev, { sender: 'bot', text: data.message }]);

    } catch (e) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'bot', text: "Bir hata oluştu, lütfen tekrar dene." }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎬 Yapay Zeka Film Asistanı</h1>
      </header>

      <div className="main-content">
        {/* SOL TARAF: FİLMLER */}
        <div className="movie-section">
          <div className="controls">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Film ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit">Ara</button>
            </form>

            <select onChange={handleGenreChange} value={selectedGenre} className="genre-select">
              <option value="">Tüm Türler</option>
              {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {loading && <div className="loading-spinner">Filmler yükleniyor...</div>}
          {error && <p className="error-message">{error}</p>}

          <div className="movie-list">
            {movies.length > 0 ? (
              movies.map(movie => (
                <div key={movie.id} className="movie-card">
                  {movie.poster_path ? (
                    <img src={movie.poster_path} alt={movie.title} />
                  ) : (
                    <div className="no-image">Resim Yok</div>
                  )}
                  <h2>{movie.title}</h2>
                  <p>⭐ {movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</p>
                  <p className="overview">{movie.overview ? movie.overview.substring(0, 100) + '...' : ''}</p>
                  <p className="release-date">{movie.release_date || 'Tarih Yok'}</p>
                </div>
              ))
            ) : (
              !loading && !error && <p>Film bulunamadı.</p>
            )}
          </div>
        </div>

        {/* SAĞ TARAF: CHATBOT */}
        <div className="chatbot-section">
          <div className="chat-window">
            <div className="chat-header">Asistana Sor</div>
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <div className="welcome-message">
                  "Bana aksiyon filmleri öner" veya "Titanic gibi filmler göster" diyebilirsin.
                </div>
              )}
              {chatMessages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.sender}`}>
                  {msg.text}
                </div>
              ))}
              {chatLoading && <div className="chat-message bot typing">Yazıyor...</div>}
              <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleChatSubmit} className="chat-input-form">
              <input
                type="text"
                placeholder="Buraya yazın..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
              />
              <button type="submit" disabled={chatLoading}>
                {chatLoading ? '...' : 'Gönder'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;