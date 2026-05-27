# DUYO Docs

Loyiha hujjatlari, ADR'lar (Architecture Decision Records), API spec'lar.

## Asosiy hujjatlar

| Hujjat | Joylashuvi | Tavsifi |
|--------|------------|---------|
| Concept v2.1 | [../DUYO_Concept_v2.1.docx](../DUYO_Concept_v2.1.docx) | Mahsulot konseptsiyasi |
| TZ v1.0 | [../DUYO_TZ_v1.0.docx](../DUYO_TZ_v1.0.docx) | Texnik topshiriq |

## Bu papkada bo'ladigan hujjatlar (kelajak)

### Faza 0 (Safety Foundation)

- `decisions.md` — strategik qarorlar log'i
- `pedagogical-council.md` — pedagogik kengash a'zolari va workflow
- `legal-framework.md` — COPPA, GDPR-K, O'zbekiston bola huquqlari
- `crisis-protocol.md` — pediatr psixologlar bilan kelishilgan to'liq protokol
- `partnerships.md` — 1142, 1146, Sog'liqni saqlash Vazirligi

### Texnik

- `architecture/system-overview.md`
- `architecture/data-flow.md`
- `architecture/security-model.md`
- `api/openapi.yaml` — OpenAPI 3.0 spec
- `database/schema.sql` — to'liq PostgreSQL DDL
- `database/migrations.md`

### ADR'lar (har architectural decision uchun bittadan)

- `adr/0001-monorepo-vs-multirepo.md`
- `adr/0002-react-native-vs-flutter.md`
- `adr/0003-claude-vs-openai-vs-self-hosted.md`
- `adr/0004-crisis-detection-architecture.md`
- `adr/0005-parent-monitoring-channel.md`

### Operations

- `runbooks/incident-response.md`
- `runbooks/crisis-event-workflow.md` — RED level qayd etilganda kim nima qiladi
- `runbooks/data-breach.md`
- `monitoring/sli-slo.md`

## ADR template

Har architectural decision quyidagi format'da yoziladi:

```markdown
# ADR-NNNN: <Decision title>

Date: YYYY-MM-DD
Status: Proposed | Accepted | Deprecated | Superseded by ADR-XXXX

## Context
<What problem are we solving? What constraints exist?>

## Decision
<What did we decide?>

## Alternatives considered
- Option A: pros / cons
- Option B: pros / cons

## Consequences
- Positive: ...
- Negative: ...
- Mitigations: ...
```

## Hujjat yozish qoidasi

1. **O'zbek tili** — asosiy hujjat tili (TZ ham o'zbekcha)
2. **Inglizcha texnik terminlar** — translatsiya qilish shart emas (API, endpoint, schema)
3. **Markdown** — har bir hujjat .md, asciidoc emas
4. **Versiya kontroli** — har major o'zgarish uchun "Change log" bo'limi
5. **Reference TZ** — har technical decision TZ paragrafiga link beradi
