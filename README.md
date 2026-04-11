# OKR Coach

App React Native (Expo) para Android com dados locais (SQLite) e coach por IA opcional (chave OpenAI guardada no dispositivo).

## Requisitos

- Node.js LTS
- Conta Expo (apenas se usar EAS Build na nuvem)
- Android SDK / emulador ou aparelho com USB debugging (para build local)

## Desenvolvimento

```bash
npm install
npx expo start
```

Pressione `a` para abrir no Android (Emulador ou Expo Go).

## Repositório público — segurança

- Não commite `.env`, keystore (`.jks`, `.keystore`) nem chaves de API.
- A chave da OpenAI é armazenada com `expo-secure-store` ao salvar em **Ajustes** no app.

## APK para uso pessoal

### Opção A — EAS Build (nuvem)

1. `npm install -g eas-cli`
2. `eas login`
3. `eas build -p android --profile preview`

O perfil `preview` em `eas.json` gera **APK**. Incremente `android.versionCode` e `expo.version` em `app.json` a cada release instalável.

### Opção B — Gradle local

1. `npx expo prebuild -p android`
2. Configure assinatura release do Android (keystore **fora** do Git) em `android/app` conforme a [documentação do React Native](https://reactnative.dev/docs/signed-apk-android).
3. `cd android && ./gradlew assembleRelease` (Linux/macOS) ou `gradlew.bat assembleRelease` (Windows).

O APK fica em `android/app/build/outputs/apk/release/`.

## Versionamento Git

Use tags semânticas nos marcos (ex.: `v0.3.0`) alinhadas à versão em `app.json` / `package.json`:

```bash
git tag -a v1.0.0 -m "Release 1.0.0"
```

## Remote

```bash
git remote add origin https://github.com/edniltonmatos/OKR-Coach.git
git push -u origin main
```
