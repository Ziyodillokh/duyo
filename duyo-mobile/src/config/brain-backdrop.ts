/**
 * Miya ekranining orqa foni — BU YERDAGI `source` NI O'ZGARTIRING.
 *
 * Fonni almashtirish uchun boshqa hech qayerga tegish shart emas: shu bitta
 * qatorga yangi faylni qo'ying va ilovani qayta yuklang.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NEGA FON ILOVA ICHIDA, INTERNETDAN EMAS
 * ─────────────────────────────────────────────────────────────────────────
 * Ilgari bu yerda Pinterest CDN havolasi turardi. Ikkita muammosi bor edi.
 *
 * Birinchisi — maxfiylik: Miya ekranini ochgan HAR BIR bolaning telefoni
 * Pinterest serveriga so'rov yuborardi, ya'ni IP manzili va vaqti begona
 * kompaniyaga borardi. Maxfiylik siyosatimiz esa ma'lumot faqat ikkita
 * xizmatga (Google va Eskiz) borishini aytadi, ya'ni bu yozilganiga zid edi.
 *
 * Ikkinchisi — mualliflik huquqi: u boshqa odamning pini edi, litsenziyasiz.
 *
 * Endi fon ilova ichida va o'zimiz yasaganmiz. Internetga so'rov yo'q,
 * litsenziya masalasi yo'q, va internetsiz ham ishlaydi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ALMASHTIRMOQCHI BO'LSANGIZ
 * ─────────────────────────────────────────────────────────────────────────
 * Faylni `assets/images/` ga tashlang va shunday yozing:
 *
 *     source: require('../../assets/images/yangi-fon.jpg'),
 *     kind: 'image',
 *
 * Video ham bo'ladi (`.mp4`), faqat `kind` ni `'video'` qiling. Tashqi havola
 * ham ishlaydi — lekin qo'ymang: har bir bola o'sha serverga ko'rinib qoladi
 * va uni maxfiylik siyosatiga yozish kerak bo'ladi.
 *
 * O'chirish uchun `source` ni `null` qiling — ekran tekis `#070B1A` foniga
 * qaytadi.
 */

export interface BrainBackdropConfig {
  /** `require(...)` bilan lokal fayl, tashqi havola, yoki `null`. */
  source: string | number | null;
  /**
   * Fayl rasmmi yoki videomi.
   *
   * Ataylab aniq yozilgan. Ilgari komponent buni o'zi taxmin qilardi —
   * `require()` son qaytaradi, va har qanday son video deb hisoblanardi —
   * ya'ni lokal RASM qo'yish mumkin emas edi.
   */
  kind: 'image' | 'video';
  /**
   * Fon qanchalik ko'rinsin. 0 = ko'rinmaydi, 1 = to'liq.
   *
   * Nega 1 emas: ustidagi yulduzlar, sayyoralar va oq matn o'qilishi kerak.
   */
  opacity: number;
  /**
   * Fonning ustiga DUYO'ning binafsha-navy gradienti tushsinmi.
   *
   * Yoqilgan holda istalgan fon DUYO ranglariga bo'yaladi — ya'ni fonni
   * almashtirsangiz ham ilova o'z qiyofasini yo'qotmaydi.
   */
  tint: boolean;
}

export const BRAIN_BACKDROP: BrainBackdropConfig = {
  // O'zimiz yasagan spiral galaktika — 1200x2140, ~96 KB, `#070B1A` asosida,
  // ya'ni ostidagi tekis fon bilan bir xil rangda boshlanadi.
  //
  // Buning oldida tekis yulduzli osmon turardi, va u 0.32 shaffoflikda
  // amalda ko'rinmasdi — ekran fonsizdek tuyulardi. Endi rasmning o'zida
  // tuzilish bor: galaktika yuqorida, pastda esa quyuq tuman va yulduzlar.
  source: require('../../assets/images/brain-backdrop.jpg'),
  kind: 'image',
  // 0.55 ga qaytarildi. 0.32 tekis osmon uchun tanlangan edi; bu rasmda
  // yorug'lik yuqori uchdan birga jamlangan va vinyetka chetlarini fon
  // rangiga qaytaradi, ya'ni sayyoralar turadigan pastki qism baribir
  // quyuq qoladi va ular o'qilaveradi.
  opacity: 0.55,
  tint: true,
};
