Create a complete high-fidelity UI/UX design system and full product interface for “DUYO — AI Companion for Children”.

Product overview:
DUYO is a mobile app for children aged 7–16. It is an AI virtual companion that works as a friendly conversation partner, tutor, emotional support assistant, and tamagotchi-style character. The product works in Uzbek, Russian, and English. It includes adaptive AI responses based on the child’s age segment, DUYO avatar customization, gamification, content library, parent monitoring, subscription, payments, crisis detection, and admin management.

Important:
Do NOT create only an MVP. Design the complete product based on the full technical specification. Include all major product areas, screens, user flows, states, and dashboards.

Target users:
1. Child Junior mode: age 7–10
   - More visual and audio-based
   - Large buttons
   - Simple vocabulary
   - Colorful, friendly UI
   - Stronger tamagotchi feeling

2. Child Explorer mode: age 11–13
   - Balanced visual + text UI
   - School help, missions, language games
   - Gamification, level, streak, inventory
   - This should be the central design style

3. Child Companion mode: age 14–16
   - More mature and study-coach-like
   - Less childish, fewer emojis
   - DTM, IELTS/TOEFL, career guidance, focus, emotional support
   - Cleaner and more professional visual tone

4. Parent
   - Receives SMS reports and opens a web dashboard
   - Sees aggregated activity, mood trend, learning progress, safety status
   - Does NOT see full private chat text unless there is a serious safety protocol

5. Admin / Safety Officer / Content Manager
   - Admin web panel for content, users, analytics, crisis events, subscriptions, payments, notifications, AI prompt settings, and safety review

Overall visual direction:
Create a “Soft Cosmic Companion UI” style:
- Friendly, safe, intelligent, warm, modern
- Uzbek cultural warmth + futuristic AI companion feeling
- Not too childish, not too corporate
- Rounded shapes, soft cards, calm gradients
- Primary color: bright but trustworthy blue
- Accent color: warm yellow/star accent
- Background: very light sky blue or soft cosmic gradient
- Text color: deep navy
- Red only for real alerts and crisis states
- Green for success and healthy progress
- Use large accessible tap targets
- Use calm animation cues
- Avoid addictive, manipulative, scary, dark, military, or overly childish design

Suggested color palette:
- Primary Blue: #1B70CF or #2563EB
- Deep Navy: #102033
- Star Yellow: #FFC700
- Soft Sky Background: #F4F8FF
- Success Green: #22C55E
- Warning Yellow: #FACC15
- Crisis Red: #EF4444
- Card White: #FFFFFF
- Muted Gray: #64748B

Typography:
- Rounded, modern, readable sans-serif
- Large headings for children
- Clear Uzbek labels
- Support Uzbek, Russian, and English text
- Use Uzbek language for the generated UI copy by default

App platforms:
- iOS and Android mobile app
- Mobile-first design
- Frame size: 390×844
- Also create responsive parent web dashboard and admin web panel screens

Core navigation:
Create a bottom navigation for the child app:
1. Home
2. Chat
3. Library
4. Profile
5. Inventory

Create a separate settings/subscription area accessible from Profile.

PART 1 — DESIGN SYSTEM

Create a complete design system for DUYO:
1. Colors
2. Typography
3. Buttons
4. Inputs
5. Cards
6. Chips
7. Chat bubbles
8. Avatar status indicators
9. Progress bars
10. Streak badges
11. Level badges
12. Content cards
13. Subscription plan cards
14. Safety status cards
15. Parent report cards
16. Admin dashboard cards
17. Empty states
18. Error states
19. Loading states
20. Offline states
21. Limit reached states
22. Crisis alert states

Component style:
- All elements should be rounded and friendly
- Cards should use subtle shadow
- Avoid aggressive gradients
- Use smooth spacing
- Make the interface accessible and calm

PART 2 — DUYO AVATAR UI

DUYO is a friendly robot mascot:
- Soft rounded robot body
- Big expressive LED-style eyes
- No nose
- Small warm smile
- Small antenna with star detail
- Uzbek blue body with white and yellow accents
- Should feel intelligent, safe, kind, and trustworthy

Avatar customization:
Create UI for:
1. Body shape selection:
   - Spherical
   - Cubic
   - Vertical

2. Primary color selection:
   - 12 colors

3. Accent color selection:
   - 8 colors

4. Face style selection:
   - 5 face styles

