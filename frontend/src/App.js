// frontend/src/App.js

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
  const messagesEndRef = useRef(null); // Mesajların sonuna otomatik kaydırma için

  // Chatbot mesajları her güncellendiğinde en alta kaydır
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);


  // Film türlerini API'den çekme
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/genres');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setGenres(data);
      } catch (e) {
        console.error("Film türleri çekilirken hata oluştu:", e);
        setError("Film türleri yüklenemedi.");
      }
    };
    fetchGenres();
  }, []);

  // Film önerilerini API'den çekme (Sayfalama için 'page' parametresi eklendi)
  const fetchMovies = async (query = '', genreId = '', page = 1) => {
    setLoading(true);
    setError(null);
    let url = 'http://localhost:5000/api/recommend';

    const params = new URLSearchParams();
    if (query) {
      params.append('query', query);
    }
    if (genreId) {
      params.append('genre_id', genreId);
    }
    params.append('page', page); // Sayfa parametresini her zaman ekle

    if (params.toString()) {
      url = `${url}?${params.toString()}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setMovies(data);
    } catch (e) {
      console.error("Filmler çekilirken hata oluştu:", e);
      setError("Filmler yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.");
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  // Bileşen yüklendiğinde popüler filmleri göster
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

  // Chatbot mesajı gönderme
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newUserMessage = { sender: 'user', text: chatInput };
    setChatMessages(prevMessages => [...prevMessages, newUserMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: newUserMessage.text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let botMessageText = data.message || "Anlamadım, tekrar dener misin?";
      
      if (data.recommendations && data.recommendations.length > 0) {
        // Eğer chatbot film önerileri döndürdüyse, onları movie listesine ekle
        setMovies(data.recommendations);
        botMessageText = data.message || "İşte senin için bulduğum filmler:";
      }

      const newBotMessage = { sender: 'bot', text: botMessageText };
      setChatMessages(prevMessages => [...prevMessages, newBotMessage]);

    } catch (e) {
      console.error("Chatbot ile iletişimde hata oluştu:", e);
      setChatMessages(prevMessages => [
        ...prevMessages,
        { sender: 'bot', text: "Üzgünüm, chatbot'a şu an ulaşılamıyor. Lütfen daha sonra tekrar deneyin." }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Film Öneri Sistemi</h1>
      </header>

      <div className="main-content">
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
              {genres.map(genre => (
                <option key={genre.id} value={genre.id}>{genre.name}</option>
              ))}
            </select>
          </div>

          {loading && <p>Filmler yükleniyor...</p>}
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
                  <p>IMDb: {movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</p>
                  <p>{movie.overview && movie.overview.length > 150 ? movie.overview.substring(0, 150) + '...' : movie.overview}</p>
                  <p className="release-date">Çıkış Tarihi: {movie.release_date || 'Bilinmiyor'}</p>
                </div>
              ))
            ) : (
              !loading && !error && <p>Gösterilecek film bulunamadı. Lütfen arama yapın veya bir tür seçin.</p>
            )}
          </div>
        </div>

        <div className="chatbot-section">
          <div className="chat-window">
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <div className="welcome-message">
                  Merhaba! Film önerileri için bana sorular sorabilirsin.
                </div>
              )}
              {chatMessages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.sender}`}>
                  <span className="sender-label">{msg.sender === 'user' ? 'Sen:' : 'Bot:'}</span> {msg.text}
                </div>
              ))}
              {chatLoading && <div className="chat-message bot loading">Bot yazıyor...</div>}
              <div ref={messagesEndRef} /> {/* Otomatik kaydırma için */}
            </div>
            <form onSubmit={handleChatSubmit} className="chat-input-form">
              <input
                type="text"
                placeholder="Mesajını yaz..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
              />
              <button type="submit" disabled={chatLoading}>Gönder</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;