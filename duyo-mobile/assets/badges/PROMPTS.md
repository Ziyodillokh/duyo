# Badge rasmlari — generatsiya promptlari

Oltita badge uchun ChatGPT / GPT-image promptlari. Har birining `fullPrompt`
bo'limini boshidan oxirigacha, bir harfini ham o'zgartirmasdan nusxa ko'chiring.

**Uslub: Flat Disc** — gradient doira ustida sof oq belgi. Uch nomzoddan
(Flat Disc / Toy Vinyl / Hard Enamel Pin) tanlangan, chunki badge'ning asosiy
ishi Maqsaddoshlarda 15–17pt da nom yonida turish, va 3D soya ham, metall
gardish ham aynan siluetni belgilaydigan maydonni yeydi.

> **Rasm to‘liq nishon bo‘lib chiziladi, lekin ilovaga faqat shaffof fonda oq
> belgi tushadi.** Diskni, rang gradientini, qulflangan holatni va 2-pog‘ona
> halqasini kod chizadi — `src/components/badges/badge.tsx`.

---

## Ishlash tartibi

ISHLASH TARTIBI (ChatGPT / GPT-image bilan)

1) BITTA SUHBAT, OLTITA PROMPT, SHU TARTIBDA. Hammasini bitta yangi suhbatda ketma-ket chizdiring: spark (yulduz) → flame (alanga) → brain (lampochka) → ascent (zinapoya) → rocket (raketa) → heart (yurak). Bitta suhbatda bo'lishi shart: model oldingi rasmlarni «oila» sifatida ushlab turadi va disk, chekka, o'lcham bir xil chiqadi. Suhbat uzilib qolsa yoki uslub o'zgarib ketsa — yangi suhbat oching va oltitasini boshidan qayta chizdiring, yarmini eski, yarmini yangi qilib aralashtirmang.

2) PROMPTNI O'ZGARTIRMASDAN QO'YING. Har bir badge uchun "fullPrompt" maydonidagi matnni boshidan oxirigacha, bir harfini ham o'zgartirmasdan nusxa ko'chiring. Uning oxiridagi uy uslubi bloki oltitasida bir xil — SUBJECT satridan boshqasini hech qachon tahrirlamang. Prompt ustiga hech narsa qo'shmang («chiroyliroq qil», «biroz porlasin» kabi iltimoslar butun to'plamni buzadi).

3) TEXNIK SO'ROV. Har safar shu qo'shimchani ayting: "Square 1:1, 1024x1024 PNG, transparent background outside the circle, no text anywhere." Agar burchaklar oq bo'lib chiqsa, shunday deb qayta so'rang: "The four corners outside the circle must be fully transparent alpha — not white, not grey, not a checkerboard." Oq burchak bilan kelgan rasmni ham qabul qilsa bo'ladi, chunki keyingi qadamda baribir faqat oq belgi ajratib olinadi — lekin diskning o'zi to'liq va markazda bo'lishi shart.

4) NIMA UCHUN DISK BILAN CHIZAMIZ, LEKIN DISKSIZ TOPSHIRAMIZ. Bo'sh fonda yolg'iz oq shaklni ko'z bilan baholab bo'lmaydi, model esa uni ko'rsatish uchun o'zidan kontur qo'shib yuboradi. Shuning uchun to'liq nishon chizdiriladi (baholash uchun), keyin esa faqat sof oq belgi kesib olinadi — ilova diskni, rang gradientini, «qulflangan» holatni va 2-pog'ona halqasini o'zi chizadi.

5) BELGINI AJRATIB OLISH (dizayner yoki dasturchi bajaradi). 1024 lik PNG'dan sof #FFFFFF ranggi bo'yicha maska oling → faqat oq shakl qolsin, qolgani to'liq shaffof → shaklni o'z chegarasigacha qirqing (trim) → hech qanday chekka bo'shliqsiz kvadratga tenglashtiring (pad to square) → 512x512 qilib saqlang. DIQQAT: chekka bo'shliq qoldirmang. Komponent o'zi round(size * 0.56) ni qo'llaydi; agar PNG ichida yana bo'shliq qolsa, 0.56 ikki marta qo'llanadi va belgi ikki barobar kichkina chiqadi.

6) SIFAT NAZORATI — har bir belgi uchun majburiy. Ajratilgan oq belgini qora rangga tekislab 24 px va 16 px kenglikda ko'ring (16 px — haqiqiy eng yomon holat: 2x ekranda 15pt nishon). Keyin uni o'z disk gradienti ustiga va qulflangan kulrang-ko'k gradient ustiga qo'yib, 15, 17, 18 va 46 pt da tekshiring. Juftlab solishtiring: alanga va yurak yonma-yon; raketa va lampochka yonma-yon; yulduz va zinapoya yonma-yon. Ikkitasi adashsa — o'sha bittasini qayta chizdiring, promptdagi ACCEPTANCE TEST bandiga havola qilib.

7) RAD ETISH MEZONLARI (qayta chizdiring, tahrir qilmang): belgi ichida teshik yoki chiziq bor; yonida mayda uchqun/nuqta bor; belgi atrofida kontur, soya, nur yoki halqa bor; disk markazda emas yoki chekkasi qirqilgan; rangda uchinchi ton paydo bo'lgan; harf yoki raqam bor; zinapoyaning yuqori qirrasi tekis diagonalga aylanib ketgan; lampochka tuxumga o'xshab qolgan; alanga simmetrik tomchiga o'xshab qolgan.

8) DASTURCHIGA NIMA TOPSHIRILADI.
   • duyo-mobile/assets/badges/ ichiga oltita fayl: spark.png, flame.png, brain.png, ascent.png, rocket.png, heart.png — har biri 512x512, PNG-32 (alpha bilan), faqat sof oq belgi, shaffof fon, qirqilgan va kvadratga tenglashtirilgan.
   • Tekshirish uchun asl 1024 lik nishonlar: duyo-mobile/assets/badges/preview/spark-1024.png va hokazo (ilovaga kirmaydi, faqat arxiv).
   • Fayl nomlari BadgeKind bilan bir xil bo'lishi shart (spark, flame, brain, ascent, rocket, heart) — kod shu nomlarga tayanadi. brain fayli endi lampochkani chizadi; kalit nomi ataylab o'zgartirilmadi, chunki uni o'zgartirish backend bilan kelishuvni ham qo'zg'atadi.
   • Alanga bitta fayl: streak_3 va streak_7 bir xil rasmni ulashadi, farqi — ilova chizadigan halqa.
   • Kul rang («qulflangan») variant KERAK EMAS — ilova rangni o'zi almashtiradi.

---

## Oltita prompt

### 1. Birinchi suhbat — to'rt nurli yulduz (first_chat, 1-o'rin)

**Qanday ochiladi:** DUYO bilan birinchi marta gaplashing

**Nega shu ramz:** Bu «birinchi uchqun» — bolaning DUYO bilan birinchi gapi; to'rt nurli yulduz oiladagi yagona radial va burchakli shakl, shuning uchun 16 pikselda ham qolgan beshtasi bilan aralashmaydi. lucide Sparkles'dagi ikkita kichik yulduzcha o'sha o'lchamda chang bo'lib ko'ringani uchun olib tashlandi; qolgan xavf shuki, yulduz «reyting/eng zo'r» ma'nosini ham beradi — shu sababli u besh nurli emas, to'rt nurli, uchlari bo'g'iq va nurlari chuqur kesilgan qilib chizilgan.

<details><summary>Promptni ochish (nusxa ko‘chiring)</summary>