5. Accessories:
   - Hats
   - Glasses
   - Antennas
   - Backgrounds
   - Seasonal items: Navro‘z, New Year, Independence Day, Mehrjon

6. Avatar evolution by level:
   - Level 1: Tanish
   - Level 2: Do‘st
   - Level 3: Sirdosh
   - Level 4: Hamroh
   - Level 5: Hamfikr
   - Level 6: Yulduz

Avatar states:
Design visual states for:
- Idle
- Talking
- Thinking
- Sleeping
- Happy
- Sad but gentle
- Low energy
- Reading
- Celebrating
- Encouraging
- Crisis support mode, but calm and not alarming

PART 3 — CHILD MOBILE APP SCREENS

Create high-fidelity mobile screens for the full child app.

1. Splash screen
- DUYO logo
- Soft cosmic background
- Loading indicator
- Friendly first impression

2. Language selection
- O‘zbek
- Русский
- English
- Large flag or language cards
- Clear title: “Tilni tanlang”

3. User type selection
- “Men bola”
- “Men ota-ona”
- Friendly DUYO greeting

4. Phone authentication
- Phone number input
- SMS code screen
- Resend code timer
- Loading state
- Error state

5. Child name input
- “Isming nima?”
- Friendly DUYO illustration
- Input field
- Continue button

6. Age selection
- Selector from 7 to 16
- Show automatic segment label:
  - 7–10 Junior
  - 11–13 Explorer
  - 14–16 Companion

7. Adaptive interests selection
Show different interest chips depending on age:

For 7–10:
- Rasm chizish
- Hayvonlar
- Ertaklar
- Kosmos
- Super qahramonlar
- O‘yinlar
- Musiqa
- Tabiat

For 11–13:
- Sport
- Kitob
- Fan
- Ijod
- Do‘stlar
- Musiqa
- O‘yinlar
- Kosmos
- Til o‘rganish

For 14–16:
- Kasb tanlash
- Kitob
- Musiqa
- Dizayn
- Kod yozish
- Ingliz tili
- DTM
- IELTS
- Ijodiyot

8. DUYO avatar builder onboarding
- Large DUYO preview in center
- Tabs:
  - Tana
  - Rang
  - Aksent
  - Yuz
- Real-time preview
- “Mening DUYO’im tayyor” button

9. First conversation screen
- DUYO introduces itself
- Message: “Salom! Men DUYO. Endi birga o‘rganamiz, suhbatlashamiz va o‘samiz.”
- Suggested replies:
  - “Boshlaymiz”
  - “Menga she’r o‘qib ber”
  - “Bugungi missiyani ko‘rsat”
  - “Men bilan gaplash”

10. Parent connection screen
- QR code option
- SMS link option
- Explanation:
  - “Xavfsizlik uchun ota-onangizni ulash tavsiya etiladi”
- Skip option for older Companion users, but not visually dominant
- Trust-focused design

11. Home screen
This is the main screen.
Elements:
- Greeting: “Salom, Aziza!”
- DUYO avatar large in center
- Current DUYO emotion
- Four tamagotchi status indicators:
  - Energiya
  - O‘rganish
  - Quvonch
  - Sog‘liq
- Indicators should be visual and soft:
  - Energy: eye brightness
  - Learning: antenna glow
  - Joy: smile
  - Health: body color brightness
- Today’s mission card
- XP/level card
- Streak card
- Quick actions:
  - “DUYO bilan gaplashish”
  - “Bugungi missiya”
  - “She’r o‘qish”
  - “Dars yordami”
- Bottom navigation

12. Junior Home variant
- More colorful
- Larger buttons
- More illustrations
- Less text
- More audio buttons

13. Explorer Home variant
- Balanced mission + chat + learning
- This should be the default complete UI

14. Companion Home variant
- Less childish
- Cleaner cards
- Focus widgets:
  - DTM tayyorgarlik
  - IELTS practice
  - Bugungi maqsad
  - Focus timer
  - Emotional check-in

15. Chat screen
Elements:
- DUYO avatar small at top
- Current emotion indicator
- Chat bubbles:
  - Child messages on right
  - DUYO messages on left
- Text input
- Voice input button
- Send button
- Typing state: “DUYO o‘ylayapti…”
- AI daily limit indicator:
  - “Bugun 18/30 suhbat qoldi”
- Message types:
  - Text
  - Audio reply
  - Mission card
  - Quiz card
  - Poem practice card
  - Lesson explanation card
- Safety-aware calm design

