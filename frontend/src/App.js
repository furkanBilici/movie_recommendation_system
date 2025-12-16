import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // --- YENİ EKLENEN: Sayfalama ve Filtre State'leri ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState('popular'); // 'popular' veya 'top_rated'

  // Modal State'i
  const [selectedMovie, setSelectedMovie] = useState(null);

  // Chatbot state'leri
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null); 

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

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

  // --- GÜNCELLENEN FETCH FONKSİYONU ---
  const fetchMovies = async (query = '', genreId = '', page = 1, currentFilter = 'popular') => {
    setLoading(true);
    setError(null);
    let url = 'http://localhost:5000/api/recommend';

    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (genreId) params.append('genre_id', genreId);
    params.append('page', page);
    params.append('filter_type', currentFilter); // Filtre tipini gönder

    if (params.toString()) url = `${url}?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("API Hatası");
      const data = await response.json();
      
      // Backend artık { results: [], total_pages: 10 } dönüyor
      if (data.results) {
          setMovies(data.results);
          setTotalPages(data.total_pages);
      } else {
          // Eğer eski formatta dönerse (Chatbot vs)
          setMovies(data); 
      }
      
    } catch (e) {
      setError("Filmler yüklenirken bir sorun oluştu.");
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  // İlk yükleme
  useEffect(() => {
    fetchMovies('', '', 1, 'popular');
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Aramada sayfayı başa al
    fetchMovies(searchTerm, '', 1, filterType);
    setSelectedGenre('');
  };

  const handleGenreChange = (e) => {
    const genreId = e.target.value;
    setSelectedGenre(genreId);
    setSearchTerm('');
    setCurrentPage(1);
    fetchMovies('', genreId, 1, 'popular'); // Tür seçince popüler moda geç
    setFilterType('popular');
  };

  // --- YENİ: Kategori Değişimi (Popüler / Top Rated) ---
  const handleFilterChange = (e) => {
    const newFilter = e.target.value;
    setFilterType(newFilter);
    setCurrentPage(1); // Sayfayı sıfırla
    setSearchTerm(''); // Aramayı temizle
    setSelectedGenre(''); // Türü temizle
    fetchMovies('', '', 1, newFilter);
  };

  // --- YENİ: Sayfa Değiştirme Butonları ---
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchMovies(searchTerm, selectedGenre, newPage, filterType);
      // Sayfa değişince yukarı kaydır
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
      if (data.recommendations && data.recommendations.length > 0) {
        setMovies(data.recommendations);
        // Chatbot önerilerinde sayfalama mantığını devre dışı bırakabiliriz veya gizleyebiliriz
        setTotalPages(1); 
        setCurrentPage(1);
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

  const openModal = (movie) => {
    setSelectedMovie(movie);
  };

  const closeModal = () => {
    setSelectedMovie(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎬 MOVIE AI</h1>
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
              <button type="submit">ARA</button>
            </form>

            <div className="filter-group" style={{display:'flex', gap:'10px'}}>
              <select onChange={handleGenreChange} value={selectedGenre} className="genre-select">
                <option value="">Tüm Türler</option>
                {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>

              {/* --- YENİ EKLENEN: Kategori Seçimi --- */}
              <select onChange={handleFilterChange} value={filterType} className="genre-select" style={{minWidth:'150px', fontWeight:'bold', color: filterType === 'top_rated' ? '#e50914' : 'white'}}>
                <option value="popular">🔥 Popüler</option>
                <option value="top_rated">⭐ En Yüksek Puanlı</option>
              </select>
            </div>
          </div>

          {loading && <div className="loading-spinner">Filmler Yükleniyor...</div>}
          {error && <p className="error-message">{error}</p>}

          <div className="movie-list">
            {movies.length > 0 ? (
              movies.map(movie => (
                <div 
                  key={movie.id} 
                  className="movie-card" 
                  onClick={() => openModal(movie)}
                >
                  {movie.poster_path ? (
                    <img src={movie.poster_path} alt={movie.title} />
                  ) : (
                    <div className="no-image">
                        <img src="https://via.placeholder.com/300x450?text=Resim+Yok" alt="No Image"/>
                    </div>
                  )}

                  <div className="movie-overlay">
                    <h2>{movie.title}</h2>
                    <div className="movie-meta">
                        <span className="rating">IMDb: {movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
                        <span className="date">{movie.release_date ? movie.release_date.split('-')[0] : 'Tarih Yok'}</span>
                    </div>
                    <p className="movie-overview">
                        {movie.overview ? (movie.overview.length > 100 ? movie.overview.substring(0, 100) + "..." : movie.overview) : 'Açıklama bulunamadı.'}
                    </p>
                    <span style={{fontSize: '0.8rem', color: '#e50914', marginTop: '10px', display:'block'}}>Detaylar için tıkla &rarr;</span>
                  </div>
                </div>
              ))
            ) : (
              !loading && !error && <p style={{textAlign: 'center', width: '100%', marginTop: '50px'}}>Film bulunamadı.</p>
            )}
          </div>

          {/* --- YENİ EKLENEN: Sayfalama Kontrolleri --- */}
          {movies.length > 0 && totalPages > 1 && (
            <div className="pagination-controls" style={{display: 'flex', justifyContent: 'center', gap: '20px', padding: '20px', alignItems: 'center'}}>
                <button 
                    onClick={() => handlePageChange(currentPage - 1)} 
                    disabled={currentPage === 1}
                    style={{opacity: currentPage === 1 ? 0.5 : 1}}
                >
                    &laquo; Önceki
                </button>
                
                <span style={{fontWeight: 'bold'}}>Sayfa {currentPage} / {totalPages}</span>
                
                <button 
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages}
                    style={{opacity: currentPage === totalPages ? 0.5 : 1}}
                >
                    Sonraki &raquo;
                </button>
            </div>
          )}

        </div>

        <div className="chatbot-section">
          <div className="chat-window">
            <div className="chat-header">AI Asistan</div>
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <div className="welcome-message" style={{textAlign: 'center', color: '#888', fontStyle: 'italic'}}>
                  <p>👋 Merhaba!</p>
                  <p>"Bugün ne izlesem?" diyebilirsin.</p>
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
                placeholder="Bir şeyler yaz..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
              />
              <button type="submit" disabled={chatLoading}>{chatLoading ? '...' : '➤'}</button>
            </form>
          </div>
        </div>
      </div>

      {selectedMovie && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeModal}>&times;</button>
            <div className="modal-image-container">
              {selectedMovie.poster_path ? (
                <img src={selectedMovie.poster_path} alt={selectedMovie.title} />
              ) : (
                 <div style={{height: '100%', backgroundColor: '#333', display: 'flex', alignItems:'center', justifyContent:'center'}}>Resim Yok</div>
              )}
            </div>
            <div className="modal-details">
              <h2>{selectedMovie.title}</h2>
              <div className="modal-info-row">
                <span className="modal-rating">IMDb {selectedMovie.vote_average ? selectedMovie.vote_average.toFixed(1) : 'N/A'}</span>
                <span>📅 {selectedMovie.release_date}</span>
              </div>
              <p className="modal-overview">
                {selectedMovie.overview || "Bu film için detaylı bir açıklama bulunmuyor."}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;