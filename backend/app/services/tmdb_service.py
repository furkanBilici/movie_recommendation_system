import requests
import concurrent.futures
from config import Config

class TMDBService:
    @staticmethod
    def format_movie_data(movie):
        return {
            'id': movie.get('id'),
            'title': movie.get('title'),
            'overview': movie.get('overview'),
            'release_date': movie.get('release_date'),
            'vote_average': movie.get('vote_average'),
            'poster_path': f"https://image.tmdb.org/t/p/w500{movie.get('poster_path')}" if movie.get('poster_path') else None
        }

    @staticmethod
    def fetch_movie_by_id(movie_id):
        """Film ID'sine göre detay çeker (Topluluk favorileri için)."""
        url = f"{Config.TMDB_BASE_URL}/movie/{movie_id}"
        params = {
            'api_key': Config.TMDB_API_KEY,
            'language': 'tr-TR'
        }
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                return TMDBService.format_movie_data(response.json())
        except Exception as e:
            print(f"ID ile film çekme hatası ({movie_id}): {e}")
        return None

    @staticmethod
    def fetch_single_movie(title):
        search_url = f"{Config.TMDB_BASE_URL}/search/movie"
        params = {'api_key': Config.TMDB_API_KEY, 'language': 'tr-TR', 'query': title}
        try:
            response = requests.get(search_url, params=params)
            data = response.json()
            if data and data.get('results'):
                return TMDBService.format_movie_data(data['results'][0])
        except Exception:
            pass
        return None

    @staticmethod
    def get_movies(query=None, genre_id=None, page=1, filter_type='popular'):
        params = {'api_key': Config.TMDB_API_KEY, 'language': 'tr-TR', 'page': page}

        if query:
            url = f"{Config.TMDB_BASE_URL}/search/movie"
            params['query'] = query
        elif genre_id:
            url = f"{Config.TMDB_BASE_URL}/discover/movie"
            params['with_genres'] = genre_id
            params['sort_by'] = 'popularity.desc'
        else:
            if filter_type == 'top_rated':
                url = f"{Config.TMDB_BASE_URL}/movie/top_rated"
            else:
                url = f"{Config.TMDB_BASE_URL}/movie/popular"

        response = requests.get(url, params=params)
        data = response.json()
        
        movies = data.get('results', [])
        total_pages = data.get('total_pages', 1)
        if total_pages > 500: total_pages = 500

        formatted_movies = [TMDBService.format_movie_data(m) for m in movies]
        
        return {"results": formatted_movies, "total_pages": total_pages}

    @staticmethod
    def get_genres():
        url = f"{Config.TMDB_BASE_URL}/genre/movie/list"
        params = {'api_key': Config.TMDB_API_KEY, 'language': 'tr-TR'}
        response = requests.get(url, params=params)
        return response.json().get('genres', [])

    @staticmethod
    def fetch_movies_parallel(movie_titles):
        results = []
        if movie_titles:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                futures = executor.map(TMDBService.fetch_single_movie, movie_titles)
                results = [res for res in futures if res is not None]
        return results