```text
SUBJECT: One four-pointed star — a fat, upright, blunt-tipped star with points at twelve, three, six and nine o'clock and deeply concave sides between them, on a disc whose gradient runs from #4A90F5 at the upper left to #2563EB at the lower right.

SUBJECT DETAIL: Exactly one star and nothing else — no companion stars, no second or third smaller star beside it, no satellite dots, no radiating rays, no glints, no trailing motes, no particles. Call it a four-pointed star: do not read the words spark or twinkle as licence to add any sparkle effect. It is one solid white area with a single continuous outer contour — no hole, no inner star, no cut-out centre, no interior line work. It is mirror-symmetric about both the vertical and the horizontal centre line, with its two vertical points slightly longer than its two horizontal points.

PROPORTIONS on the 1024 x 1024 canvas, measured from the centre of the mark: the top and bottom tips reach 287 pixels and the left and right tips reach 240 pixels, so the mark is 573 pixels tall and 480 pixels wide. The concave side joining two adjacent points bows inward to 100 pixels from the centre — a DEEP concavity, so the narrowest diagonal waist of the star measures about 200 pixels and the four arms stand clearly apart instead of reading as four lobes on a lump. Each arm's flanks taper steadily from that waist out to its cap rather than running parallel, so no arm is a constant-width finger.

PLACEMENT: The centre of the mark's bounding box sits exactly on the centre of the disc. Do not offset it, do not nudge it, do not re-balance it by centre of mass or by eye, and do not rotate or tilt it. Upright, head-on, axis-aligned.

FAMILY EDGE RULES — identical in all six badges of this set, do not vary them: the mark is one solid white area with a single continuous outer contour and ZERO interior counters — nothing is cut out of it and nothing floats beside it. Every terminal ends in a rounded cap exactly 90 pixels wide on this 1024 pixel canvas — a blunt finger, never a needle, never a spike. Every corner where two straight edges meet carries a 16 pixel radius: decisive, not soft, and never mathematically sharp. No limb and no negative gap anywhere in the mark is narrower than 100 pixels.

NOT THIS: not a plus sign, not a cross, not a diamond, not a gem, not a flower, not a snowflake, not a compass rose, not a five-pointed star, not a needle-pointed sparkle.

ACCEPTANCE TEST: flatten the mark to a solid black silhouette and view it 24 pixels wide, then again 16 pixels wide — the app's real worst case, a 15pt badge on a 2x screen. It must read as a four-armed star with visible gaps between the arms at both sizes. If it reads as a gem, a diamond, a flower, a plus or a rounded blob, the concavity is too shallow: deepen the waist, do not thin the arms.

USE: A production UI achievement badge for a children's mobile app — a shipped interface asset from an existing six-badge family, not concept art, not a design mockup, not a sticker, not an illustration, not a product photograph.

CANVAS: One square 1:1 image, 1024 x 1024 pixels. A single filled circle — the disc — is the entire artwork. The disc is concentric with the square and tangent to all four edges: its diameter equals the full canvas width, and its rim runs a hair past the boundary rather than fading inside it. The only region outside the disc is the four small corner areas, and those are fully transparent alpha — true alpha, not white, not grey, not a checkerboard pattern. Keep everything outside the disc transparent. No scenery, no card, no panel, no plinth, no tile, no frame, no second circle, no drawn outline or rim around the disc.

SUBJECT: One four-pointed star — a fat, upright, blunt-tipped star with points at twelve, three, six and nine o'clock and deeply concave sides between them, on a disc whose gradient runs from #4A90F5 at the upper left to #2563EB at the lower right.

COMPOSITION: One single white mark sits on the disc. Its bounding box is 56% of the canvas width, optically centred on the disc's centre, axis-aligned, head-on orthographic, with no tilt, no rotation, no perspective, no foreshortening. An unbroken band of disc colour at least 15% of the canvas width separates the mark from the rim on every side; the mark never touches or crosses the rim.

FORM: The mark is ONE closed shape with a single continuous outer contour — chunky, confident, generously proportioned, built from at most three merged parts and carrying at most two interior counters. No separate floating pieces, no satellite dots, no particles, no stems, no spikes, no wires, no tapering hairlines. Every limb and every interior gap is at least 8% of the canvas width — roughly 82 pixels on this 1024 pixel canvas — and no feature anywhere in the image is thinner than 30 pixels. Corners are sharp and decisive where the shape turns, softly rounded only where the real object would be round; not a soft blob. The mark must remain identifiable when its silhouette alone is flattened to solid black and viewed 24 pixels wide.

STYLE: Flat vector. The mark is one solid area of pure #FFFFFF at full opacity — no tint, no second white, no grey, no shading, no gradient inside the mark, no transparency inside the mark, no interior line work, no engraving, no hatching, no facets, no texture, no grain, no noise. Edges are crisp vector edges, antialiased at the pixel level only: no feather, no blur, no glow, no halo, no keyline, no outline, no contour stroke, no cel-shaded border, no stroke of a second colour anywhere around the mark. Generous negative space. Designed to remain instantly nameable when the whole image is scaled down to 17 pixels.

MATERIAL AND LIGHT: Completely flat and matte. No light source is simulated anywhere in the image: no highlight, no specular, no sheen, no gloss, no bevel, no emboss, no inner shadow, no ambient occlusion, no rim light, no reflection, no 3D form, no depth, no plastic, no metal, no enamel, no glass. The only tonal variation in the entire image is the disc's own two-stop gradient.

COLOR: Exactly three colours in the whole image — the two hex values named in the SUBJECT line, plus #FFFFFF for the mark. The disc is a smooth two-stop linear gradient between exactly those two hex values, the lighter stop at the upper left and the deeper stop at the lower right, along an axis about 35 degrees off vertical. Use those hex values literally. No third stop, no additional hue, no colour cast, no warm shift, no cream, no beige, no yellow tint, no accent colour.

SET RULES: This badge is one of a family of six that will be seen side by side in one column, in a fixed order. All six share an identical outer silhouette — the same full-bleed circle at the same diameter — identical stroke weight, identical corner treatment, identical optical scale, identical light treatment (none at all), and identical padding inside the same square bounding box. Only the white mark and the two gradient hex values ever change between them. Do not redesign the family style; change only the subject.

CONSTRAINTS: No text of any kind — no letters, no numerals, no words, no captions, no labels, no legend, no numbering, no title, no signature, no watermark, no logo, no trademark, no brand mark, no emoji. No badge furniture — no ribbon, no banner, no scroll, no laurel, no wreath, no starburst, no confetti, no sparkle particles, no cog or scalloped rim, no ring, no border, no second circle, no pin, no clasp, no backing card. No drop shadow, no cast shadow, no contact shadow, no shadow anywhere in the alpha. No character, no face, no eyes, no mascot, no robot, no hands. No UI chrome, no backdrop, no checkerboard, no floor, no staging. Pure pictogram: one white mark on one gradient disc, transparent alpha in the four corners, and nothing else in the image.
```

</details>

### 2. 3 va 7 kunlik seriya — alanga (streak_3 va streak_7, bitta rasm)

**Qanday ochiladi:** 3 kun ketma-ket kiring

**Nega shu ramz:** Seriya uchun olov — bolalar allaqachon biladigan yagona belgi, va ikkala pog'ona (3 kun va 7 kun) bir xil rasmni ulashadi: «o'sha nishon, uzoqroq davom etgan» degani. Faylning o'z izohida qayd etilgani kabi eski alanga tomchiga o'xshab qolgandi — shuning uchun uchi o'ngga kuchli qayrilgan, pastki chap qo'shimcha til esa kichik o'lchamda ko'rinmagani uchun butunlay olib tashlandi.

<details><summary>Promptni ochish (nusxa ko‘chiring)</summary>

```text
SUBJECT: One stylized flame — a single solid tongue of fire, broad and round at the base, narrowing through a full curved shoulder to one blunt tip that hooks hard over to the right, on a disc whose gradient runs from #E2761A at the upper left to #B34E08 at the lower right.

SUBJECT DETAIL: One unbroken solid white area — no inner tongue, no cut-out core, no hole, no second flame nested inside it, no separate spark, and NO secondary lobe on the lower-left flank. Every contour is a curve. The lean is the entire idea, so exaggerate it well past comfort: the topmost point of the shape sits at least 130 pixels to the RIGHT of the mark's vertical centre line, the right flank is visibly concave under that hook, and the left flank runs full and convex. The result must be obviously handed — a mirror image of it would look wrong. That asymmetry is a property of the whole silhouette, which is why it is the only cue that survives a 30:1 downscale, and it is the one thing separating this mark from a symmetrical water droplet.

PROPORTIONS on the 1024 x 1024 canvas: the mark is 430 pixels wide and 573 pixels tall, so it is taller than it is wide. The tip reaches 287 pixels above the centre. The body is widest one third up from the base, about 95 pixels below the centre, where it spans the full 430 pixels. The narrowest neck, just below the hook, is at least 160 pixels across. The 430 pixel width already includes the hook.

PLACEMENT: The centre of the mark's bounding box sits exactly on the centre of the disc. Do not offset it, do not nudge it, do not re-balance it by centre of mass or by eye, and do not rotate or tilt it. Upright, head-on, axis-aligned. The lean lives in the drawn outline; the shape itself is never rotated and its bounding box is never tilted.

FAMILY EDGE RULES — identical in all six badges of this set, do not vary them: the mark is one solid white area with a single continuous outer contour and ZERO interior counters — nothing is cut out of it and nothing floats beside it. Every terminal ends in a rounded cap exactly 90 pixels wide on this 1024 pixel canvas — a blunt finger, never a needle, never a spike. Every corner where two straight edges meet carries a 16 pixel radius: decisive, not soft, and never mathematically sharp. No limb and no negative gap anywhere in the mark is narrower than 100 pixels.

TIER NOTE: this one drawing serves both the three-day and the seven-day streak badge. The deeper of the two is marked by a ring drawn by the app at runtime, never by the art. Do not draw a ring, a rim, a second circle or any other tier marker.

NOT THIS: not a water droplet, not a teardrop, not a leaf, not a paisley, not a comma. Nothing is burning and nothing is being burnt — no smoke, no embers, no flying sparks, no heat wisps, no fuel, no log, no coal, no candle, no wick, no match, no torch, no hearth, no ground line beneath the flame.

ACCEPTANCE TEST: flatten the mark to a solid black silhouette and view it 24 pixels wide, then again 16 pixels wide — the app's real worst case, a 15pt badge on a 2x screen. It must be taller than wide, point up, and visibly leaning right at both sizes; place it beside the heart mark at the same size and the two must not be confusable. If it reads as a symmetrical water droplet, the hook is not far enough over.

USE: A production UI achievement badge for a children's mobile app — a shipped interface asset from an existing six-badge family, not concept art, not a design mockup, not a sticker, not an illustration, not a product photograph.

CANVAS: One square 1:1 image, 1024 x 1024 pixels. A single filled circle — the disc — is the entire artwork. The disc is concentric with the square and tangent to all four edges: its diameter equals the full canvas width, and its rim runs a hair past the boundary rather than fading inside it. The only region outside the disc is the four small corner areas, and those are fully transparent alpha — true alpha, not white, not grey, not a checkerboard pattern. Keep everything outside the disc transparent. No scenery, no card, no panel, no plinth, no tile, no frame, no second circle, no drawn outline or rim around the disc.

SUBJECT: One stylized flame — a single solid tongue of fire, broad and round at the base, narrowing through a full curved shoulder to one blunt tip that hooks hard over to the right, on a disc whose gradient runs from #E2761A at the upper left to #B34E08 at the lower right.

COMPOSITION: One single white mark sits on the disc. Its bounding box is 56% of the canvas width, optically centred on the disc's centre, axis-aligned, head-on orthographic, with no tilt, no rotation, no perspective, no foreshortening. An unbroken band of disc colour at least 15% of the canvas width separates the mark from the rim on every side; the mark never touches or crosses the rim.

FORM: The mark is ONE closed shape with a single continuous outer contour — chunky, confident, generously proportioned, built from at most three merged parts and carrying at most two interior counters. No separate floating pieces, no satellite dots, no particles, no stems, no spikes, no wires, no tapering hairlines. Every limb and every interior gap is at least 8% of the canvas width — roughly 82 pixels on this 1024 pixel canvas — and no feature anywhere in the image is thinner than 30 pixels. Corners are sharp and decisive where the shape turns, softly rounded only where the real object would be round; not a soft blob. The mark must remain identifiable when its silhouette alone is flattened to solid black and viewed 24 pixels wide.

STYLE: Flat vector. The mark is one solid area of pure #FFFFFF at full opacity — no tint, no second white, no grey, no shading, no gradient inside the mark, no transparency inside the mark, no interior line work, no engraving, no hatching, no facets, no texture, no grain, no noise. Edges are crisp vector edges, antialiased at the pixel level only: no feather, no blur, no glow, no halo, no keyline, no outline, no contour stroke, no cel-shaded border, no stroke of a second colour anywhere around the mark. Generous negative space. Designed to remain instantly nameable when the whole image is scaled down to 17 pixels.

MATERIAL AND LIGHT: Completely flat and matte. No light source is simulated anywhere in the image: no highlight, no specular, no sheen, no gloss, no bevel, no emboss, no inner shadow, no ambient occlusion, no rim light, no reflection, no 3D form, no depth, no plastic, no metal, no enamel, no glass. The only tonal variation in the entire image is the disc's own two-stop gradient.

COLOR: Exactly three colours in the whole image — the two hex values named in the SUBJECT line, plus #FFFFFF for the mark. The disc is a smooth two-stop linear gradient between exactly those two hex values, the lighter stop at the upper left and the deeper stop at the lower right, along an axis about 35 degrees off vertical. Use those hex values literally. No third stop, no additional hue, no colour cast, no warm shift, no cream, no beige, no yellow tint, no accent colour.

SET RULES: This badge is one of a family of six that will be seen side by side in one column, in a fixed order. All six share an identical outer silhouette — the same full-bleed circle at the same diameter — identical stroke weight, identical corner treatment, identical optical scale, identical light treatment (none at all), and identical padding inside the same square bounding box. Only the white mark and the two gradient hex values ever change between them. Do not redesign the family style; change only the subject.

CONSTRAINTS: No text of any kind — no letters, no numerals, no words, no captions, no labels, no legend, no numbering, no title, no signature, no watermark, no logo, no trademark, no brand mark, no emoji. No badge furniture — no ribbon, no banner, no scroll, no laurel, no wreath, no starburst, no confetti, no sparkle particles, no cog or scalloped rim, no ring, no border, no second circle, no pin, no clasp, no backing card. No drop shadow, no cast shadow, no contact shadow, no shadow anywhere in the alpha. No character, no face, no eyes, no mascot, no robot, no hands. No UI chrome, no backdrop, no checkerboard, no floor, no staging. Pure pictogram: one white mark on one gradient disc, transparent alpha in the four corners, and nothing else in the image.
```

