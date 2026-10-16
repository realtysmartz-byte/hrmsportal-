# Realty Smartz HRMS — Android App

Native Android wrapper around https://rshrms.in with Location permission.

## APK

Built release APK:

- `apps/mobile/dist/RealtySmartz-HRMS.apk`
- Also copied to Desktop as `RealtySmartz-HRMS.apk`

## Rebuild

```bash
cd apps/mobile
npm install
npx cap sync android
cd android
# set JAVA_HOME to Android Studio JBR
.\gradlew.bat assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`
