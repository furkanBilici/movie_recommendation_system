import json
import google.generativeai as genai
from config import Config

genai.configure(api_key=Config.GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

class AIService:
    @staticmethod
    def get_recommendations(user_message):
        """Kullanıcı mesajına göre film isimleri listesi döndürür."""
        prompt = (
            f"Kullanıcı bir film asistanıyla konuşuyor. Mesaj: '{user_message}'. "
            "Görevin: Bu mesaja uygun film önerileri bulmak.\n"
            "ÇIKTI FORMATI: Kesinlikle sadece saf bir JSON array (liste) döndür. "
            "Başka hiçbir metin, açıklama veya markdown (```json gibi) ekleme.\n"
            "Örnek: ['The Matrix', 'Inception', 'Interstellar']\n"
            "Eğer kullanıcı film sormuyorsa veya öneri yoksa boş liste [] döndür."
        )

        try:
            response = model.generate_content(prompt)
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            
            try:
                movie_titles = json.loads(clean_text)
                message = "İşte senin için seçtiğim filmler:"
                return movie_titles, message
            except (json.JSONDecodeError, TypeError):
                return [], "Şu an tam olarak film listesi çıkaramadım, istersen tekrar dene."

        except Exception as e:
            print(f"AI Error: {e}")
            return [], "Yapay zeka servisi şu an yanıt veremiyor."