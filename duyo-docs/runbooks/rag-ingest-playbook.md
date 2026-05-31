# RAG Ingest Playbook

> Yangi sinf yoki kitobni RAG bazasiga joylash uchun qayta ishlatiladigan protsedura.
> Har safar shu ketma-ketlikni bajaring. Obsidian: `Setup/13 — RAG Ingest Yo'riqnoma`.

## Kontekst

- **Ingest har doim Mac'da** (M4 Pro, 24GB MPS). Server (4GB RAM) OCR ko'tarmaydi — faqat tayyor vektorni qabul qiladi.
- Kitoblar: `/Users/raxmonjon/DARSLIKLAR/{N}-SINF/*.pdf`
- Lokal DB: `docker compose` postgres (pgvector), port 5432.
- Server: `46.8.194.122`, postgres konteyneri **`duyo-postgres`** (`-1` qo'shma!).

---

## 0. Tayyorgarlik (har sessiya)

```bash
cd /Users/raxmonjon/DUYO/duyo-backend
export PATH="/opt/homebrew/bin:$PATH"
colima status || colima start --cpu 2 --memory 4
docker compose up -d postgres
```

## 1. Text-layer sifatini baholash → OCR strategiyani tanlash

Barcha sahifalarni skanla (qisman buzilishni o'tkazib yubormaslik uchun):

```python
# /tmp/assess.py
import fitz, glob, os
base = "/Users/raxmonjon/DARSLIKLAR/7-SINF/"
for p in sorted(glob.glob(base + "*.pdf")):
    doc = fitz.open(p); n = len(doc)
    sample = "".join(doc[i].get_text() for i in range(min(20,n), min(40,n)))
    bad = sample.count("ð") + sample.count("ñ")
    total = len(sample) or 1
    readable = sum(1 for c in sample if c.isalnum() or c.isspace() or c in ".,;:!?-'ʻ")
    ratio = readable/total
    v = ("SCANNED->tesseract" if total < 200 else
         "CORRUPT->tesseract" if bad>5 or ratio<0.85 else "CLEAN->docling")
    print(f"{os.path.basename(p):35} pages={n:3} bad={bad:3} ratio={ratio:.2f}  {v}")
    doc.close()
```

```bash
.venv/bin/python /tmp/assess.py
```

| Natija | Strategiya |
|--------|-----------|
| CLEAN (digital, bad=0, ratio>0.85) | `docling` |
| CORRUPT (glyph almashinuvi) | `tesseract` |
| SCANNED (text layer ~0) | `tesseract` |
| Matematika/fizika/kimyo (formula) | `mineru` |

## 2. Dry-run (ixtiyoriy, 1 kitob)

```bash
.venv/bin/python scripts/ingest_textbook.py /tmp/test.pdf \
    --subject ona-tili --grade 7 --ocr-strategy docling --dry-run
```

## 3. Batch ingest — KETMA-KET (parallel EMAS!)

```bash
# /tmp/batch.sh
#!/bin/zsh
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/raxmonjon/DUYO/duyo-backend
PY=".venv/bin/python"; BASE="/Users/raxmonjon/DARSLIKLAR/7-SINF"
JOBS=(
  "tarix:jahon_tarixi_7_uzb.pdf:docling"
  "ona-tili:ona_tili_7_uzb.pdf:tesseract"
)
for job in $JOBS; do
  subj="${job%%:*}"; rest="${job#*:}"; file="${rest%%:*}"; strat="${rest##*:}"
  echo "[$(date +%H:%M:%S)] START $subj <$strat>"
  $PY scripts/ingest_textbook.py "$BASE/$file" \
      --subject "$subj" --grade 7 --ocr-strategy "$strat" --embed --skip-existing
  echo "[$(date +%H:%M:%S)] DONE $subj exit=$?"
done
echo "########## ALL DONE ##########"
```

```bash
chmod +x /tmp/batch.sh && nohup zsh /tmp/batch.sh > /tmp/batch.log 2>&1 &
```

**MUHIM:** OCR engine'lar MPS GPU'ni baham ko'radi → bir vaqtda BITTA process (parallel = zombi OOM). `--skip-existing` resume uchun. Docling ~5-10daq/kitob, Tesseract ~25-35daq. Log boshida "qotgandek" ko'rinadi — kut.

## 4. Sifat tekshiruvi

```sql
SELECT subject, count(*), count(embedding), count(*) FILTER (WHERE has_formula)
FROM textbook_chunks WHERE grade=7 GROUP BY subject ORDER BY subject;

SELECT subject, count(*) FROM textbook_chunks
WHERE text LIKE '%ð%' OR text LIKE '%ñh%' GROUP BY subject;  -- 0 bo'lishi shart
```

- `count = count(embedding)` (100% embedded)
- ð/ñ = 0 (aks holda tesseract bilan qayta)
- matn fanlarda has_formula past

## 5. Chunk-quality tozalash

```bash
.venv/bin/python /tmp/clean_db.py            # dry-run preview
.venv/bin/python /tmp/clean_db.py --apply    # o'chir (MAX_DELETE=50 himoya)
```

`is_low_quality()` (kod bilan bir xil): TOC/jadval/boilerplate/atama-ro'yxat axlat o'chadi, real proza saqlanadi.

## 6. RAG sifat testi

Har fan 1-2 haqiqiy savol: `search_chunks(s, "Savol?", subject="tarix", grade=7, limit=2)` → cosine 0.6+, on-topic.

> 0 natija qaytsa: `store.search()` da `SET LOCAL ivfflat.probes=10` borligini tekshir.

## 7. Serverga transfer

```bash
docker compose exec -T postgres pg_dump -U duyo -d duyo \
    --table=textbook_chunks --no-owner --no-privileges > /tmp/tc.sql
scp /tmp/tc.sql duyo@46.8.194.122:/tmp/
ssh duyo@46.8.194.122
  docker exec duyo-postgres psql -U duyo -d duyo -c "CREATE EXTENSION IF NOT EXISTS vector;"
  docker exec -i duyo-postgres psql -U duyo -d duyo -v ON_ERROR_STOP=1 < /tmp/tc.sql
  docker exec duyo-postgres psql -U duyo -d duyo \
      -c "REINDEX INDEX ix_chunks_embedding_ivfflat; ANALYZE textbook_chunks;"
rm /tmp/tc.sql  # lokal + server
```

- **Birinchi marta** (jadval yo'q): to'liq schema+data dump (`--table`, `--data-only` EMAS).
- Keyingi safar: `--data-only` + serverda mavjud row'larni ehtiyot qil.
- Server `alembic upgrade` container ichida ishlamaydi (DSN hostname resolve emas) → dump usuli.

## 8. Yakuniy

- Kod o'zgargan bo'lsa: `git commit`
- Holat yangilash: xotira `project_duyo_rag_ocr.md` + Obsidian `Setup/12`

---

## Cheat-sheet

```
0. PATH + docker + postgres
1. assess.py → strategiya
2. (dry-run) sifat tekshir
3. batch.sh ketma-ket (--embed --skip-existing)
4. SQL: count=embedded, ð/ñ=0
5. clean_db.py --apply
6. RAG test (cosine 0.6+)
7. pg_dump → scp → restore → REINDEX
8. commit + holat yangila
```

## Eng muhim qoidalar

1. Ingest har doim Mac'da (server 4GB)
2. OCR bir vaqtda bitta process (MPS contention)
3. Barcha sahifani skanla
4. probes=10 bo'lmasa filtered search 0
5. Server konteyner `duyo-postgres`
6. Dry-run → apply (ko'r-ko'rona o'chirma)
