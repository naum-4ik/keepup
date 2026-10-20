// lib/ios-splash.ts
// The installed iPhone app's launch screen (apple-touch-startup-image): iOS shows a white screen on a cold
// start unless a picture matches the phone's exact screen in points and pixel ratio. One portrait picture
// per screen size (the manifest locks portrait): cream with the app tile, drawn by scripts/gen-ios-splash.mjs
// from lib/ios-splash.json (add a row there for a new iPhone size and run the script). A phone with no row
// keeps the white screen; nothing breaks. Android builds its own from the manifest.
import screens from "./ios-splash.json";

export type SplashScreen = { width: number; height: number; ratio: number };

export const splashFile = ({ width, height, ratio }: SplashScreen) => `/splash/iphone-${width * ratio}x${height * ratio}.png`;

export const splashMedia = ({ width, height, ratio }: SplashScreen) =>
  `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`;

export const iosStartupImages = () => screens.map((s) => ({ url: splashFile(s), media: splashMedia(s) }));
