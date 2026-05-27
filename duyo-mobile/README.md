# DUYO Mobile

React Native (iOS + Android) mobile app for DUYO AI Companion.

## Hozir nima qilingan

Faqat skeleton va struktura tavsiyasi. **Haqiqiy React Native loyiha hali init qilinmagan** — chunki RN CLI to'liq generatsiya yaratadi va uni faqat sizning machine'ingizda qilish optimal.

## Init qilish (siz qilishingiz kerak)

```bash
cd /Users/raxmonjon/DUYO/duyo-mobile

# React Native v0.74+ project init (Expo emas, bare RN)
npx @react-native-community/cli@latest init DuyoApp \
  --template react-native-template-typescript \
  --directory .

# Yoki Expo bilan (oddiyroq, lekin native module'larda chegaralar)
# npx create-expo-app . --template blank-typescript
```

## Tavsiya etilgan struktura (TZ §7.1)

Init qilingandan keyin `src/` papka ichida:

```
src/
├── api/              # API client (axios + react-query)
│   ├── client.ts
│   └── endpoints/
├── assets/           # Images, fonts, animations (Lottie JSON)
├── components/
│   ├── atoms/        # Button, Input, Text, Icon
│   ├── molecules/    # Card, ListItem, FormField
│   └── organisms/    # ChatBubble, AvatarViewer, TamagochiStateBar
├── screens/
│   ├── onboarding/   # 8 ekran (TZ §4.2)
│   ├── chat/         # Real-time suhbat
│   ├── avatar/       # 3D customization
│   ├── content/      # She'r, ertak katalog
│   ├── gamification/ # Level, inventory, achievements
│   └── settings/
├── navigation/       # React Navigation v6 config
├── store/            # Zustand stores (auth, avatar, tamagochi, chat)
├── hooks/            # Custom React hooks
├── utils/            # Helpers, validators, formatters
├── services/         # Auth, push (FCM), analytics, voice
├── locales/          # i18next bundles: uz, ru, en
└── types/            # TypeScript shared types
```

## Asosiy bog'liqliklar (TZ §3.2)

```bash
# State & data
npm install zustand @tanstack/react-query axios

# Navigation
npm install @react-navigation/native @react-navigation/native-stack \
            react-native-screens react-native-safe-area-context

# 3D Avatar (TZ §7.3)
npm install three @react-three/fiber @react-three/drei

# Animations
npm install react-native-reanimated lottie-react-native

# Storage (encrypted)
npm install react-native-mmkv

# i18n
npm install i18next react-i18next

# Audio
npm install react-native-track-player

# Voice (STT/TTS)
npm install @react-native-voice/voice

# WebSocket
npm install socket.io-client
```

## Build & test

```bash
# iOS (CocoaPods kerak)
cd ios && pod install && cd ..
npm run ios

# Android
npm run android

# Tests
npm test                # Jest unit tests
npm run e2e:ios         # Detox E2E
```

## Performance maqsadlari (TZ §13.1)

- App startup: < 3 sek (Splash → Home)
- Avatar rendering: 60 fps (16ms frame budget)
- Chat scripted response: < 150ms P95
- App memory: < 200 MB

## Birinchi ekran (Sprint 1-2 priority)

1. **Splash** (1 sek logo)
2. **Onboarding 8-step flow** — bu MVP'ning eng katta birinchi qismi
3. **Avatar customization** — 3D React Three Fiber
4. **Home screen** — DUYO avatari markazda
5. **Chat** — WebSocket + AI response

## Hujjatlar

- [TZ §7 Mobile spec](../duyo-docs/) — to'liq frontend talablar
- [TZ §4.2 Onboarding flow](../duyo-docs/) — 8 ekran ketma-ketligi
- [TZ §7.3 3D Avatar](../duyo-docs/) — implementation detallari
