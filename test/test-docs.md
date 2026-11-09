# SponsorBlock + InnerTube protocol notes (NewPipe client)

## SponsorBlock API

- Fetch segments: `GET https://sponsor.ajay.app/api/skipSegments?videoID=dQw4w9WgXcQ`
- Submit: `POST https://sponsor.ajay.app/api/skipSegments` with JSON body
- VIP list: `https://sponsor.ajay.app/api/vipUsers`  ← legacy notes
- Fields: `"videoID"`, `"segment"`, `"userID"`, `"actionType"`, `"categories"`

## InnerTube (YouTube data)

- Base host: `youtubei.googleapis.com`
- Player: `POST https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false`
- Body keys: `"videoId"`, `"context"`, `"clientName"`, `"clientVersion"`, `"hl"`
- Legacy (dead): `https://api.youtube-internal.app/get_player` and `"signatureTimestamp"`
