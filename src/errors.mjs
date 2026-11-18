// Araca özgü hata sınıfları. Hiçbir hata metninde URL ya da API anahtarı bulunmaz.

export class QuotaExceededError extends Error {
  constructor(source, bucket) {
    const kova = bucket === 'search' ? 'arama' : 'birim';
    super(source === 'google'
      ? `YouTube ${kova} kotasının dolduğunu bildirdi`
      : `Yerel günlük ${kova} payı doldu`);
    this.name = 'QuotaExceededError';
    this.source = source; // 'yerel' | 'google'
    this.bucket = bucket; // 'search' | 'units'
  }
}

export class ApiKeyError extends Error {
  constructor(reason) {
    super(`API anahtarı kullanılamıyor (${reason})`);
    this.name = 'ApiKeyError';
    this.reason = reason;
  }
}

export class ApiError extends Error {
  constructor(status, reason, message) {
    super(message || `YouTube API hatası (${status}${reason ? `, ${reason}` : ''})`);
    this.name = 'ApiError';
    this.status = status;
    this.reason = reason;
  }
}

export const KURULUM_MESAJI = [
  'YouTube API anahtarı bulunamadı ya da geçersiz. Kurulum:',
  '  1. https://console.cloud.google.com adresinde bir proje aç.',
  '  2. "YouTube Data API v3"ü etkinleştir.',
  '  3. Kimlik bilgileri bölümünden bir API anahtarı oluştur (kısıtı YouTube Data API v3 yap).',
  '  4. Proje klasöründeki .env dosyasına şu satırı yaz: YT_API_KEY=<anahtarın>',
  '  5. "node src/cli.mjs durum" ile anahtarın görüldüğünü doğrula.'
].join('\n');