</details>

### 3. Qiziquvchi — lampochka (curious, 3-o'rin)

**Qanday ochiladi:** 10 ta xabar yozing

**Nega shu ramz:** Miya belgisi tashlandi: badge.tsx'ning o'z izohi 46pt da uni «ikkita bo'lak» bo'lib o'qilganini yozib qo'ygan, va uning butun ma'nosi ichki chiziqlarda — uy uslubi esa ichki chiziqni taqiqlaydi. Lampochka «savol/fikr paydo bo'ldi» degani, bu esa aynan 10 ta xabar yozgan bolaning qilgan ishi; nurlar qo'shilmadi (uy qoidasi alohida uchib yuruvchi bo'laklarni taqiqlaydi), shuning uchun uni tanitadigan narsa — keskin bo'yin qisilishi va tekis tag.

<details><summary>Promptni ochish (nusxa ko‘chiring)</summary>

```text
SUBJECT: A stylized lightbulb seen in strict front elevation — one broad round crown that pinches inward to a short thick neck and squares off onto a straight-sided base with a flat bottom edge, on a disc whose gradient runs from #9457EE at the upper left to #5B21B6 at the lower right.

SUBJECT DETAIL: Three merged parts — crown, neck, base — fused into one closed contour with no seam, no gap and no dividing line. No filament, no glass line, no rays, no beams of light, no separate parts, nothing floating beside it. This mark must therefore be nameable from its profile alone, and the profile does it in one move: the crown is a near-circle, the widest part of the whole mark, and it pinches inward over a short vertical distance with two decisive shoulder corners rather than a smooth taper, dropping to a narrow straight-sided column that ends in one flat horizontal bottom edge. Upright and mirror-symmetric about the vertical axis.

PROPORTIONS on the 1024 x 1024 canvas: the mark is 460 pixels wide and 573 pixels tall. The crown is the top 355 pixels, a near-circular arc 460 pixels across at its widest, swelling slightly below its own middle. The neck and base below it are 190 pixels across — a pinch to 41% of the crown's width, deliberately severe, because a shallow pinch turns this mark into an egg. The base is the bottom 149 pixels, straight-sided at that same 190 pixels, ending in a flat horizontal bottom edge with two square bottom corners.

PLACEMENT: The centre of the mark's bounding box sits exactly on the centre of the disc. Do not offset it, do not nudge it, do not re-balance it by centre of mass or by eye, and do not rotate or tilt it. Upright, head-on, axis-aligned.

FAMILY EDGE RULES — identical in all six badges of this set, do not vary them: the mark is one solid white area with a single continuous outer contour and ZERO interior counters — nothing is cut out of it and nothing floats beside it. Every terminal ends in a rounded cap exactly 90 pixels wide on this 1024 pixel canvas — a blunt finger, never a needle, never a spike. Every corner where two straight edges meet carries a 16 pixel radius: decisive, not soft, and never mathematically sharp. No limb and no negative gap anywhere in the mark is narrower than 100 pixels.

NOT THIS: not an egg, not a balloon, not a hot-air balloon, not a keyhole, not a chess pawn, not a thermometer, not a hand mirror, and not the rocket badge in this same family. The separator from that rocket is mandatory and structural: the widest point of THIS mark is at the TOP and its narrowest is at the BOTTOM, the exact inverse of the rocket, whose widest point is at the very bottom. Nothing sits underneath the bulb — the base is part of the bulb itself, not a stand, not a pedestal, not a step, not a tile, not a panel. The bulb is pure #FFFFFF and nothing else: no yellow, no gold, no cream, no warm cast, no glow, no rays, no lit appearance.

ACCEPTANCE TEST: flatten the mark to a solid black silhouette and view it 24 pixels wide, then again 16 pixels wide — the app's real worst case, a 15pt badge on a 2x screen. A wide round crown over a narrow straight column with a flat bottom must still be readable at both sizes. If it reads as an egg or a balloon, the pinch is too shallow: narrow the neck further, do not add detail.

USE: A production UI achievement badge for a children's mobile app — a shipped interface asset from an existing six-badge family, not concept art, not a design mockup, not a sticker, not an illustration, not a product photograph.

CANVAS: One square 1:1 image, 1024 x 1024 pixels. A single filled circle — the disc — is the entire artwork. The disc is concentric with the square and tangent to all four edges: its diameter equals the full canvas width, and its rim runs a hair past the boundary rather than fading inside it. The only region outside the disc is the four small corner areas, and those are fully transparent alpha — true alpha, not white, not grey, not a checkerboard pattern. Keep everything outside the disc transparent. No scenery, no card, no panel, no plinth, no tile, no frame, no second circle, no drawn outline or rim around the disc.

SUBJECT: A stylized lightbulb seen in strict front elevation — one broad round crown that pinches inward to a short thick neck and squares off onto a straight-sided base with a flat bottom edge, on a disc whose gradient runs from #9457EE at the upper left to #5B21B6 at the lower right.

COMPOSITION: One single white mark sits on the disc. Its bounding box is 56% of the canvas width, optically centred on the disc's centre, axis-aligned, head-on orthographic, with no tilt, no rotation, no perspective, no foreshortening. An unbroken band of disc colour at least 15% of the canvas width separates the mark from the rim on every side; the mark never touches or crosses the rim.

FORM: The mark is ONE closed shape with a single continuous outer contour — chunky, confident, generously proportioned, built from at most three merged parts and carrying at most two interior counters. No separate floating pieces, no satellite dots, no particles, no stems, no spikes, no wires, no tapering hairlines. Every limb and every interior gap is at least 8% of the canvas width — roughly 82 pixels on this 1024 pixel canvas — and no feature anywhere in the image is thinner than 30 pixels. Corners are sharp and decisive where the shape turns, softly rounded only where the real object would be round; not a soft blob. The mark must remain identifiable when its silhouette alone is flattened to solid black and viewed 24 pixels wide.

STYLE: Flat vector. The mark is one solid area of pure #FFFFFF at full opacity — no tint, no second white, no grey, no shading, no gradient inside the mark, no transparency inside the mark, no interior line work, no engraving, no hatching, no facets, no texture, no grain, no noise. Edges are crisp vector edges, antialiased at the pixel level only: no feather, no blur, no glow, no halo, no keyline, no outline, no contour stroke, no cel-shaded border, no stroke of a second colour anywhere around the mark. Generous negative space. Designed to remain instantly nameable when the whole image is scaled down to 17 pixels.

MATERIAL AND LIGHT: Completely flat and matte. No light source is simulated anywhere in the image: no highlight, no specular, no sheen, no gloss, no bevel, no emboss, no inner shadow, no ambient occlusion, no rim light, no reflection, no 3D form, no depth, no plastic, no metal, no enamel, no glass. The only tonal variation in the entire image is the disc's own two-stop gradient.

COLOR: Exactly three colours in the whole image — the two hex values named in the SUBJECT line, plus #FFFFFF for the mark. The disc is a smooth two-stop linear gradient between exactly those two hex values, the lighter stop at the upper left and the deeper stop at the lower right, along an axis about 35 degrees off vertical. Use those hex values literally. No third stop, no additional hue, no colour cast, no warm shift, no cream, no beige, no yellow tint, no accent colour.

SET RULES: This badge is one of a family of six that will be seen side by side in one column, in a fixed order. All six share an identical outer silhouette — the same full-bleed circle at the same diameter — identical stroke weight, identical corner treatment, identical optical scale, identical light treatment (none at all), and identical padding inside the same square bounding box. Only the white mark and the two gradient hex values ever change between them. Do not redesign the family style; change only the subject.

CONSTRAINTS: No text of any kind — no letters, no numerals, no words, no captions, no labels, no legend, no numbering, no title, no signature, no watermark, no logo, no trademark, no brand mark, no emoji. No badge furniture — no ribbon, no banner, no scroll, no laurel, no wreath, no starburst, no confetti, no sparkle particles, no cog or scalloped rim, no ring, no border, no second circle, no pin, no clasp, no backing card. No drop shadow, no cast shadow, no contact shadow, no shadow anywhere in the alpha. No character, no face, no eyes, no mascot, no robot, no hands. No UI chrome, no backdrop, no checkerboard, no floor, no staging. Pure pictogram: one white mark on one gradient disc, transparent alpha in the four corners, and nothing else in the image.
```

