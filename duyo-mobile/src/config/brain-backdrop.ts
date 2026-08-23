/**
 * Miya ekranining orqa fonidagi video — BU YERDAGI `uri` NI O'ZGARTIRING.
 *
 * Fonni almashtirish uchun boshqa hech qayerga tegish shart emas: shu bitta
 * qatorga yangi havolani qo'ying va ilovani qayta yuklang.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MUHIM — Pinterest / YouTube / TikTok havolasi ISHLAMAYDI
 * ─────────────────────────────────────────────────────────────────────────
 * Ular `<iframe>` (veb-sahifa) qaytaradi, video fayl emas. React Native'da
 * iframe degan narsa yo'q — DOM yo'q, shuning uchun uni fon qilib bo'lmaydi.
 *
 * Bu yerga TO'G'RIDAN-TO'G'RI VIDEO FAYL manzili kerak — `.mp4` yoki `.m3u8`
 * bilan tugaydigan. Masalan:
 *
 *     https://example.com/kosmos.mp4          ✅ ishlaydi
 *     https://pinterest.com/pin/8784834...    ❌ ishlamaydi (sahifa)
 *     https://youtube.com/watch?v=...         ❌ ishlamaydi (sahifa)
 *
 * Pinterest'dagi videoni olish uchun: brauzerda pinni oching → sichqonchaning
 * o'ng tugmasi → "Save video as" yoki F12 → Network → `.mp4` faylni toping.
 * Keyin uni biror joyga (masalan o'z serveringizga) qo'yib, havolasini shu
 * yerga yozing.
 *
 * ESLATMA: boshqa birovning videosini ilovada ishlatish — huquqiy masala.
 * Sinov uchun bo'ladi, chiqarishdan oldin litsenziyasi tozasini qo'ying.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TELEFONDAGI FAYL (chiqarish uchun eng yaxshisi)
 * ─────────────────────────────────────────────────────────────────────────
 * Internetsiz ham ishlashi va tez ochilishi uchun videoni ilova ichiga
 * qo'ying: faylni `assets/` ga tashlang va shunday yozing:
 *
 *     uri: require('../../assets/miya-fon.mp4'),
 *
 * O'chirish uchun `uri` ni `null` qiling — ekran hozirgi ko'rinishiga qaytadi.
 */

export interface BrainBackdropConfig {
  /** `.mp4` / `.m3u8` havolasi, `require(...)` bilan lokal fayl, yoki `null`. */
  uri: string | number | null;
  /**
   * Video qanchalik ko'rinsin. 0 = ko'rinmaydi, 1 = to'liq.
   *
   * Nega 1 emas: ustidagi yulduzlar, sayyoralar va oq matn o'qilishi kerak.
   * Juda yorqin video ularni yutib yuboradi. 0.45–0.6 oralig'i eng qulay.
   */
  opacity: number;
  /**
   * Videoning ustiga DUYO'ning binafsha-navy gradienti tushsinmi.
   *
   * Yoqilgan holda istalgan video DUYO ranglariga bo'yaladi — ya'ni fonni
   * almashtirsangiz ham ilova o'z qiyofasini yo'qotmaydi.
   */
  tint: boolean;
}

export const BRAIN_BACKDROP: BrainBackdropConfig = {
  // Pinterest pin 1141944049318205566 (https://pin.it/4ndt6WxCo).
  //
  // Bu pin VIDEO EMAS — rasm (sahifada "videos":null). Komponent turini
  // kengaytmadan o'zi aniqlaydi, shuning uchun rasm ham, video ham shu bitta
  // qatorga qo'yilaveradi.
  //
  // Rasm bu yerda video'dan yaxshiroq: dekodlash xarajati nol, ya'ni arzon
  // Android telefonda osmon simulyatsiyasi bilan resurs talashmaydi. Nisbati
  // (1200x2140) ham telefon ekraniga tayyor.
  uri: 'https://i.pinimg.com/1200x/70/de/13/70de13c61a79162e976c131461ac7507.jpg',
  // 0.32, not the 0.55 this started at. The sayyoralar are shaded spheres
  // a few pixels across; a photographic nebula at over half strength behind
  // them has more contrast than they do, and the eye stops reading them as
  // lit balls at all. The fon is the room, not the subject. Raise it back if
  // you prefer the picture — bu bitta qator.
  opacity: 0.32,
  tint: true,

  // Boshqa variantlar, kerak bo'lsa:
  // Pinterest video (H.264 720p, 4.9 MB):
  // uri: 'https://v1-e.pinimg.com/videos/iht/720p/38/46/e0/3846e005edc5c1f778ba89746800384d.mp4',
  // NASA, Orion tumanligi, ochiq mulk (5 MB):
  // uri: 'https://images-assets.nasa.gov/video/JPL-20221122-SOLSYSf-0001-Orion%20Dust%20and%20Death/JPL-20221122-SOLSYSf-0001-Orion%20Dust%20and%20Death~mobile.mp4',
};
