"""Curated child/teen psychology knowledge base — the RAG source corpus.

CRITICAL: same status as `crisis/keywords.py` — this is a hand-authored DRAFT,
not clinically validated. It must be reviewed by pediatric psychologists
before production use. Every card is deliberately non-diagnostic (no DSM-style
labels, no "you have X") — it gives supportive framing and a next step, in
line with `prompts.PARENT_GUIDANCE_PROMPT`'s "no clinical diagnosis" rule.

Each entry becomes one `PsychologyChunk` row (see `psychology/store.py`) and
is retrieved by embedding similarity, not by keyword lookup — `aliases` here
exist only for humans skimming this file, not for matching logic.
"""

from __future__ import annotations

from dataclasses import dataclass

from duyo.models.child import AgeSegment


@dataclass(frozen=True)
class PsychologyTopic:
    topic_id: str
    title: str
    aliases: tuple[str, ...]
    # None = applies to every age segment.
    age_segments: tuple[AgeSegment, ...] | None
    content: str


TAXONOMY: dict[str, PsychologyTopic] = {
    t.topic_id: t
    for t in (
        PsychologyTopic(
            topic_id="anxiety_worry",
            title="Bezovtalik va tashvish",
            aliases=("anxiety", "worry", "tashvish", "bezovtalik", "qo'rquv"),
            age_segments=None,
            content=(
                "Bolalar va o'smirlarda bezovtalik ko'pincha noma'lumlikdan yoki "
                "nazoratni yo'qotish hissidan kelib chiqadi — imtihon, yangi vaziyat, "
                "kelajak haqida o'ylash shular jumlasidan. Bu me'yoriy hissiyot: "
                "tanaga xavf haqida signal beradi, lekin uzoq davom etsa charchatadi. "
                "Yordam beradigan narsa — hissiyotni nomlash ('bezovtaman' deyish), "
                "sekin nafas olish, va tashvishni bitta aniq qadamga bo'lib "
                "qo'yish ('hozir faqat shu birinchi qadamni qilaman'). Agar "
                "bezovtalik kundalik hayotga (uyqu, ovqat, do'stlar bilan aloqa) "
                "haftalar davomida xalaqit bersa, mutaxassis bilan gaplashish foydali."
            ),
        ),
        PsychologyTopic(
            topic_id="low_self_esteem",
            title="O'z-o'ziga past baho",
            aliases=("self-esteem", "self worth", "o'zini past baholash", "o'ziga ishonchsizlik"),
            age_segments=None,
            content=(
                "O'z qadr-qimmatini past baholash ko'pincha taqqoslashdan ('boshqalar "
                "mendan yaxshiroq') yoki muvaffaqiyatsizlikdan keyin paydo bo'ladi. "
                "Bola o'zini faqat natijalar bilan emas, harakat va shaxsiy "
                "xususiyatlari bilan ham qadrlashni o'rganishi muhim. Foydali "
                "yondashuv — kichik, real yutuqlarni qayd etish, xatoni 'men "
                "yomonman' emas, 'bu safar shunday chiqdi, keyingisida boshqacha "
                "qilib ko'raman' deb qayta shakllantirish. Doimiy 'men hech "
                "narsaga arzimayman' kabi gaplar bo'lsa, bu chuqurroq tashvish "
                "signali bo'lishi mumkin va e'tiborni talab qiladi."
            ),
        ),
        PsychologyTopic(
            topic_id="grief_loss",
            title="Yaqinini yo'qotish va motam",
            aliases=("grief", "loss", "motam", "yaqinini yo'qotish", "o'lim"),
            age_segments=None,
            content=(
                "Yaqin kishini yoki hatto uy hayvonini yo'qotish bolada turli "
                "shaklda namoyon bo'ladi — ba'zida yig'i, ba'zida jahl, ba'zida "
                "hissiyotsizdek ko'rinish. Bularning barchasi me'yoriy motam "
                "reaksiyalari. Bolaga vaqt va makon berish, uni his-tuyg'ularini "
                "so'z bilan ifodalashga undash ('bugun qanday his qilyapsan?'), "
                "va motam 'to'g'ri' yoki 'noto'g'ri' tarzda o'tmasligini tushuntirish "
                "muhim. Kundalik rutinani saqlash (maktab, ovqat, uyqu vaqti) "
                "bolaga barqarorlik hissini beradi."
            ),
        ),
        PsychologyTopic(
            topic_id="bullying_effects",
            title="Bulling (ta'qib)ning hissiy ta'siri",
            aliases=("bullying", "bulling", "ta'qib", "masxara"),
            age_segments=None,
            content=(
                "Bulling qurboni bo'lgan bola ko'pincha o'zini aybdor his qiladi "
                "yoki voqeani yashiradi, chunki uyalish yoki qasos olishdan "
                "qo'rqish hissi kuchli bo'ladi. Bolani tinglash — baholamasdan, "
                "'nega sen bunga sabab bo'lding' kabi savollarsiz — birinchi "
                "qadam. Unga bu uning aybi emasligini aniq aytish kerak. "
                "Voqeani maktab yoki mas'ul kattalar bilan birga hal qilish, "
                "bolani yolg'iz qoldirmaslik muhim. Agar bola maktabga borishdan "
                "qat'iy bosh tortsa yoki uyqu/ishtaha keskin o'zgarsa, bu jiddiy "
                "signal — kattalar aralashuvi zarur."
            ),
        ),
        PsychologyTopic(
            topic_id="sibling_rivalry",
            title="Aka-uka, opa-singil o'rtasidagi raqobat",
            aliases=("sibling rivalry", "aka-uka janjali", "opa-singil"),
            age_segments=None,
            content=(
                "Aka-uka/opa-singillar o'rtasidagi janjal odatda e'tibor va "
                "adolat haqidagi his-tuyg'ulardan kelib chiqadi — 'unga ko'proq "
                "e'tibor berishadi' degan tuyg'u. Har bir bolaga alohida, "
                "shaxsiy vaqt ajratish, ularni solishtirmaslik ('akangdek bo'l' "
                "demaslik) yordam beradi. Janjal paytida kim aybdor ekanini "
                "qidirish o'rniga, ikkalasiga ham his-tuyg'ularini so'zda "
                "ifodalashni o'rgatish foydaliroq."
            ),
        ),
        PsychologyTopic(
            topic_id="exam_stress",
            title="Imtihon va DTM stressi",
            aliases=("exam stress", "dtm", "imtihon tashvishi", "test stress"),
            age_segments=(AgeSegment.EXPLORER, AgeSegment.COMPANION),
            content=(
                "Imtihon oldidan tashvish tabiiy, lekin haddan tashqari bo'lsa "
                "diqqatni buzadi. Yordam beradigan strategiyalar: kattaroq "
                "mavzuni kichik bo'laklarga bo'lib rejalashtirish, muntazam "
                "tanaffuslar bilan o'qish (uzoq, uzluksiz emas), imtihon kuni "
                "uchun aniq rejaga ega bo'lish (nima olib boraman, qachon "
                "boraman). O'zini boshqa bolalar bilan doimiy taqqoslash "
                "stressni kuchaytiradi — o'z sur'atiga e'tibor qaratish "
                "foydaliroq. Natija bir imtihon bilan cheklanmasligini eslatib "
                "turish foydali."
            ),
        ),
        PsychologyTopic(
            topic_id="screen_social_comparison",
            title="Ijtimoiy tarmoqlarda o'zini boshqalar bilan taqqoslash",
            aliases=("social media", "comparison", "ijtimoiy tarmoq", "taqqoslash"),
            age_segments=(AgeSegment.EXPLORER, AgeSegment.COMPANION),
            content=(
                "Ijtimoiy tarmoqlarda ko'rilgan 'mukammal' hayotlar bilan o'zini "
                "taqqoslash o'smirlarda o'ziga ishonchsizlik va yetarli emaslik "
                "hissini kuchaytirishi mumkin. Bu suratlar odatda "
                "hayotning faqat eng yaxshi lahzalari, to'liq manzarasi emasligini "
                "eslatish foydali. Ekran vaqtini nazorat qilishdan ko'ra, "
                "'nima ko'rish o'zimni qanday his qilishimga ta'sir qiladi' "
                "haqida o'ylashga undash samaraliroq."
            ),
        ),
        PsychologyTopic(
            topic_id="anger_regulation",
            title="Jahl va g'azabni boshqarish",
            aliases=("anger", "jahl", "g'azab", "asabiylashish"),
            age_segments=None,
            content=(
                "Jahl — me'yoriy hissiyot, muammo uning o'zi emas, balki uni "
                "qanday ifodalashda. Bolaga jahl chiqqanda tanadagi belgilarni "
                "tanishni ('yurak tez uradi', 'yuz qizaradi') va shu belgi "
                "sezilganda bir necha soniya to'xtab, chuqur nafas olishni "
                "o'rgatish foydali. Jahlni bostirish emas, uni xavfsiz yo'l "
                "bilan chiqarish (yozish, jismoniy harakat, gapirish) maqsad. "
                "Tez-tez, nazoratsiz jahl portlashlari bo'lsa, sabab (charchoq, "
                "stress, adolatsizlik hissi) birga qidirilishi kerak."
            ),
        ),
        PsychologyTopic(
            topic_id="sleep_mood",
            title="Uyqu va kayfiyat bog'liqligi",
            aliases=("sleep", "uyqu", "charchoq", "mood"),
            age_segments=None,
            content=(
                "Uyqu yetishmasligi bolalar va o'smirlarda kayfiyat "
                "beqarorligi, diqqatning pasayishi va jahldorlikni kuchaytiradi. "
                "Yotishdan oldin ekrandan uzoqlashish, barqaror uyqu vaqti, "
                "va tinch kechki rutina uyqu sifatini yaxshilaydi. Agar bola "
                "kechalari uyg'onib chiqsa yoki uxlashdan qo'rqsa, sabab "
                "(tashvish, qo'rqinchli tush) haqida muloyim so'rash foydali."
            ),
        ),
        PsychologyTopic(
            topic_id="friendship_conflict",
            title="Do'stlik nizolari",
            aliases=("friendship conflict", "do'stlik janjali", "do'st bilan janjal"),
            age_segments=None,
            content=(
                "Do'stlar orasidagi janjal — ijtimoiy ko'nikmalarni "
                "o'rganishning tabiiy qismi. Bolaga vaziyatni ikki tomondan "
                "ko'rishga yordam berish ('u nima o'ylagan bo'lishi mumkin?'), "
                "va agar kerak bo'lsa gaplashib yarashishni taklif qilish "
                "foydali. Har bir kelishmovchilik do'stlikning tugashi "
                "degani emasligini eslatish kerak."
            ),
        ),
        PsychologyTopic(
            topic_id="family_conflict",
            title="Oilaviy nizolarni kuzatish",
            aliases=("family conflict", "oilaviy janjal", "ota-ona janjali"),
            age_segments=None,
            content=(
                "Ota-onalar orasidagi janjalni kuzatgan bola ko'pincha o'zini "
                "aybdor his qiladi yoki his-tuyg'ularini ichida saqlaydi. Bolaga "
                "kattalar orasidagi nizo uning aybi emasligini aniq aytish "
                "muhim. Bola his-tuyg'ularini xavfsiz tarzda ifodalashi uchun "
                "makon yaratish (chizish, yozish, gaplashish) foydali. Agar "
                "bola o'zini doimiy tashvishda yoki qo'rquvda his qilsa, "
                "bu kattalar e'tiborini talab qiladigan signal."
            ),
        ),
        PsychologyTopic(
            topic_id="procrastination_motivation",
            title="Ish qoldirish va motivatsiya yo'qligi",
            aliases=("procrastination", "motivation", "ish qoldirish", "dangasalik"),
            age_segments=(AgeSegment.EXPLORER, AgeSegment.COMPANION),
            content=(
                "Vazifani orqaga surish ko'pincha dangasalik emas, balki "
                "vazifa juda katta yoki qo'rqinchli tuyulgani uchun sodir "
                "bo'ladi. Uni kichik, aniq birinchi qadamga bo'lish ('faqat "
                "5 daqiqa boshlayman') harakatga tushishni osonlashtiradi. "
                "O'zini ayblash o'rniga, nima uni to'xtatib turganini "
                "so'rash ('bu qiyinmi, zerikarlimi, yoki qo'rqinchlimi?') "
                "foydaliroq yondashuv."
            ),
        ),
        PsychologyTopic(
            topic_id="loneliness",
            title="Yolg'izlik hissi",
            aliases=("loneliness", "yolg'izlik", "hech kimim yo'q"),
            age_segments=None,
            content=(
                "Yolg'izlik hissi ko'p do'sti bo'lgan bolada ham paydo bo'lishi "
                "mumkin — bu ijtimoiy izolyatsiyadan ko'ra ko'proq 'meni "
                "tushunishmaydi' degan hissiyot bilan bog'liq. Bolani "
                "qiziqishlariga mos kichik guruh yoki faoliyatga jalb qilish, "
                "va u bilan muntazam, bosim qilmasdan suhbatlashish yordam "
                "beradi. Agar yolg'izlik hissi 'hech kimga keragim yo'q' "
                "darajasiga o'tsa, bu jiddiyroq e'tiborni talab qiladi."
            ),
        ),
        PsychologyTopic(
            topic_id="body_image_teen",
            title="Tashqi ko'rinish haqida tashvish (o'smirlik)",
            aliases=("body image", "tashqi ko'rinish", "vazn haqida tashvish"),
            age_segments=(AgeSegment.COMPANION,),
            content=(
                "O'smirlik davrida tana o'zgarishi va tashqi ko'rinish haqida "
                "tashvish keng tarqalgan — ijtimoiy tarmoqlardagi standartlar "
                "buni kuchaytiradi. Tanani faqat ko'rinishi bilan emas, u "
                "qila oladigan narsalar bilan qadrlashga undash foydali. "
                "Agar ovqatlanish odati keskin o'zgarsa yoki tana haqida "
                "gap doimiy tashvishga aylansa, bu mutaxassis e'tiborini "
                "talab qiladigan signal."
            ),
        ),
    )
}