</details>

### 4. Daraja oshish — zinapoya (level_up, 4-o'rin)

**Qanday ochiladi:** 2-darajaga chiqing

**Nega shu ramz:** «Daraja» so'zining o'zi zinapoyaning bir pog'onasi degani, va bola uchun bu eng tushunarli tasvir: bir pog'ona yuqori chiqdim. lucide TrendingUp — birja grafigi: ingichka ochiq siniq chiziq va alohida uchi bor, 10 pikselda u kul rang chiziqqa aylanadi; zinapoya esa to'la, to'g'ri chiziqli va assimetrik, shu bois yagona ko'k rangdosh (spark) bilan hech qachon adashmaydi.

<details><summary>Promptni ochish (nusxa ko‘chiring)</summary>

```text
SUBJECT: A bold three-step staircase — one solid rectilinear mass with a flat bottom edge whose top edge climbs in three equal steps from a short block at the left to a tall block at the right, on a disc whose gradient runs from #3A6FD8 at the upper left to #16307A at the lower right.

SUBJECT DETAIL: A single fused mass, never three separate bars — the three steps meet along their full shared edges and merge into one continuous white area with no gap, no seam, no dividing line and no outline between them. The outer contour runs: a flat horizontal bottom edge across the full width, a short vertical left edge, then tread, riser, tread, riser, tread climbing to the right, then one tall vertical right edge straight back down to the bottom. The climb is strictly left to right and monotonic — the left step is the shortest and the right step the tallest.

PROPORTIONS on the 1024 x 1024 canvas: the mark's bounding box is a 500 pixel square. It is deliberately a little smaller than the 573 pixel box the rest of the family uses, because this is the only mark that fills its own box corners, and the clear band between mark and rim is measured to those corners; a 573 pixel square would put them within 107 pixels of the rim and break the band. Each of the three treads is exactly one third of the width — 167 pixels — and each of the three risers is exactly one third of the height — 167 pixels, so the step corners line up along one clean 45 degree diagonal. Risers this deep are the whole point: shallow steps fuse into a plain diagonal ramp at small size and the mark stops saying stairs.

PLACEMENT: The centre of the mark's bounding box sits exactly on the centre of the disc. Do not offset it, do not nudge it, do not re-balance it by centre of mass or by eye, and do not rotate or tilt it. Upright, head-on, axis-aligned.

FAMILY EDGE RULES — identical in all six badges of this set, do not vary them: the mark is one solid white area with a single continuous outer contour and ZERO interior counters — nothing is cut out of it and nothing floats beside it. Every terminal ends in a rounded cap exactly 90 pixels wide on this 1024 pixel canvas — a blunt finger, never a needle, never a spike. Every corner where two straight edges meet carries a 16 pixel radius: decisive, not soft, and never mathematically sharp. No limb and no negative gap anywhere in the mark is narrower than 100 pixels.

NOT THIS: no arrowhead, no chevron, no arrow of any kind, no diagonal trend line, no zigzag, no separate bars, no baseline rule, no axis, no flag, no pennant, no climbing figure, no dots or nosings on the steps. Never a tall middle step, never a symmetrical podium, never a descending step. Not a triangle, not a wedge, not a ramp, not a bar chart.

ACCEPTANCE TEST: flatten the mark to a solid black silhouette and view it 24 pixels wide, then again 16 pixels wide — the app's real worst case, a 15pt badge on a 2x screen. Two notches must still be visible in the top edge at both sizes. If the top edge has smoothed into a single diagonal, the mark is rejected — that is the failure the square box and the one-third risers exist to prevent, and it is not a tolerance.

USE: A production UI achievement badge for a children's mobile app — a shipped interface asset from an existing six-badge family, not concept art, not a design mockup, not a sticker, not an illustration, not a product photograph.

CANVAS: One square 1:1 image, 1024 x 1024 pixels. A single filled circle — the disc — is the entire artwork. The disc is concentric with the square and tangent to all four edges: its diameter equals the full canvas width, and its rim runs a hair past the boundary rather than fading inside it. The only region outside the disc is the four small corner areas, and those are fully transparent alpha — true alpha, not white, not grey, not a checkerboard pattern. Keep everything outside the disc transparent. No scenery, no card, no panel, no plinth, no tile, no frame, no second circle, no drawn outline or rim around the disc.

SUBJECT: A bold three-step staircase — one solid rectilinear mass with a flat bottom edge whose top edge climbs in three equal steps from a short block at the left to a tall block at the right, on a disc whose gradient runs from #3A6FD8 at the upper left to #16307A at the lower right.

COMPOSITION: One single white mark sits on the disc. Its bounding box is 56% of the canvas width, optically centred on the disc's centre, axis-aligned, head-on orthographic, with no tilt, no rotation, no perspective, no foreshortening. An unbroken band of disc colour at least 15% of the canvas width separates the mark from the rim on every side; the mark never touches or crosses the rim.

FORM: The mark is ONE closed shape with a single continuous outer contour — chunky, confident, generously proportioned, built from at most three merged parts and carrying at most two interior counters. No separate floating pieces, no satellite dots, no particles, no stems, no spikes, no wires, no tapering hairlines. Every limb and every interior gap is at least 8% of the canvas width — roughly 82 pixels on this 1024 pixel canvas — and no feature anywhere in the image is thinner than 30 pixels. Corners are sharp and decisive where the shape turns, softly rounded only where the real object would be round; not a soft blob. The mark must remain identifiable when its silhouette alone is flattened to solid black and viewed 24 pixels wide.

STYLE: Flat vector. The mark is one solid area of pure #FFFFFF at full opacity — no tint, no second white, no grey, no shading, no gradient inside the mark, no transparency inside the mark, no interior line work, no engraving, no hatching, no facets, no texture, no grain, no noise. Edges are crisp vector edges, antialiased at the pixel level only: no feather, no blur, no glow, no halo, no keyline, no outline, no contour stroke, no cel-shaded border, no stroke of a second colour anywhere around the mark. Generous negative space. Designed to remain instantly nameable when the whole image is scaled down to 17 pixels.

MATERIAL AND LIGHT: Completely flat and matte. No light source is simulated anywhere in the image: no highlight, no specular, no sheen, no gloss, no bevel, no emboss, no inner shadow, no ambient occlusion, no rim light, no reflection, no 3D form, no depth, no plastic, no metal, no enamel, no glass. The only tonal variation in the entire image is the disc's own two-stop gradient.

COLOR: Exactly three colours in the whole image — the two hex values named in the SUBJECT line, plus #FFFFFF for the mark. The disc is a smooth two-stop linear gradient between exactly those two hex values, the lighter stop at the upper left and the deeper stop at the lower right, along an axis about 35 degrees off vertical. Use those hex values literally. No third stop, no additional hue, no colour cast, no warm shift, no cream, no beige, no yellow tint, no accent colour.

SET RULES: This badge is one of a family of six that will be seen side by side in one column, in a fixed order. All six share an identical outer silhouette — the same full-bleed circle at the same diameter — identical stroke weight, identical corner treatment, identical optical scale, identical light treatment (none at all), and identical padding inside the same square bounding box. Only the white mark and the two gradient hex values ever change between them. Do not redesign the family style; change only the subject.

CONSTRAINTS: No text of any kind — no letters, no numerals, no words, no captions, no labels, no legend, no numbering, no title, no signature, no watermark, no logo, no trademark, no brand mark, no emoji. No badge furniture — no ribbon, no banner, no scroll, no laurel, no wreath, no starburst, no confetti, no sparkle particles, no cog or scalloped rim, no ring, no border, no second circle, no pin, no clasp, no backing card. No drop shadow, no cast shadow, no contact shadow, no shadow anywhere in the alpha. No character, no face, no eyes, no mascot, no robot, no hands. No UI chrome, no backdrop, no checkerboard, no floor, no staging. Pure pictogram: one white mark on one gradient disc, transparent alpha in the four corners, and nothing else in the image.
```

</details>

### 5. Izlanuvchi — raketa (explorer, 5-o'rin)

**Qanday ochiladi:** 50 ta xabar yozing