16. Voice chat screen
- Large DUYO avatar
- Microphone button
- Waveform animation
- Listening state
- Speaking state
- “To‘xtatish” button
- Transcript preview
- Premium badge if needed

17. Conversation history screen
- List of previous conversations
- Date grouping
- Search
- Privacy note:
  - “Suhbatlaringiz maxfiy saqlanadi”

18. Library screen
Sections:
- She’rlar
- Ertaklar
- Dars yordami
- Til o‘yinlari
- DTM / IELTS
- Recommended for age
- Continue learning
- Search and filter by age, language, topic
- Content cards with audio icon, difficulty, duration, XP reward

19. Poem detail screen
- Poem title
- Author
- Age tag
- Language tag
- Text with readable typography
- “DUYO o‘qib bersin”
- “Men o‘qiyman”
- Audio player
- Practice button
- XP reward

20. Poem recitation / reading practice screen
- Lyrics text
- Recording button
- DUYO listens
- Speech feedback:
  - To‘g‘ri o‘qildi
  - Mashq qilish kerak bo‘lgan so‘zlar
  - XP earned
- Calm positive feedback only

21. Story detail screen
- Story cover
- Audio player
- Interactive buttons:
  - “Davom etish”
  - “Savol berish”
  - “Tushundim”
- DUYO discussion card

22. Lesson help screen
- Subject cards:
  - Matematika
  - Ona tili
  - Ingliz tili
  - Geografiya
  - Fizika
  - Kimyo
  - Tarix
- Age-appropriate layout
- “Savol berish” CTA

23. DTM / IELTS practice screen
For Companion mode:
- Subject selection
- Practice questions
- Timer
- Score
- Explanation by DUYO
- Progress chart
- Serious but friendly design

24. Daily mission screen
- Mission cards:
  - “5 daqiqa inglizcha gaplash”
  - “Bitta she’r o‘qi”
  - “Matematika savolini yech”
  - “10 daqiqa dam ol”
- XP reward
- Completion state
- Celebration animation

25. Gamification / Profile screen
Elements:
- Child avatar/profile
- DUYO level
- XP progress
- Current level title:
  - Tanish
  - Do‘st
  - Sirdosh
  - Hamroh
  - Hamfikr
  - Yulduz
- Streak calendar
- Achievements
- Badges
- Weekly activity
- Recent rewards

26. Streak screen
- 3, 7, 14, 30, 100, 365 day milestones
- Soft Duolingo-like motivation but no guilt
- If streak is broken, use gentle copy:
  - “Hechqisi yo‘q, yana boshlaymiz!”

27. Inventory screen
- Avatar accessories shop
- Owned items
- Locked items
- Seasonal collections
- Ball balance
- Item detail bottom sheet
- Purchase confirmation
- Not enough points state

28. Avatar customization screen
- Full DUYO preview
- Tabs:
  - Tana
  - Rang
  - Aksent
  - Yuz
  - Aksessuar
  - Fon
- Save button
- Reset button
- Preview animations

29. Settings screen
- Language
- Notifications
- Voice settings
- Privacy
- Parent connection
- Subscription
- Help
- Logout

30. Subscription screen
Create clear tier comparison:
- Tanish / Free
  - 1 language
  - scripted only
  - 20 minutes/day
  - limited content

- Do‘st / Standard
  - 29,000 so‘m/month
  - 290,000 so‘m/year
  - 3 languages
  - AI 30 turns/day
  - full gamification
  - all regular content

- Hamroh / Premium
  - 59,000 so‘m/month
  - 590,000 so‘m/year
  - unlimited AI
  - voice chat
  - 2 children
  - premium content
  - priority support

Include:
- Free trial 7 days
- Monthly/yearly toggle
- Payment methods:
  - Click
  - Payme
  - Uzcard
  - Humo
  - Visa/Mastercard

31. Payment screen
- Payment method selection
- Plan summary
- Auto-renewal explanation
- Cancel anytime note
- Success state
- Failed payment state

32. Offline mode screen
- DUYO sleeping/offline illustration
- Message:
  - “Internet yo‘q. Qayta ulanganingizda davom etamiz.”
- Cached content available
- Crisis detection requires internet note, but write it softly

33. Daily summary screen
- Today’s XP
- Completed missions
- Learning time
- Streak
- DUYO mood
- Tomorrow suggestion
- Calm bedtime design

34. App locked / night mode screen
- 22:00–06:00 DUYO sleeps
- Sleeping DUYO avatar
- Message:
  - “Men ham dam olyapman. Ertaga davom etamiz.”
