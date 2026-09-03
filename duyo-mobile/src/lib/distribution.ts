/**
 * Which channel this build shipped through.
 *
 * Play's Device and Network Abuse policy forbids an app updating itself by
 * any route other than Play, so the store build must not even ask whether a
 * newer APK exists. The APK on duyo.uz has no store behind it and still needs
 * the check — so 'play' is the exception the release job sets
 * (EXPO_PUBLIC_DISTRIBUTION=play), and everything else keeps the sideload
 * behaviour, including a missing flag.
 *
 * EXPO_PUBLIC_* is inlined at bundle time, so this is a literal in the
 * shipped JS and the update path is dropped from the store build entirely.
 */
export const IS_PLAY_BUILD = process.env.EXPO_PUBLIC_DISTRIBUTION === 'play';