**Nega shu ramz:** 50 ta xabar — bu mahorat emas, masofa: bola uzoq yo'l bosdi, va raketa buni bolaga o'rgatmasdan tushuntiradigan yagona belgi (kodning o'zida ham «going a long way» deb yozilgan). Eski chizma xarita nishoniga o'xshab qolgandi — shuning uchun quvurning yon tomonlari qat'iy vertikal, tagi bitta to'g'ri chiziq, va eng keng joyi eng pastda; illuminator esa kichik o'lchamda kul rang dog' bo'lgani uchun butunlay olib tashlandi.

<details><summary>Promptni ochish (nusxa ko‘chiring)</summary>

```text
SUBJECT: A stylized upright rocket — one solid tube with straight parallel vertical sides, a blunt-tipped triangular nose cone fused to its top, and two broad straight-edged fins flaring out from its lower half down to a single flat horizontal base, on a disc whose gradient runs from #12A084 at the upper left to #0A7350 at the lower right.

SUBJECT DETAIL: Three merged parts — one body, being the tube and the nose cone fused into a single column, and two fins — joined into ONE uninterrupted white contour with no seam, no dividing line, no gap and no visible join anywhere between them. NOTHING IS CUT OUT OF THIS MARK: no porthole, no window, no panel lines, no rivets, no stripes, no seam on the nose cone. The porthole was removed on purpose — at the sizes this badge ships at it is under two device pixels and reads as a grey smudge in the middle of a small white shape. Upright and mirror-symmetric about the vertical axis, nose straight up, base straight down.

PROPORTIONS on the 1024 x 1024 canvas: the mark is 410 pixels wide, measured fin tip to fin tip, and 573 pixels tall. The nose cone is the top 160 pixels, an isosceles triangle standing on a base exactly the width of the tube. The tube is 210 pixels wide and its two sides are exactly vertical and exactly parallel from the base of the nose cone all the way down to the bottom edge — they never taper, never bulge, never curve. Each fin leaves the tube 344 pixels down from the apex and sweeps out and down to a tip 205 pixels from the centre line, adding 100 pixels of width per side; each fin's outer edge is a vertical of 120 pixels meeting the baseline. The base is ONE unbroken flat horizontal edge 410 pixels wide, tip to tip — no nozzle, no notch, no step, no scallop, no separate engine bell.

PLACEMENT: The centre of the mark's bounding box sits exactly on the centre of the disc. Do not offset it, do not nudge it, do not re-balance it by centre of mass or by eye, and do not rotate or tilt it. Upright, head-on, axis-aligned.

FAMILY EDGE RULES — identical in all six badges of this set, do not vary them: the mark is one solid white area with a single continuous outer contour and ZERO interior counters — nothing is cut out of it and nothing floats beside it. Every terminal ends in a rounded cap exactly 90 pixels wide on this 1024 pixel canvas — a blunt finger, never a needle, never a spike. Every corner where two straight edges meet carries a 16 pixel radius: decisive, not soft, and never mathematically sharp. No limb and no negative gap anywhere in the mark is narrower than 100 pixels.

NOT THIS: not a map pin, not a droplet, not a bullet, not a chess pawn, not a mountain, and not the lightbulb badge in this same family. Three cues prevent all of them and all three are mandatory: the tube's sides are exactly vertical and parallel; the bottom is one straight horizontal edge; and the widest point of the entire mark is at the very bottom, which is the exact inverse of the lightbulb, whose widest point is at the top. Nothing is launching — no exhaust, no flame, no jet, no plume, no smoke, no vapour, no speed lines, no motion lines, no trail, no dotted path, no swoosh, no arc, no sparks, no stars, no planets, no moon, no clouds, no launch pad, no gantry, no ground line.

ACCEPTANCE TEST: flatten the mark to a solid black silhouette and view it 24 pixels wide, then again 16 pixels wide — the app's real worst case, a 15pt badge on a 2x screen. A narrow straight column rising from a wide flat-based flare under one point must still read at both sizes. If it is confusable with the flame mark at that size, widen the fin span — do not add detail.

USE: A production UI achievement badge for a children's mobile app — a shipped interface asset from an existing six-badge family, not concept art, not a design mockup, not a sticker, not an illustration, not a product photograph.

CANVAS: One square 1:1 image, 1024 x 1024 pixels. A single filled circle — the disc — is the entire artwork. The disc is concentric with the square and tangent to all four edges: its diameter equals the full canvas width, and its rim runs a hair past the boundary rather than fading inside it. The only region outside the disc is the four small corner areas, and those are fully transparent alpha — true alpha, not white, not grey, not a checkerboard pattern. Keep everything outside the disc transparent. No scenery, no card, no panel, no plinth, no tile, no frame, no second circle, no drawn outline or rim around the disc.

SUBJECT: A stylized upright rocket — one solid tube with straight parallel vertical sides, a blunt-tipped triangular nose cone fused to its top, and two broad straight-edged fins flaring out from its lower half down to a single flat horizontal base, on a disc whose gradient runs from #12A084 at the upper left to #0A7350 at the lower right.

COMPOSITION: One single white mark sits on the disc. Its bounding box is 56% of the canvas width, optically centred on the disc's centre, axis-aligned, head-on orthographic, with no tilt, no rotation, no perspective, no foreshortening. An unbroken band of disc colour at least 15% of the canvas width separates the mark from the rim on every side; the mark never touches or crosses the rim.

FORM: The mark is ONE closed shape with a single continuous outer contour — chunky, confident, generously proportioned, built from at most three merged parts and carrying at most two interior counters. No separate floating pieces, no satellite dots, no particles, no stems, no spikes, no wires, no tapering hairlines. Every limb and every interior gap is at least 8% of the canvas width — roughly 82 pixels on this 1024 pixel canvas — and no feature anywhere in the image is thinner than 30 pixels. Corners are sharp and decisive where the shape turns, softly rounded only where the real object would be round; not a soft blob. The mark must remain identifiable when its silhouette alone is flattened to solid black and viewed 24 pixels wide.

STYLE: Flat vector. The mark is one solid area of pure #FFFFFF at full opacity — no tint, no second white, no grey, no shading, no gradient inside the mark, no transparency inside the mark, no interior line work, no engraving, no hatching, no facets, no texture, no grain, no noise. Edges are crisp vector edges, antialiased at the pixel level only: no feather, no blur, no glow, no halo, no keyline, no outline, no contour stroke, no cel-shaded border, no stroke of a second colour anywhere around the mark. Generous negative space. Designed to remain instantly nameable when the whole image is scaled down to 17 pixels.

MATERIAL AND LIGHT: Completely flat and matte. No light source is simulated anywhere in the image: no highlight, no specular, no sheen, no gloss, no bevel, no emboss, no inner shadow, no ambient occlusion, no rim light, no reflection, no 3D form, no depth, no plastic, no metal, no enamel, no glass. The only tonal variation in the entire image is the disc's own two-stop gradient.

COLOR: Exactly three colours in the whole image — the two hex values named in the SUBJECT line, plus #FFFFFF for the mark. The disc is a smooth two-stop linear gradient between exactly those two hex values, the lighter stop at the upper left and the deeper stop at the lower right, along an axis about 35 degrees off vertical. Use those hex values literally. No third stop, no additional hue, no colour cast, no warm shift, no cream, no beige, no yellow tint, no accent colour.

SET RULES: This badge is one of a family of six that will be seen side by side in one column, in a fixed order. All six share an identical outer silhouette — the same full-bleed circle at the same diameter — identical stroke weight, identical corner treatment, identical optical scale, identical light treatment (none at all), and identical padding inside the same square bounding box. Only the white mark and the two gradient hex values ever change between them. Do not redesign the family style; change only the subject.

CONSTRAINTS: No text of any kind — no letters, no numerals, no words, no captions, no labels, no legend, no numbering, no title, no signature, no watermark, no logo, no trademark, no brand mark, no emoji. No badge furniture — no ribbon, no banner, no scroll, no laurel, no wreath, no starburst, no confetti, no sparkle particles, no cog or scalloped rim, no ring, no border, no second circle, no pin, no clasp, no backing card. No drop shadow, no cast shadow, no contact shadow, no shadow anywhere in the alpha. No character, no face, no eyes, no mascot, no robot, no hands. No UI chrome, no backdrop, no checkerboard, no floor, no staging. Pure pictogram: one white mark on one gradient disc, transparent alpha in the four corners, and nothing else in the image.
```

</details>

### 6. DUYO do'sti — yurak (duyo_dust, 7-o'rin, eng noyob)

**Qanday ochiladi:** 3-darajaga chiqing

**Nega shu ramz:** «DUYO do'sti» — bog'lanish haqidagi nishon, va yurakni 7 yoshli ham, 16 yoshli ham hech kim tushuntirmasdan o'qiydi; kalit nomidagi «dust» so'ziga ergashib chang-uchqun chizish esa uy qoidasi taqiqlagan mayda zarrachalarga va spark nishoni bilan to'qnashuvga olib kelardi. lucide'ning ichi bo'sh konturi o'rniga to'la to'ldirilgan yurak: kichik o'lchamda halqa eng yomon shakl, to'la shakl esa eng barqarori.

<details><summary>Promptni ochish (nusxa ko‘chiring)</summary>

```text
SUBJECT: One solid, upright, mirror-symmetric heart — two broad round shoulders meeting in a deep V notch at the top centre and converging to one blunt point at the bottom centre, on a disc whose gradient runs from #E85C97 at the upper left to #C01860 at the lower right.

SUBJECT DETAIL: One closed shape with a single continuous outer contour, filled solid and never drawn as a stroked outline — no smaller heart inside it, no hollow or outline heart, no split or half heart, no second heart, no glint, no highlight, no pulse or ECG line, no arrow, and nothing crossing, piercing or overlapping it. Each shoulder is a near-full half circle, round and fat and clearly separated from its twin. Below the shoulders the two flanks run in long, nearly straight lines down to the single bottom point, and the shape stays broad most of the way down.

PROPORTIONS on the 1024 x 1024 canvas: the mark is 540 pixels wide and 486 pixels tall — wider than it is tall, which together with the top notch is what separates it from the flame badge in this family. It is authored slightly under the 573 pixel box the rest of the family uses, on purpose: a solid heart at full box width carries visibly more white than any other mark in the set, so this is an optical-scale correction, not a scale break. Each shoulder is an arc of 135 pixel radius, so the two shoulders together span the full 540 pixels. THE NOTCH IS THE BUDGET ITEM: it is a decisive V measuring 162 pixels across at the crown line and descending 121 pixels below the crowns — a quarter of the mark's height, deliberately deeper and wider than a conventional heart's dimple, because a token dimple disappears below 24 pixels. The bottom point sits 243 pixels below the centre.

PLACEMENT: The centre of the mark's bounding box sits exactly on the centre of the disc. Do not offset it, do not nudge it, do not re-balance it by centre of mass or by eye, and do not rotate or tilt it. Upright, head-on, axis-aligned.

FAMILY EDGE RULES — identical in all six badges of this set, do not vary them: the mark is one solid white area with a single continuous outer contour and ZERO interior counters — nothing is cut out of it and nothing floats beside it. Every terminal ends in a rounded cap exactly 90 pixels wide on this 1024 pixel canvas — a blunt finger, never a needle, never a spike. Every corner where two straight edges meet carries a 16 pixel radius: decisive, not soft, and never mathematically sharp. No limb and no negative gap anywhere in the mark is narrower than 100 pixels. The bottom point of this heart takes that same 90 pixel cap — never a needle, never a thin hanging tail.

TIER NOTE: this badge wears a ring in the app to mark it as the rarest one. That ring is drawn by the app at runtime, never by the art. Do not draw a ring, a rim, a second circle or any other tier marker.

NOT THIS: not a flame, not an upside-down flame, not a leaf, not a spade, not a shield, not two overlapping hearts, not a heart outline, not a heart-shaped speech bubble, not sparkles or dust of any kind.

ACCEPTANCE TEST: flatten the mark to a solid black silhouette and view it 24 pixels wide, then again 16 pixels wide — the app's real worst case, a 15pt badge on a 2x screen — and place it beside the flame mark at the same size. The notch must still read as a bite out of the top edge, and this mark must be visibly wider than tall while the flame is taller than wide. Either cue failing is a rejection.

USE: A production UI achievement badge for a children's mobile app — a shipped interface asset from an existing six-badge family, not concept art, not a design mockup, not a sticker, not an illustration, not a product photograph.

CANVAS: One square 1:1 image, 1024 x 1024 pixels. A single filled circle — the disc — is the entire artwork. The disc is concentric with the square and tangent to all four edges: its diameter equals the full canvas width, and its rim runs a hair past the boundary rather than fading inside it. The only region outside the disc is the four small corner areas, and those are fully transparent alpha — true alpha, not white, not grey, not a checkerboard pattern. Keep everything outside the disc transparent. No scenery, no card, no panel, no plinth, no tile, no frame, no second circle, no drawn outline or rim around the disc.

SUBJECT: One solid, upright, mirror-symmetric heart — two broad round shoulders meeting in a deep V notch at the top centre and converging to one blunt point at the bottom centre, on a disc whose gradient runs from #E85C97 at the upper left to #C01860 at the lower right.

COMPOSITION: One single white mark sits on the disc. Its bounding box is 56% of the canvas width, optically centred on the disc's centre, axis-aligned, head-on orthographic, with no tilt, no rotation, no perspective, no foreshortening. An unbroken band of disc colour at least 15% of the canvas width separates the mark from the rim on every side; the mark never touches or crosses the rim.

FORM: The mark is ONE closed shape with a single continuous outer contour — chunky, confident, generously proportioned, built from at most three merged parts and carrying at most two interior counters. No separate floating pieces, no satellite dots, no particles, no stems, no spikes, no wires, no tapering hairlines. Every limb and every interior gap is at least 8% of the canvas width — roughly 82 pixels on this 1024 pixel canvas — and no feature anywhere in the image is thinner than 30 pixels. Corners are sharp and decisive where the shape turns, softly rounded only where the real object would be round; not a soft blob. The mark must remain identifiable when its silhouette alone is flattened to solid black and viewed 24 pixels wide.

STYLE: Flat vector. The mark is one solid area of pure #FFFFFF at full opacity — no tint, no second white, no grey, no shading, no gradient inside the mark, no transparency inside the mark, no interior line work, no engraving, no hatching, no facets, no texture, no grain, no noise. Edges are crisp vector edges, antialiased at the pixel level only: no feather, no blur, no glow, no halo, no keyline, no outline, no contour stroke, no cel-shaded border, no stroke of a second colour anywhere around the mark. Generous negative space. Designed to remain instantly nameable when the whole image is scaled down to 17 pixels.

MATERIAL AND LIGHT: Completely flat and matte. No light source is simulated anywhere in the image: no highlight, no specular, no sheen, no gloss, no bevel, no emboss, no inner shadow, no ambient occlusion, no rim light, no reflection, no 3D form, no depth, no plastic, no metal, no enamel, no glass. The only tonal variation in the entire image is the disc's own two-stop gradient.

COLOR: Exactly three colours in the whole image — the two hex values named in the SUBJECT line, plus #FFFFFF for the mark. The disc is a smooth two-stop linear gradient between exactly those two hex values, the lighter stop at the upper left and the deeper stop at the lower right, along an axis about 35 degrees off vertical. Use those hex values literally. No third stop, no additional hue, no colour cast, no warm shift, no cream, no beige, no yellow tint, no accent colour.

SET RULES: This badge is one of a family of six that will be seen side by side in one column, in a fixed order. All six share an identical outer silhouette — the same full-bleed circle at the same diameter — identical stroke weight, identical corner treatment, identical optical scale, identical light treatment (none at all), and identical padding inside the same square bounding box. Only the white mark and the two gradient hex values ever change between them. Do not redesign the family style; change only the subject.

CONSTRAINTS: No text of any kind — no letters, no numerals, no words, no captions, no labels, no legend, no numbering, no title, no signature, no watermark, no logo, no trademark, no brand mark, no emoji. No badge furniture — no ribbon, no banner, no scroll, no laurel, no wreath, no starburst, no confetti, no sparkle particles, no cog or scalloped rim, no ring, no border, no second circle, no pin, no clasp, no backing card. No drop shadow, no cast shadow, no contact shadow, no shadow anywhere in the alpha. No character, no face, no eyes, no mascot, no robot, no hands. No UI chrome, no backdrop, no checkerboard, no floor, no staging. Pure pictogram: one white mark on one gradient disc, transparent alpha in the four corners, and nothing else in the image.
```

</details>

---

## Muqobil uslublar

Uy uslubi blokini almashtirsangiz oltitasi ham o'zgaradi. SUBJECT satrlari
o'zgarmaydi — ular uslubdan mustaqil.

### Toy Vinyl

Six little white moulded-toy objects, softly lit and gently glossed, dropped onto the coloured disc the component already draws — the mascot's own material, cut down until it survives 17 pixels.

<details><summary>Uslub blokini ochish</summary>

```text
USE: A production UI icon for a children's mobile app — a shipped asset from an existing six-icon family, not concept art, not a sticker, not an illustration, not a poster.

CANVAS: Square, 1024x1024 pixels. One isolated object on actual fully transparent alpha. Keep all surrounding space transparent. The object is perfectly centred and occupies exactly 86% of the canvas width, with equal transparent margin on all four sides. Crisp silhouette, no halos, no fringing.

FORM: One single closed object, modelled as a chunky moulded toy. Head-on orthographic front view — no perspective, no tilt, no three-quarter angle, no ground plane, no horizon. Thick, confident, simple forms with generously rounded corners and softly bevelled edges. Every part of the object is at least 8% of the canvas width thick; no thin stems, no spikes, no wires, no separate floating pieces, and no gap or notch narrower than 5% of the canvas width. The object must still be identifiable when its outline is flattened to a solid black shape 34 pixels wide.

MATERIAL: Smooth semi-matte injection-moulded plastic, like a well-made toy — a soft satin sheen, never wet glass, chrome, metal, ceramic, glitter or fabric. No texture, no grain, no scratches, no seams, no panel lines, no screws, no rivets, no engraving, no interior line work, no decorative micro-detail.

LIGHT: One single large soft key light from the upper left at 45 degrees, and one weak cool fill from the lower right. Soft ambient occlusion only where the object's own forms meet each other, staying strictly inside the outline. Exactly one broad soft specular highlight, in the upper-left area of the object. No second highlight, no rim light, no backlight, no reflections, no environment reflections, no bloom, no glow, no lens flare, no depth of field, no motion blur.

EDGES: The outline is defined by the material itself — no drawn contour, no outline stroke, no dark keyline, no cel-shaded border. The outline is hard-focused and clean against the transparent background. Interior form breaks are defined by soft shading only, never by a drawn line.

COLOR: The object is white. At least 75% of its area is flat near-pure #FFFFFF; volume is carried by cool blue-grey shading, #C7D8EE at the terminator and #A9C0DE in the deepest occlusion, with the single highlight a plain brighter white. Exactly these values and nothing else — no other hue anywhere on the object, no warm cast, no cream, no beige, no yellow tint, no brown-grey, no coloured accent, no coloured disc, plate, panel or gradient behind or around it.

SHADOW: No drop shadow, no cast shadow, no contact shadow, no shadow of any kind in the alpha channel. Nothing whatsoever exists outside the object's own outline.

SET RULES: This asset belongs to a six-icon family made in one continuous session. All six share identical material, identical light direction and light softness, identical bevel radius and edge softness, identical wall thickness, identical camera and orthographic projection, identical optical scale, and identical padding inside the same square bounding box. Do not redesign the family style; change only the subject.

LEGIBILITY: Designed to stay nameable when scaled down to 17 pixels. Bold, simple, high-contrast, generously spaced forms; strong readable silhouette; balanced negative space; nothing that depends on any detail smaller than 4% of the canvas width.

CONSTRAINTS: No text of any kind — no letters, no numerals, no words, no captions, no labels, no ribbons or banners with writing, no signature, no watermark, no logo, no trademark, no brand mark. No badge furniture — no ribbon, no banner, no laurel wreath, no starburst, no confetti, no sparkle particles, no plinth, no pedestal, no app tile, no rounded-square backing, no circle or disc behind the object, no border, no frame, no UI chrome. No scenery, no backdrop, no checkerboard, no floor. A pure pictogram: one solid object, a symbol only.
```

</details>

### Hard Enamel Pin (Cloisonné)

A hard-enamel lapel pin: one circular body bleeding to the canvas edge, a polished nickel rim, one flat saturated enamel field carrying the badge hue, and a single white cloisonné pictogram — because "metal line + flat colour cell" is structurally the same thing as "stroke + fill", which is the only construction that survives a 30:1 downscale.

<details><summary>Uslub blokini ochish</summary>

```text
USE: A production UI asset for a shipped mobile app — one achievement badge from a six-badge family, rendered as a hard-enamel collectible lapel pin. A final shipped asset, not concept art, not a mockup, not a product photograph.

CANVAS: Isolated object on actual fully transparent alpha. Keep all surrounding space transparent. Square 1:1 composition, 1024x1024.

SILHOUETTE: One perfect circle — the pin body — concentric with the square and bleeding a hair past all four edges, so the circle touches and slightly overruns the canvas boundary on every side. No transparent margin around the pin. No other outer shape: not a shield, not a rounded square, not a hexagon, not a star, no scalloped, notched or die-cut edge.

STRUCTURE — identical in all six badges, three concentric zones and only three: (1) an outer polished metal rim, a smooth flat band exactly 6% of the canvas width; (2) inside it, a single flat field of the badge colour filling the entire remaining area; (3) centred in that field, one pictogram in flat opaque white occupying 56% of the canvas width, drawn as ONE closed solid shape with a single continuous outer contour, separated from the colour field by a cloisonné line 3.5% of the canvas width in the shadowed metal tone. Exactly two enamel colours in the whole piece: the badge colour and white. No third colour, no internal subdivisions, no cells or windows inside the pictogram.

MATERIAL: Hard enamel — the enamel is polished flush with the metal, glass-smooth, completely flat and fully saturated, with no gradient across the colour field, no shading, no texture and no grain. The metal is cool polished nickel, #E8EEF7 at its lit edge falling to #A9BACE at its shadowed edge, as one clean transition around the band only.

LIGHT: A single soft key light from the top-left at 45 degrees, affecting the metal only. One small hard-edged specular crescent on the upper-left of the outer rim, no longer than one fifth of the circumference. The enamel field itself stays perfectly flat and evenly lit, its colour unchanged from edge to edge. No rim light, no bloom, no environment reflections, no second light source.

EDGE AND WEIGHT: Every line in the piece is a crisp hard edge with no feathering. All six badges share identical rim width, identical cloisonné line weight, identical corner radius on interior shapes, identical light direction, identical optical scale, and identical padding inside the same square bounding box. No feature anywhere is thinner than 30 pixels on this 1024 canvas.

LEGIBILITY: Designed to remain instantly nameable when scaled down to 17 pixels. Bold, chunky, high-contrast closed forms with generous negative space. Sharp confident corners rather than soft blobs. Head-on orthographic front view, dead centre, no tilt, no perspective, no foreshortening.

CONSTRAINTS: No text of any kind — no letters, no numerals, no words, no captions, no labels, no ribbons, no banners, no signature, no watermark, no logo, no trademark, no brand mark. It is a pure pictogram, a symbol only. No pin post, no butterfly clutch, no backing card, no packaging, no fabric, no hand, no photographic staging. No drop shadow, no cast shadow, no contact shadow, no glow, no halo, nothing outside the circle in the alpha. No backdrop, no scenery, no checkerboard, no border frame, no card, no panel behind the pin. No gradients in the enamel, no engraving, no hatching, no facets, no stepped or multi-tier bevel, no fine interior line work, no sparkles, no small decorative elements, no distressing or wear. Not a photograph, not a 3D render, not isometric. Crisp silhouette, no halos or fringing.
```

</details>

---

## Kodda nima o‘zgaradi

All changes are in duyo-mobile/src/components/badges/badge.tsx plus six new PNG files. No call site changes: Badge's props (kind, size, tier, locked) stay identical, BADGE_FOR / BADGE_RULE / topBadge stay byte-identical, asset count stays 6, and the four importing files (goal-mates-section.tsx:81, goal-mates-screen.tsx:246, activity-screen.tsx:221, achievements-screen.tsx:93+131) are untouched. There are no tests or snapshots for this component.

1. ASSETS. Add duyo-mobile/assets/badges/{spark,flame,brain,ascent,rocket,heart}.png — 512x512, PNG-32, pure #FFFFFF mark on transparent alpha, trimmed to the mark's own bounding box and padded to square with zero margin. 512 is ample: the largest render is 56pt = 168 device px at 3x. Keep them pure white so expo-image's tintColor stays available as a free escape hatch.

2. IMPORTS. Delete the lucide import block (lines 2-10) from this file only — lucide-react-native stays a dependency, every other icon in DUYO is lucide. Add: import { Image } from 'expo-image'; (expo-image ~56.0.9 is already a dependency). Keep the expo-linear-gradient import.

3. BadgeArt. Replace `Icon: LucideIcon` with `mark: number` (the require handle):

   interface BadgeArt { from: string; to: string; mark: number }

4. ART TABLE — new requires AND corrected hexes. Every light stop in the old table failed white-on-hue contrast (measured against #FFFFFF: #FFB25F 1.79:1, #7FC4FF 1.86:1, #FF9BC7 1.96:1, #5FD6C2 2.31:1, #5FA8FF 2.51:1, #9B8CFF 2.77:1 — none reached 3:1), and spark/ascent were two mid blues at nearly identical luminance, which is unreadable as a distinction at 15pt. New values all clear ~3:1 on the light stop, and ascent is moved to navy so it separates from spark by VALUE, not hue:

   const ART: Record<BadgeKind, BadgeArt> = {
     // First conversation — a struck spark.  (was #5FA8FF -> #2563EB)
     spark:  { from: '#4A90F5', to: '#2563EB', mark: require('../../../assets/badges/spark.png') },
     // Ten messages — curiosity (a lightbulb, not a brain).  (was #9B8CFF -> #6D46D9)
     brain:  { from: '#9457EE', to: '#5B21B6', mark: require('../../../assets/badges/brain.png') },
     // Fifty messages — going a long way.  (was #5FD6C2 -> #0E9F6E)
     rocket: { from: '#12A084', to: '#0A7350', mark: require('../../../assets/badges/rocket.png') },
     // A streak — the flame, tiered.  (was #FFB25F -> #DE6B12)
     flame:  { from: '#E2761A', to: '#B34E08', mark: require('../../../assets/badges/flame.png') },
     // A level gained.  (was #7FC4FF -> #1D6FD6; now navy, to part it from spark by value)
     ascent: { from: '#3A6FD8', to: '#16307A', mark: require('../../../assets/badges/ascent.png') },
     // DUYO's friend — the rarest.  (was #FF9BC7 -> #DB2777)
     heart:  { from: '#E85C97', to: '#C01860', mark: require('../../../assets/badges/heart.png') },
   };

5. THE GLYPH ELEMENT. Replace the <Icon .../> child with:

   <Image
     source={ART[kind].mark}
     style={{ width: glyph, height: glyph }}
     contentFit="contain"
   />

   Destructure `const { from, to, mark } = ART[kind];`. The react-native-web painting bug recorded in the file's comment does not apply — Image is a static sibling in the same position Icon occupied, not an absolutely-positioned child.

6. LOCKED STATE — no new assets, and drop the opacity step. The locked path is still just the gradient swap (start/end -> LOCKED_FROM/LOCKED_TO); the white mark needs no variant. The old `color={locked ? 'rgba(255,255,255,0.9)' : '#FFFFFF'}` disappears with the Icon; do NOT reintroduce it as tintColor. White on #C9D5E8 is 1.48:1 — the lowest-contrast pairing in the app — and shaving 10% off it made locked harder to read rather than merely quieter. Locked is already said three other ways on that row (pane glass(22,'sm',0.42), name INK -> MUTED #8CA3CB, a 16pt lucide Lock). Also deepen the locked palette so the mark holds:

   const LOCKED_FROM = '#A8B9D2';  // was '#C9D5E8'
   const LOCKED_TO   = '#7C93B8';  // was '#A7B8D2'; white on this is ~3.1:1

   Still blue-grey, not neutral — that property of the original palette is preserved. Locked appears at exactly one call site (achievements-screen.tsx:131, 46pt), so verify there.

7. TIER-2 RING — keep it in code, fix two numbers. Today `borderColor: end` draws the ring in the deeper of the same two hues, so at 17pt a 1.5px slightly-darker-orange edge on an orange disc is not a distinction at all, and streak_3 / streak_7 render identically in the same row (activity-screen.tsx:221). And because RN borders are inset, the ring eats the fill while `glyph` stays pinned to the outer size, so the tier-2 badges (streak_7, duyo_dust) lose almost all of the clear band the art was authored for. Two one-liners:

   borderColor: locked ? end : 'rgba(255,255,255,0.85)',
   const glyph = Math.round((size - 2 * ring) * 0.56);

   A white ring reads against all six saturated hues and echoes the mark instead of adding a fourth colour; computing the glyph off the inner diameter restores tier 2 to tier 1's proportions. `ring = tier === 2 ? Math.max(1.5, size * 0.07) : 0` is unchanged. Do not bake a ring into any asset: RN draws borders inside the box, so a painted rim and the live border would overlap and mud each other, and baking it would force 7 assets keyed by achievement key, changing BADGE_FOR's shape and desyncing the two flame tiers on any future regeneration.

8. HEADER COMMENT. The block at lines 12-36 explains why the glyphs are lucide ("hand-authored SVG paths first... the flame read as a droplet, the rocket read as a map pin, the brain read as two blobs"). Rewrite it: the marks are now authored raster silhouettes designed against exactly those three failures (the flame's tip hooks right so it cannot be a droplet; the rocket's sides are parallel and its widest point is its base so it cannot be a map pin; the brain is gone — curious now wears a lightbulb, whose meaning lives in its profile rather than in interior line work the style forbids). Keep the "why six icons cover seven achievements" section as is.

9. NAMING, DELIBERATELY UNCHANGED. BadgeKind keeps 'brain' even though the art is now a lightbulb. Renaming it to 'idea' is a 3-line edit (union member, ART key, BADGE_FOR value) but it is cosmetic and the key is mirrored nowhere else; leave it, or do it as a separate commit. Add a one-line comment at the union member so the name stops lying silently.

10. OUT OF SCOPE BUT SURFACED BY THIS WORK. duyo-backend/src/duyo/gamification/achievements.py `_CATALOG` still carries an `emoji` field that now contradicts the art on five of seven keys (first_chat targets, streak_7 star, curious brain, level_up chart, duyo_dust a YELLOW heart against pink art). Those render at fontSize 26 in duyo-mobile/src/components/gamification/achievements-card.tsx on the home screen. Retire the emoji field on that card or align it — otherwise the home screen shows a contradicting icon set two screens away from the badges.

---

## Qanday tayyorlandi

Bu promptlar 15 ta agentli workflow natijasi: kod faktlari + rasm-model
tadqiqoti → uchta uslub nomzodi → hakam → oltita prompt → ikkita tanqidchi
(to'plam izchilligi va kichik o'lchamda o'qilishi) → yig'ish. Tanqidchilar
topgan va tuzatilgan muammolar:

- SUBJECT COLLISION FIXED (blocking). The brain cell had silently become a lightbulb while five siblings still argued against a brain, and the rocket prompt told the model 'must NOT read as a lightbulb' — naming its own sibling. All six now reason about the real six. Bulb and rocket are separated by one structural, mandatory rule stated in BOTH prompts: the bulb's widest point is at the TOP and its narrowest at the BOTTOM; the rocket's widest point is at the very BOTTOM. Inverted mass distributions never swap at small size.
- ONE CENTRING POLICY (blocking). The drafts had four incompatible ones (bounding box, centre of mass, nudge-up-and-left, balance-by-eye). All six now carry the same PLACEMENT paragraph word for word: bounding-box centre on disc centre, no offset, no rotation. Ascent's deliberate off-centre instruction and its gradient-steering sentence are gone — both were only satisfiable by breaking the frozen COMPOSITION line.
- ONE EDGE VOCABULARY (blocking). Terminal caps were 100 / 40 / 50 / 60 / unspecified px and corner treatment ranged from 'crisp right angle' to 'softly rounded 100px caps' — against a SET RULES line demanding identical stroke weight and identical corner treatment. All six now carry the same FAMILY EDGE RULES paragraph: every terminal a 90px rounded cap, every straight-edge corner a 16px radius, no limb or gap under 100px, zero interior counters. Every number now clears the frozen 82px limb floor and 30px absolute floor, so no per-badge block argues with the house block any more.
- EVERY MARK DIMENSIONED IN PIXELS (blocking). Heart was the only badge specified purely in fractions and would not have landed at the family's weight. All six now give explicit px on the 1024 canvas, and every bounding-box corner was checked against the 15% clear band (max 358px from centre). Two deliberate, stated optical corrections: ascent is a 500px square rather than 573 (it is the only mark that fills its own box corners — 573 would leave a 10.4% band), and heart is 540x486 rather than 573 wide (a solid heart at full box width carried ~1.85x the white of the lightest mark). Both are explained inside the prompt so they read as decisions, not drift.
- PALETTE REPLACED FOR CONTRAST AND SEPARATION (blocking). Not one of the six light stops cleared 3:1 against white (worst: #FFB25F at 1.79:1, and the flame and heart put their most identifying mass right on it). New stops measured: #4A90F5 3.18:1, #E2761A 3.07:1, #9457EE 4.32:1, #3A6FD8 4.72:1, #12A084 3.29:1, #E85C97 3.27:1. Ascent moves from mid-blue to navy so it parts from spark by VALUE — at 15pt hue alone cannot separate two blues. These are one-line edits to the ART table, which is exactly why the disc was kept in code; the old hexes are listed in engineeringNotes.
- FLAME TIERS MADE VISIBLE WITHOUT SPLITTING THE ART (blocking). streak_3 and streak_7 were identical at every size under 20pt because the ring was drawn in the deeper of the same two hues. Rather than give the two tiers different discs (which would have needed a seventh asset or a tier-aware colour lookup, and two generations that drift apart with no seed), the fix is borderColor: 'rgba(255,255,255,0.85)' plus glyph computed off the inner diameter. One drawing still serves both keys, and each flame/heart prompt now says explicitly: the ring is drawn by the app, never by the art.
- ROCKET PORTHOLE DELETED (important). It was the only interior counter in the family — 86px on canvas is under two device pixels at the real sizes, i.e. a grey smudge, and its own arithmetic left 80px walls, below the frozen 82px floor. Removing it also resolves the lexical collision with 'no ring, no second circle' in the CONSTRAINTS block, and makes all six marks pure silhouettes with zero counters. The rocket's fin span and tube width were re-derived so 'widest point at the very bottom' is actually delivered (410 wide over a 210 tube, 100px of flare per side).
- STAIRCASE RISERS DEEPENED (important). The draft's 573x458 box gave 150px risers that the draft itself admitted would fuse into a ramp. It is now a 500px square with 167px treads and risers — one third each — and the acceptance test makes a smoothed top edge a rejection rather than a tolerance.
- FLAME'S LOWER-LEFT LOBE REMOVED, HOOK EXAGGERATED (important). The lobe was ~2 device px at 3x and gone at 2x, so it spent the detail budget on a feature that cannot survive. The rightward hook is now specified as at least 130px off the centre line with a concave right flank — a property of the whole silhouette, which is the only cue that survives a 30:1 downscale and the only thing separating it from the droplet this component already shipped once.
- HEART NOTCH ENLARGED (important). From ~25% x 20% to 30% x 25% of the mark (162px x 121px), and labelled in the prompt as the budget item, because it is the single feature parting the heart from the flame and a token dimple vanishes below 24px.
- SPARK RE-CUT AND RE-WORDED (important). The draft's shallow 145px waist plus 100px flat caps produced four lobes on a lump — a gem, not a star. Waist is now 100px from centre with arms that taper to their caps. 'Twinkle/sparkle' vocabulary is removed from the subject line because the same prompt bans sparkle particles; the prompt now says four-pointed star and forbids reading spark as licence for effects. Residual risk kept and flagged in whyUz: a star can still read as 'favourite/top', which is awkward for the badge nearly every child wears.
- BULB KEPT SOLID, NO RAYS (important, and a deliberate refusal). One critique asked for two flanking rays to stop the bulb reading as an egg; the frozen FORM block forbids separate floating pieces outright, and the house block is inviolable. Instead the pinch was made severe (460px crown to a 190px neck, 41%) with two decisive shoulder corners and a flat base, and the acceptance test names 'egg' and 'balloon' as rejections with the instruction to narrow the neck rather than add detail. If it still fails on device, the honest next move is a different subject, not a rule violation.
- 16px ADDED TO EVERY ACCEPTANCE TEST (blocking). Every draft did its arithmetic at 17pt/3x and skipped the real worst case: size={15} at goal-mates-section.tsx:81 on a 2x screen, which is a 16 device-px mark. All six prompts now require the silhouette test at 24px AND 16px, and each names the specific pair it must not collide with.
- SECTION SKELETONS UNIFIED (minor). Six different heading vocabularies became one: SUBJECT / SUBJECT DETAIL / PROPORTIONS / PLACEMENT / FAMILY EDGE RULES / NOT THIS / ACCEPTANCE TEST. Ascent's meta-sentence subordinating its own overrides to the house block is gone, and the silhouette threshold is stated identically everywhere.
- HOUSE BLOCK UNTOUCHED. All nine sections (USE, CANVAS, COMPOSITION, FORM, STYLE, MATERIAL AND LIGHT, COLOR, SET RULES, CONSTRAINTS) are byte-identical across all six fullPrompts. The only line that varies is the SUBJECT line the block itself designates as variable, which is filled with each badge's own subject sentence, identical to the one opening its per-badge block.
- PIPELINE INSTRUCTION MOVED OUT OF THE PROMPTS (important). Only the brain draft carried the trim-and-pad-to-square step, which would have produced six different rendered scales. It is a human/export step, not an instruction to an image model, so it is stated once, uniformly, in usageNotes — including the trap it prevents: leave padding in the PNG and the component's 0.56 is applied twice, landing every badge at ~31% of its disc.
- ENGINEERING SCOPE PINNED. The disc stays in code exactly as the engineering decision states — generate the full badge to judge it, ship the extracted white mark. engineeringNotes gives the concrete badge.tsx diff: expo-image Image in place of the lucide glyph, mark: require(...) in BadgeArt, the new hexes, no grey assets, the locked opacity step dropped and the locked palette deepened to ~3.1:1, borderColor switched to white, glyph computed off the inner diameter, and the stale header comment rewritten. Backend _CATALOG emoji are flagged as the one remaining contradicting icon set.
