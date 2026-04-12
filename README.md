# OKR Coach

App React Native (Expo) para Android com dados locais (SQLite) e coach por IA opcional (chave definida no `.env` / `EXPO_PUBLIC_*` no momento do build).

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
- Variáveis `EXPO_PUBLIC_OPENAI_API_KEY` (e opcionalmente `EXPO_PUBLIC_OPENAI_BASE_URL`, `EXPO_PUBLIC_OPENAI_MODEL`) são embutidas no JavaScript do build; trate o APK como confidencial se usar chave real.

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

### Instalar no telemóvel (sem Play Store)

Não é necessário publicar na Play Store para usar o app só para si.

1. **Obter o ficheiro `.apk`** — conclua a Opção A ou B acima e transfira o APK para o computador, se ainda não estiver no telemóvel.
2. **Enviar o APK para o telemóvel**, por exemplo: cabo USB (copiar para a pasta `Download`), Google Drive, Dropbox, e-mail ou mensagem (atenção ao tamanho do ficheiro).
3. **No Android**, abra o ficheiro `.apk` com a app **Ficheiros** ou **Transferências**. Na primeira vez, o sistema pode pedir **permitir instalação a partir desta origem** (Chrome, Ficheiros, etc.) — ative essa permissão só para a app que está a usar.
4. Toque em **Instalar**. Quando existir uma versão nova, instale o novo APK por cima; para o Android aceitar, o `versionCode` em `app.json` deve ser **maior** que o da instalação anterior.

**Expo Go:** para testes rápidos no mesmo Wi‑Fi, `npx expo start` e leitura do QR code com Expo Go também funciona, mas não substitui um APK se quiser o app instalado como qualquer outra aplicação.

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