- Emergency parent unlock option only

35. Error and empty states
Create UI for:
- No internet
- AI service unavailable
- Daily limit reached
- No content found
- Payment failed
- Parent not connected
- Loading content
- Voice permission denied

PART 4 — CRISIS DETECTION UI

Design crisis and safety flows carefully. These screens must be calm, not scary.

1. Soft emotional support state
- DUYO detects sadness or stress
- DUYO responds gently
- No red color unless serious

2. Yellow risk state
- No visible panic
- DUYO suggests rest, talking to trusted adult, breathing exercise

3. Orange risk state
- Calm safety card
- DUYO suggests trusted adult and help resources
- Parent notification scheduled based on protocol

4. Red risk state
- Serious but calm UI
- DUYO says it must help the child reach a real adult
- Show buttons:
  - “Ota-onamga ayt”
  - “Ishonchli kattaga aytish”
  - “Yordam raqamini ko‘rsat”
- Include emergency/help card area
- Do not use scary icons
- Do not show alarming animations

5. Abuse victim protocol UI
- Do NOT automatically show parent alert visually
- Show trusted adult options
- Safety team internal flag design for admin side

6. Parent crisis alert web screen
- Serious and clear
- Safety status
- What parent should do now
- Call child button
- Help resources
- No full chat transcript by default

PART 5 — PARENT WEB DASHBOARD

Create a responsive parent web dashboard opened from SMS link.

Style:
- Calm, professional, trustworthy
- White and blue cards
- Small DUYO mascot
- Not childish
- Mobile web friendly

Screens:

1. Parent login / PIN screen
- Open report with PIN
- Phone verification option

2. 10-day report dashboard
Sections:
- Child activity level
- Total usage days
- Average daily time
- Learning progress
- Mood trend
- Topics discussed:
  - Maktab
  - Do‘stlar
  - Hobbi
  - O‘rganish
- Stress indicators if any
- Safety status
- Subscription status

Important privacy rule:
Do NOT show full chat text to parent.
Show only aggregated summaries, except crisis protocol.

3. Parent settings screen
- Alert preferences
- Report frequency
- Connected child
- Subscription
- Language
- Privacy explanation

4. Parent alert screen
- ORANGE alert
- RED alert
- Clear recommended actions
- “Farzandimga qo‘ng‘iroq qilish”
- “Yordam raqamini ko‘rish”
- “Safety report’ni ochish”

PART 6 — ADMIN WEB PANEL

Create a complete admin dashboard for DUYO.

Admin users:
- Admin
- Safety Officer
- Content Manager
- Support

Style:
- Professional SaaS admin panel
- Clean sidebar
- Cards, tables, filters, search
- Blue primary color
- Red only for critical crisis events
- Responsive desktop layout

Admin sidebar:
1. Dashboard
2. Users
3. Children Profiles
4. Conversations
5. Crisis Events
6. Safety Review
7. Content Library
8. Poems
9. Stories
10. Lessons
11. AI Prompts
12. Intent Responses
13. Gamification
14. Inventory
15. Subscriptions
16. Payments
17. Parent Reports
18. Notifications
19. Analytics
20. Settings

Admin screens:

1. Admin dashboard
Cards:
- DAU
- MAU
- Active children
- Active parents
- AI messages today
- Crisis events by level
- Conversion free → paid
- Revenue
- AI cost per user
- Error rate
- Latency

2. User management
- Table with users
- Role
- Status
- Age segment
- Subscription
- Last active
- Search and filters
- Detail page

3. Child profile detail
- Profile
- Age segment
- Language
- Interests
- DUYO avatar
- Activity
- Learning progress
- Safety status
- Parent linked

4. Conversation monitoring
- Privacy-respecting design
- Admin sees only allowed logs
- Safety team can access flagged content
- Filters by risk level, language, age segment

5. Crisis events dashboard
Critical screen.
Include:
- RED / ORANGE / YELLOW counters
- Event table
- Child age segment
- Category:
  - suicidal
  - self-harm
  - violence
  - abuse
  - severe distress
- Classifier score
- Parent notified
- Safety officer reviewed
- Resolution
- Time since event
- P0 alert style for RED

6. Crisis event detail
- Timeline
- Matched keywords
- AI assessment
- Classifier score
- Parent notification status
- Safety officer notes
- Resolution buttons:
  - False positive
  - Confirmed risk
  - Escalated
  - Resolved
