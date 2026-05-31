# Chat: darslik javobi + ixtiyoriy internet qidiruv

**Sana:** 2026-05-31
**Holat:** Dizayn tasdiqlandi, implementatsiya kutilmoqda

## Maqsad

Bola savol berganda AI avval **darslik (RAG)** kontentidan manba keltirib javob beradi,
so'ng ixtiyoriy ravishda internetdan qo'shimcha ma'lumot taklif qiladi (Ha/Yo'q tugmalari).
Agar darslikdan topa olmasa — to'g'ridan-to'g'ri internetdan (Gemini Google Search
grounding) javob beradi.

Misol: "Sitoplazma nima" →
> Sitoplazma: 6-sinf Botanika darsligiga ko'ra, hujayraning ichki suyuq qismi...
>
> Xohlasang internetdan ham qo'shimcha ma'lumot qidiraman.   [Ha] [Yo'q]

## Xatti-harakat oqimi

Bola xabar yuboradi → mavjud crisis/xavfsizlik pipeline ishlaydi (O'ZGARMAYDI) →
RAG retrieval (`retrieve_for_chat`: normalize + similarity floor, hozirgidek):

1. **RAG topadi (context bor):**
   - Gemini darslikка asoslanib javob beradi; javob boshida manba: "X-sinf [Fan]
     darsligiga ko'ra, …".
   - Javob bilan: `source.type = "textbook"`, `quick_replies = [Ha, Yo'q]`, va matn
     oxirida "Xohlasang internetdan ham qidiraman" taklifi.
   - Taklif **har RAG javobida** chiqadi.
2. **RAG topmaydi (context yo'q):**
   - To'g'ridan-to'g'ri Gemini Google Search grounding bilan internetdan javob.
   - `source.type = "web"` + manba URL'lari. `quick_replies` yo'q (allaqachon web).
3. **Bola "Ha" bossa:**
   - Mobil `action="web_search"`, `action_query=<asl savol>` bilan so'rov yuboradi.
   - Backend RAG'ni o'tkazib, `action_query` uchun grounded web qidiruv qiladi →
     `source.type = "web"` + URL'lar.
4. **Bola "Yo'q" bossa:**
   - Mobil chiplarni lokal o'chiradi. Backend chaqiruv YO'Q. Qo'shimcha xabar yo'q.

Xavfsizlik: web-grounded javoblar ham xuddi shu yoshга mos system prompt + crisis
tekshiruvi orqali o'tadi (bolalar uchun xavfsiz). Web qidiruv faqat bilim-savollari
oqimida; crisis xabarlarda emas (crisis pipeline avval ishlaydi).

## API kontrakti

### `ChatRequest` (qo'shiladi)
```
action: Literal["web_search"] | None = None   # null → oddiy xabar
action_query: str | None = None               # action="web_search" uchun savol matni
```
`action="web_search"` bo'lsa: RAG o'tkazib yuboriladi, `action_query` Gemini grounded
web qidiruvga uzatiladi. `message` bu holda tugma yorlig'i ("Ha") bo'ladi (mavjud
`min_length=1` validatsiyasini qondiradi); backend `action` bo'lsa `message`ni e'tiborsiz
qoldiradi va `action_query`dan foydalanadi.

### `ChatResponse` (qo'shiladi)
```
source: ChatSource | None
quick_replies: list[QuickReply]   # bo'sh = tugma yo'q

class ChatSource:
    type: Literal["textbook", "web", "none"]
    label: str            # "6-sinf Botanika darsligi" yoki "Internet"
    refs: list[SourceRef] # textbook: fan/sinf/mavzu; web: {title, url}

class QuickReply:
    label: str            # "Ha" / "Yo'q"
    action: Literal["web_search", "dismiss"]
    query: str | None     # web_search uchun asl savol
```

## Backend o'zgarishlari

- **`services/gemini.py`**: yangi `chat_with_web_search(...)` yoki `chat(..., use_web=True)`
  — `tools=[types.Tool(google_search=types.GoogleSearch())]` qo'shadi, grounding
  metadata'dan manba URL'larini (`grounding_metadata.grounding_chunks`) `GeminiReply`ga
  qaytaradi.
- **`textbook/retriever.py`**: `build_rag_context` ko'rsatmasi yangilanadi — javob boshida
  "X-sinf [Fan] darsligiga ko'ra…" deb manba keltirishni so'raydi. Mavjud Fan/Sinf
  metadata ishlatiladi. Retrieval natijasidan `ChatSource(type="textbook", refs=...)`
  quriladi.
- **`api/v1/chat.py`**:
  - `action="web_search"` bo'lsa → RAG o'tkazib, `chat_with_web_search(action_query)` →
    `source=web`.
  - Aks holda hozirgidek: `retrieve_for_chat` → bor bo'lsa textbook javob + `quick_replies`;
    yo'q bo'lsa `chat_with_web_search(message)` (RAG-miss fallback) → `source=web`.
  - Crisis pipeline o'zgarmaydi (avval ishlaydi).

## Mobil o'zgarishlari

- **`api/endpoints/chat.ts` + `api/types.ts`**: `ChatResponse`ga `source`, `quick_replies`;
  `ChatRequest`ga `action`, `action_query` qo'shiladi.
- **`store/chat.ts`**: assistant xabariga `source` + `quickReplies` saqlanadi.
- **`app/(main)/(tabs)/chat.tsx`**:
  - Assistant xabari ostida `source` badge: 📚 "6-sinf Botanika darsligi" yoki
    🌐 manbalar (bosiladigan havolalar).
  - `quick_replies` bo'lsa — bosiladigan chiplar. "Ha" → `sendMessage` `action=web_search`,
    `action_query` bilan; chiplar yo'qoladi (har xabarda bir marta). "Yo'q" → chiplar
    lokal o'chadi.

## Test

- Backend unit: `chat_with_web_search` grounding URL'larini to'g'ri ajratadi (mock SDK).
  `retrieve_for_chat` natijasidan `ChatSource` quriladi. `action=web_search` oqimi RAG'ni
  o'tkazib yuboradi.
- Backend integration: chat endpoint 3 holat — RAG-hit (textbook + quick_replies),
  RAG-miss (web), action=web_search (web).
- Mobil: quick-reply chiplar render + tap; source badge.

## Doirasidan tashqari (YAGNI)

- Web natijalarini keshlash.
- Manbalarni saqlash/analytics.
- Voice (ovoz) oqimida web qidiruv — bu spec faqat matn chat uchun.
- "Yo'q" da qo'shimcha javob/xabar.
