import os
import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    print("HATA: .env dosyasında API Key yok!")
else:
    print(f"API Key ile sorgu yapılıyor... (Key sonu: ...{API_KEY[-4:]})")
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            print("\n✅ İŞTE KULLANABİLECEĞİN MODELLER:")
            data = response.json()
            found_any = False
            for model in data.get('models', []):
                # Sadece sohbet (generateContent) destekleyenleri filtrele
                if "generateContent" in model.get('supportedGenerationMethods', []):
                    print(f"👉 {model['name']}") # Örn: models/gemini-pro
                    found_any = True
            
            if not found_any:
                print("❌ Hiçbir model 'generateContent' metodunu desteklemiyor görünüyor.")
        else:
            print(f"❌ API Hatası: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Bağlantı Hatası: {e}")