- Audit log
- Access log

7. Content library admin
- Poems table
- Stories table
- Lessons table
- Language
- Age segment
- Audio status
- License status
- Publish status
- Add/edit content form

8. Poem editor
- Title
- Author
- Language
- Age segment
- Text
- Audio file
- Tags
- License info
- Publish/unpublish

9. Story editor
- Title
- Age
- Language
- Audio
- Interactive questions
- DUYO discussion prompts

10. AI prompt management
- Prompt templates
- Age segment
- Language
- Versioning
- Test prompt area
- Rollback button

11. Intent responses management
- Intent name
- Age segment
- Language
- Response variants
- Status
- Add/edit/delete

12. Gamification admin
- XP rules
- Level thresholds
- Streak milestones
- Achievements
- Reward configuration

13. Inventory admin
- Accessories
- Hats
- Glasses
- Antennas
- Backgrounds
- Seasonal items
- Price in points
- Availability

14. Subscription admin
- Plans
- Prices
- Trial
- Active subscriptions
- Cancellations
- Churn
- Plan editor

15. Payments dashboard
- Click
- Payme
- Uzcard
- Humo
- Visa/Mastercard
- Payment status
- Failed payments
- Refunds
- Webhook logs

16. Notification admin
- Push notifications
- SMS templates
- Parent report templates
- Crisis alert templates
- Scheduled notifications

17. Analytics dashboard
Charts:
- Retention D1/D7/D30
- AI message volume
- Voice usage
- Content completion
- Subscription conversion
- Churn
- Crisis events trend
- Age segment usage
- Language distribution

18. System health dashboard
- Service uptime
- Error rate
- P95 latency
- AI provider status
- SMS provider status
- Payment provider status
- WebSocket connections

PART 7 — UX FLOWS TO VISUALIZE

Create visual user flow diagrams or connected prototype screens for:

1. Child onboarding flow:
Language → User type → Phone auth → Name → Age → Interests → Avatar → First chat → Parent connection → Home

2. Daily child flow:
Morning check-in → School muted mode → After school chat → Lesson help → Poem/story → Daily summary → Night sleep mode

3. Chat flow:
Message → Crisis pre-check → Scripted/AI response → Response filter → DUYO reply → XP update → Tamagochi update

4. Avatar customization flow:
Choose body → Choose color → Choose face → Add accessory → Preview → Save

5. Subscription flow:
Plan comparison → Select plan → Payment method → Payment processing → Success → Unlock premium

6. Parent report flow:
SMS link → PIN verification → 10-day dashboard → Safety status → Settings

7. Crisis flow:
Child message → Risk detection → Yellow/Orange/Red classification → DUYO response → Parent alert / safety review → Audit log

8. Admin safety flow:
Crisis event → Safety officer review → Resolution → Model feedback → Audit trail

PART 8 — COPYWRITING REQUIREMENTS

Use Uzbek labels by default.

Tone:
- Warm
- Safe
- Encouraging
- Never guilt-based
- Never manipulative
- Never makes child feel responsible for DUYO’s suffering

Correct examples:
- “Birga matematika qilamizmi?”
- “Hechqisi yo‘q, yana boshlaymiz.”
- “Men biroz dam olayapman, sen ham dam ol.”
- “Bugun kichik qadam ham katta yutuq.”

Avoid:
- “Sen kelmaganing uchun men xafa bo‘ldim.”
- “Meni unutding.”
- “Men kasal bo‘lib qoldim.”
- “Sen qilmasang, men yomon bo‘laman.”

PART 9 — ACCESSIBILITY AND SAFETY

Design requirements:
- Large tap targets
- Clear contrast
- No tiny text for children
- No flashing animations
- No dark scary crisis UI
- No endless-scroll addictive feed
- No manipulative streak loss screen
- Red color reserved only for real safety alerts
- Parent privacy contract must be visually clear
- Child privacy must be respected
- Offline state must be clear
- Voice permissions must be explained gently

PART 10 — FINAL OUTPUT EXPECTATION

Generate a complete product UI concept with:
1. Design system
2. Mobile app screens
3. Parent web dashboard
4. Admin web panel
5. Age-adaptive UI variants
6. DUYO avatar visual direction
7. Core user flows
8. Safety and crisis screens
9. Subscription and payment screens
10. Empty/loading/error/offline states

Make the design polished, production-ready, consistent, and suitable for a serious child-focused AI product in Uzbekistan.