import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// --- YARDIMCI BİLEŞEN: YILDIZ PUANLAMA ---
const StarRating = ({ rating, setRating, readOnly = false }) => {
  return (
    <div className="star-rating">
      {[...Array(10)].map((star, index) => {
        index += 1;
        return (
          <button
            type="button"
            key={index}
            className={index <= rating ? "on" : "off"}
            onClick={() => !readOnly && setRating(index)}
            disabled={readOnly}
            style={{background:'none', border:'none', cursor: readOnly ? 'default':'pointer', fontSize:'1.2rem', color: index <= rating ? '#e50914' : '#ccc'}}
          >
            &#9733;
          </button>
        );
      })}
    </div>
  );
};

function App() {
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Auth State
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  
  // Pagination & Filter
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState('popular');

  // Modal & Comments
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [userRating, setUserRating] = useState(0);

  // Chatbot
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null); 

  // --- KULLANICI KONTROLÜ (GÜVENLİ HALE GETİRİLDİ) ---
  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/current_user', {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include' 
        });
        if (res.ok) {
            const data = await res.json();
            if(data.username) setUser(data);
        }
      } catch (error) {
        console.warn("Backend'e ulaşılamadı, kullanıcı kontrolü yapılamadı.");
      }
    };
    checkUser();
  }, []);

  // Türleri çek (Güvenli)
  useEffect(() => {
    fetch('http://localhost:5000/api/genres')
      .then(res => {
          if (!res.ok) throw new Error("Backend Bağlantı Hatası");
          return res.json();
      })
      .then(data => setGenres(data))
      .catch(err => console.log("Türler yüklenemedi (Backend kapalı olabilir)"));
  }, []);

  // Filmleri çek (Güvenli)
  const fetchMovies = async (query = '', genreId = '', page = 1, currentFilter = 'popular') => {
    setLoading(true);
    let url = 'http://localhost:5000/api/recommend';
    const params = new URLSearchParams({ query, genre_id: genreId, page, filter_type: currentFilter });
    
    try {
      const response = await fetch(`${url}?${params}`);
      if (!response.ok) throw new Error("Veri çekilemedi");
      const data = await response.json();
      if (data.results) {
          setMovies(data.results);
          setTotalPages(data.total_pages);
      } else {
          setMovies([]);
      }
    } catch (e) { 
      console.error("Film yükleme hatası:", e);
      setMovies([]); // Hata olsa bile boş liste göster, patlama
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchMovies('', '', 1, 'popular'); }, []);

  // --- AUTH İŞLEMLERİ (GÜVENLİ) ---
  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
    const username = e.target.username.value;
    const password = e.target.password.value;
    const email = authMode === 'register' ? e.target.email.value : null;

    try {
        const response = await fetch(`http://localhost:5000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email }),
            credentials: 'include'
        });
        
        const data = await response.json();
        if(response.ok) {
            if(authMode === 'login') {
                setUser(data);
                setShowAuthModal(false);
            } else {
                alert("Kayıt başarılı! Şimdi giriş yapın.");
                setAuthMode('login');
            }
        } else {
            alert(data.error || "Bir hata oluştu");
        }
    } catch (error) {
        alert("Sunucuya bağlanılamadı. Lütfen terminali kontrol et.");
    }
  };

  const handleLogout = async () => {
      try {
          await fetch('http://localhost:5000/api/logout', { method: 'POST', credentials: 'include' });
          setUser(null);
          // Sayfayı yenile ve en başa dön
          window.location.href = '/';
      } catch (error) { console.error("Çıkış hatası", error); }
  };

  // --- YORUM İŞLEMLERİ (GÜVENLİ) ---
  const loadComments = async (movieId) => {
      try {
          const res = await fetch(`http://localhost:5000/api/comments/${movieId}`);
          if(res.ok) {
              const data = await res.json();
              setComments(data);
          }
      } catch (error) { console.error("Yorumlar yüklenemedi", error); }
  };

  const handlePostComment = async () => {
      if(!newComment.trim()) return;
      
      try {
          const res = await fetch('http://localhost:5000/api/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ movie_id: selectedMovie.id, content: newComment }),
              credentials: 'include'
          });

          if (!res.ok) throw new Error("Yorum gönderilemedi");

          // Puanlama
          if(userRating > 0) {
              await fetch('http://localhost:5000/api/rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movie_id: selectedMovie.id, score: userRating }),
                credentials: 'include'
            });
          }

          setNewComment('');
          loadComments(selectedMovie.id);
      } catch (error) {
          alert("Yorum gönderilirken hata oluştu. Giriş yaptığından emin ol.");
      }
  };

  const handleDeleteComment = async (commentId) => {
      if(window.confirm("Yorumu silmek istediğine emin misin?")) {
          try {
              await fetch(`http://localhost:5000/api/comments/${commentId}`, {
                  method: 'DELETE', credentials: 'include'
              });
              loadComments(selectedMovie.id);
          } catch (e) { alert("Silinemedi"); }
      }
  };

  const openModal = (movie) => {
      setSelectedMovie(movie);
      setComments([]); 
      loadComments(movie.id); 
  };

  // --- STANDART FONKSİYONLAR ---
  const handleSearch = (e) => { e.preventDefault(); setCurrentPage(1); fetchMovies(searchTerm, '', 1, filterType); };
  const handleGenreChange = (e) => { setSelectedGenre(e.target.value); fetchMovies('', e.target.value, 1, 'popular'); };
  const handleFilterChange = (e) => { setFilterType(e.target.value); setCurrentPage(1); fetchMovies('', '', 1, e.target.value); };
  
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput;
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput(''); setChatLoading(true);
    try {
        const res = await fetch('http://localhost:5000/api/chatbot', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userText })
        });
        if (!res.ok) throw new Error("Chatbot hatası");
        const data = await res.json();
        if(data.recommendations) setMovies(data.recommendations);
        setChatMessages(prev => [...prev, { sender: 'bot', text: data.message }]);
    } catch { 
        setChatMessages(prev => [...prev, { sender: 'bot', text: "Bağlantı hatası, üzgünüm." }]);
    } finally { setChatLoading(false); }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎬 MOVIE COMMUNITY</h1>
        <div className="auth-buttons">
            {user ? (
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <span>Hoş geldin, <b>{user.username}</b></span>
                    <button onClick={handleLogout} style={{background:'#333'}}>Çıkış</button>
                </div>
            ) : (
                <button onClick={() => setShowAuthModal(true)}>Giriş Yap / Kayıt Ol</button>
            )}
        </div>
      </header>

      {/* --- ANA İÇERİK --- */}
      <div className="main-content">
        <div className="movie-section">
            <div className="controls">
                <form onSubmit={handleSearch} className="search-form">
                    <input type="text" placeholder="Film ara..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
                    <button type="submit">ARA</button>
                </form>
                <div className="filter-group" style={{display:'flex', gap:'10px'}}>
                    <select onChange={handleGenreChange} value={selectedGenre} className="genre-select">
                        <option value="">Tüm Türler</option>
                        {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <select onChange={handleFilterChange} value={filterType} className="genre-select" style={{color: filterType==='community_top'?'#e50914':'white'}}>
                        <option value="popular">🔥 Popüler</option>
                        <option value="top_rated">⭐ TMDB Top Rated</option>
                        <option value="community_top">🏆 Topluluk Favorileri</option>
                    </select>
                </div>
            </div>
            
            {loading && <div className="loading-spinner">Yükleniyor...</div>}
            
            <div className="movie-list">
                {movies.length > 0 ? movies.map(movie => (
                    <div key={movie.id} className="movie-card" onClick={() => openModal(movie)}>
                        {movie.poster_path ? <img src={movie.poster_path} alt={movie.title}/> : <div className="no-image">No Image</div>}
                        <div className="movie-overlay">
                            <h2>{movie.title}</h2>
                            <span className="rating">{movie.vote_average?.toFixed(1)}</span>
                        </div>
                    </div>
                )) : (
                    !loading && <p style={{textAlign:'center', width:'100%', marginTop:'20px'}}>
                        Film bulunamadı veya sunucuya bağlanılamıyor. <br/> 
                        <small>Lütfen 'python run.py' çalıştığından emin olun.</small>
                    </p>
                )}
            </div>

            {/* Pagination Controls */}
             {movies.length > 0 && totalPages > 1 && (
                <div className="pagination-controls" style={{display: 'flex', justifyContent: 'center', gap: '20px', padding: '20px', alignItems: 'center'}}>
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>&laquo; Önceki</button>
                    <span>Sayfa {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Sonraki &raquo;</button>
                </div>
            )}
        </div>
        
        {/* CHATBOT KISMI - App.js içindeki yeriyle değiştirin */}
        <div className="chatbot-section">
             <div className="chat-window">
                {/* Yeni Başlık */}
                <div className="chat-header">
                    <div className="bot-avatar-header">🤖</div>
                    <div style={{display:'flex', flexDirection:'column'}}>
                        <span>Film Asistanı</span>
                        <span style={{fontSize:'0.7rem', opacity:0.8, fontWeight:'normal'}}>Çevrimiçi</span>
                    </div>
                </div>

                <div className="chat-messages">
                    {/* Karşılama Mesajı */}
                    {chatMessages.length === 0 && (
                        <div style={{textAlign:'center', marginTop:'50px', opacity:0.6}}>
                            <div style={{fontSize:'3rem', marginBottom:'10px'}}>👋</div>
                            <p>Merhabalar! <br/> "Bana aksiyon filmleri öner" diyebilirsin.</p>
                        </div>
                    )}

                    {chatMessages.map((msg, i) => (
                        <div key={i} className={`chat-message ${msg.sender}`}>
                            {msg.text}
                        </div>
                    ))}

                    {/* Yeni Animasyonlu Yazıyor Göstergesi */}
                    {chatLoading && (
                        <div className="typing-indicator">
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleChatSubmit} className="chat-input-form">
                    <input 
                        value={chatInput} 
                        onChange={e=>setChatInput(e.target.value)} 
                        placeholder="Bir şeyler yaz..." 
                        disabled={chatLoading}
                    />
                    <button type="submit" disabled={chatLoading}>
                        {chatLoading ? '⏳' : '➤'}
                    </button>
                </form>
             </div>
        </div>
      </div>

      {/* --- AUTH MODAL (GÜNCELLENDİ: auth-overlay eklendi) --- */}
      {showAuthModal && (
          // BURAYA DİKKAT: 'auth-overlay' sınıfını ekledik 👇
          <div className="modal-overlay auth-overlay" onClick={()=>setShowAuthModal(false)}>
              <div className="modal-content auth-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:'400px', flexDirection:'column', padding:'30px', maxHeight:'90vh'}}>
                  {/* ... (içerik aynı kalacak) ... */}
                  <h2 style={{color:'white'}}>{authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}</h2>
                  <form onSubmit={handleAuth} style={{display:'flex', flexDirection:'column', gap:'15px', width:'100%'}}>
                      <input name="username" placeholder="Kullanıcı Adı" required style={{padding:'12px', borderRadius:'5px', border:'1px solid #444', background:'#222', color:'white'}}/>
                      {authMode === 'register' && <input name="email" type="email" placeholder="E-posta" required style={{padding:'12px', borderRadius:'5px', border:'1px solid #444', background:'#222', color:'white'}}/>}
                      <input name="password" type="password" placeholder="Şifre" required style={{padding:'12px', borderRadius:'5px', border:'1px solid #444', background:'#222', color:'white'}}/>
                      <button type="submit" style={{padding:'12px', background:'#e50914', color:'white', border:'none', borderRadius:'5px', fontWeight:'bold', cursor:'pointer'}}>{authMode === 'login' ? 'Giriş' : 'Kayıt Ol'}</button>
                  </form>
                  <p style={{marginTop:'15px', cursor:'pointer', color:'#ccc', textAlign:'center'}} onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>
                      {authMode === 'login' ? 'Hesabın yok mu? Kayıt Ol' : 'Zaten üye misin? Giriş Yap'}
                  </p>
              </div>
          </div>
      )}

      {/* --- FİLM DETAY MODAL --- */}
      {selectedMovie && (
        <div className="modal-overlay" onClick={()=>setSelectedMovie(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={()=>setSelectedMovie(null)}>&times;</button>
            <div className="modal-image-container">
               {selectedMovie.poster_path && <img src={selectedMovie.poster_path} alt={selectedMovie.title} />}
            </div>
            <div className="modal-details">
              <h2>{selectedMovie.title}</h2>
              <p className="modal-overview">{selectedMovie.overview}</p>
              
              <hr style={{borderColor:'#333', margin:'20px 0'}}/>
              
              <div className="comments-section">
                  <h3 style={{color:'white'}}>Topluluk Yorumları</h3>
                  
                  {user ? (
                      <div className="add-comment">
                          <textarea 
                            value={newComment} 
                            onChange={e=>setNewComment(e.target.value)} 
                            placeholder="Bu film hakkında ne düşünüyorsun?"
                            style={{width:'100%', background:'#222', color:'white', border:'1px solid #444', borderRadius:'5px', padding:'10px', minHeight:'60px'}}
                          />
                          <div style={{display:'flex', justifyContent:'space-between', marginTop:'10px', alignItems:'center'}}>
                              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                  <span style={{color:'#ccc'}}>Puanın:</span>
                                  <StarRating rating={userRating} setRating={setUserRating} />
                              </div>
                              <button onClick={handlePostComment} style={{background:'#e50914', color:'white', border:'none', padding:'8px 20px', borderRadius:'5px', cursor:'pointer'}}>Gönder</button>
                          </div>
                      </div>
                  ) : (
                      <p style={{color:'#e50914', cursor:'pointer', textAlign:'center', padding:'10px', border:'1px dashed #e50914', borderRadius:'5px'}} onClick={()=>setShowAuthModal(true)}>
                        Yorum yapmak ve puan vermek için <b>Giriş Yap</b>
                      </p>
                  )}

                 <div className="comments-list" style={{marginTop:'20px', maxHeight:'300px', overflowY:'auto'}}>
                      {comments.length === 0 && <p style={{color:'#888'}}>Henüz yorum yok. İlk yorumu sen yap!</p>}
                      {comments.map(c => (
                          <div key={c.id} className="comment-item" style={{background:'#222', padding:'15px', marginBottom:'10px', borderRadius:'8px', border:'1px solid #333'}}>
                              
                              {/* --- YORUM BAŞLIĞI GÜNCELLENDİ --- */}
                              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', alignItems:'center'}}>
                                  <div style={{display:'flex', alignItems:'center'}}>
                                      <strong style={{color:'#e50914', marginRight:'5px'}}>{c.author}</strong>
                                      
                                      {/* Eğer kullanıcı puan verdiyse yıldızları göster */}
                                      {c.user_score > 0 && (
                                          <span className="comment-stars" title={`${c.user_score} Puan`}>
                                              {/* Dolu Yıldız (★) Tek bir tane koyup yanına puan yazabiliriz veya döngü yapabiliriz. 
                                                  Sadelik için: ★ 8/10 formatı yapalım */}
                                              ★ {c.user_score}/10
                                          </span>
                                      )}
                                  </div>
                                  <span style={{fontSize:'0.8rem', color:'#888'}}>{c.timestamp}</span>
                              </div>
                              {/* ---------------------------------- */}

                              <p style={{color:'#ddd', margin:'0'}}>{c.body}</p>
                              {user && user.id === c.user_id && (
                                  <button onClick={()=>handleDeleteComment(c.id)} style={{fontSize:'0.7rem', marginTop:'10px', padding:'4px 8px', background:'#333', color:'#e50914', border:'none', cursor:'pointer', borderRadius:'4px'}}>Sil</button>
                              )}
                          </div>
                      ))}
                  </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;