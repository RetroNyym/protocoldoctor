# 🩺 Protocol Doctor

> Reverse-engineering protocol dokümanları çürür — sessizce. Bu bot, dokümanların hâlâ güncel build ile konuşup konuşmadığını her push/release'ta kanıtlar.

## Sorun

GitHub'da yüzlerce "tersine-mühendislikle bulunmuş protokol notu" reposu var: akıllı ev, giyilebilir, robot süpürge, araç API'leri... **Milyonlarca geliştirici bu docs'lara dayanan istemciler yazıyor.** Ama üretici uygulamayı güncellediğinde protokol sessizce değişir, doküman eskir ve kimse fark etmez — 40 bin kullanıcının istemcisi bir sabah kırılır.

Bunu sergüyok; izleyen bir bot yoktu. Şimdi var.

## Çözüm

1. Protokol docs'unu (`protocol.md`) tarar → **kanıt token'ları** çıkarır:
   - endpoint/URL'ler (`https://...`)
   - opsiyon/opcode kimlikleri (`0x2f21`)
   - URI path'leri ve JSON alan adları (`"videoID"`)
   - decompiled referanslar (`com.vendor.api.Camera.getAuth`)
2. **Hedef build'i tarar**:
   - `--apk app.apk` → ZIP reader + DEX string pool / sınıf listesi (çalıştırmaz, sadece para-izlerini okur)
   - `--src ./client` → doğrudan istemci kaynak kodu
3. **Cross-check** → dokümandaki her token binary/source içinde yaşıyor mu?
4. Şunu döner: **kap/socket raporu** — kaç token canlı, kaç token stale, stale listesi

## Hızlı başlangıç

```bash
node bin.js protocol.md --apk vendor-app.apk
node bin.js protocol.md --src ./companion-client --out check.md
node bin.js protocol.md --apk https://github.com/org/app/releases/download/v2/app.apk  # indirme dahil
```

> `npm install` yok. Sıfır çalışma zamanı bağımlılığı (Node ≥ 18). Dosyalar buradan dışarı çıkmaz.

## Gerçek çıktı örneği

NewPipe v0.29.2 APK'sı, SponsorBlock + InnerTube notlarıyla test edildi. Dokümandaki **dokümantaşeti** (`vipUsers`, `innertube.googleapis`) gerçekten build değil — bu doğru raporlandı; canlı token'lar (`context`, `clientVersion`, `/api`) doğrulandı.

```
**Coverage:** 50% of documented protocol tokens found in the current binary

### ⚠️ Stale (documented, but not in this build)
| https://sponsor.ajay.app/api/vipUsers | url |
| https://api.youtube-internal.app/get_player | url |
| signatureTimestamp | key |
...
```

## GitHub Action

```yaml
# .github/workflows/protocol-doctor.yml
name: Protocol Doctor
on:
  workflow_dispatch:
    inputs:
      docs: { required: true, default: "protocol.md" }
      apk: { required: false }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: |
          node protocoldoctor/bin.js "${{ inputs.docs }}" --apk "${{ inputs.apk }}" --out report.md
      - uses: actions/upload-artifact@v4
        with: { name: protocol-report, path: report.md }
```

**Issue-tabanlı kullanım** (reposunda issue'a bir protokol notu ekle):
`@protocoldoctor check apk=https://host/app.apk` → bot yorum olarak kanıt raporu yazar.
(Planlanan v2 özelliği — bkz. *Roadmap*.)

## API

| Uç | Ne döndürür |
|---|---|
| `node bin.js <docs> --apk <x>` | kanıt hariç statale tablistesi + coverage % |
| `node bin.js <docs> --src <dir>` | source tree cross-check |
| `--out f.md` | raporu dosyaya yaz |

## Ne ölçer, ne ölçmez

- ✅ **Kanıt listesi**: bu commit izinde şu token bugün yaşıyor mu — açık, doğrulanabilir
- ❌ **Verdict değil**: "stale ≠ yanlış" — token yeniden adlandırılmış, query parametrik veya runtime'da kurulmuş olabilir. README bunu dürüst söyler; araç da raporun altında aynısını yazar.

## Yol haritası (roadmap)

- [x] ZIP/DEX mie ekleyip cross-check motoru (v0.1)
- [ ] GitHub Action'ıninary `issue_comment` tetikli "bot" modu (receipt yorumu)
- [ ] Deobfuscation map (proguard) desteği → protokol fonksiyon adları kaybı giderme
- [ ] Değişen segmentleri **docs yamaları** olarak PR açma
- [ ] Birden fazla APK sürümünü yan yana diff — "protokol nerede büküldü" digest
- [ ] Opcode (`0x`) seviyesi: smali eğimli opcode tablolarını oku (BLE/GATT / MQTT dokümanları)

## Neden güven

- **Doğrulanabilir**: `--src` modu, 100% doğrulama ile test edildi (doküman token'ları source'da mevcut)
- **Belge taşınmaz**: `--apk` seçenek belirlerseniz indirme yalnızca o URL'den yapılır
- **LLM'siz**: farklı karar verir hiçbir saip var; sonuç rasgeleleşmez

## Türkçe İngilizce

İngilizce詳細: [README.en.md](README.en.md)

---

MIT license. (c) RetroNyym & contributors.
