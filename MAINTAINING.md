# Manutenção do CasualNoMore

Notas para quem mantém o projeto: preparar uma máquina nova e publicar versões. Para usar e compilar o app, veja o [README](./README.md).

## ⚠️ O que não está no repositório

| Item | Onde fica | Se perder |
|---|---|---|
| **Keystore de release** (`casualnomore-release.jks`) **e a senha dela** | fora do projeto + **backup fora da máquina** | nenhuma versão nova atualiza o app instalado nos aparelhos (todos teriam que desinstalar). Os secrets do GitHub **não** servem de backup: o valor não pode ser lido de volta. |
| `%USERPROFILE%\.gradle\gradle.properties` | na máquina | recriar (seção abaixo) |
| Secrets do GitHub (`CNM_*`) | no GitHub | não se perdem ao formatar; só recadastrar se trocar a keystore |

## Máquina nova

1. **Instalar:**
   - [Node.js](https://nodejs.org/) LTS 20+
   - [Android Studio](https://developer.android.com/studio), com o Android SDK (o Java 21 vem junto, em `Android Studio\jbr`)
   - Git
2. **Clonar e instalar as dependências:**
   ```powershell
   git clone https://github.com/RichardPacco/CasualNoMore.git
   cd CasualNoMore
   npm install
   ```
3. **Restaurar a keystore** do backup para uma pasta fora do projeto (ex.: `C:\keys\casualnomore-release.jks`).
4. **Criar `%USERPROFILE%\.gradle\gradle.properties`** (assina os builds locais com a keystore de release; sem ele, saem com a chave de debug):
   ```properties
   CNM_UPLOAD_STORE_FILE=C:/keys/casualnomore-release.jks
   CNM_UPLOAD_STORE_PASSWORD=<senha da keystore>
   CNM_UPLOAD_KEY_ALIAS=casualnomore
   CNM_UPLOAD_KEY_PASSWORD=<senha da chave, normalmente a mesma>
   ```
   Use `/` no caminho. Ver [`plugins/withReleaseSigning.js`](./plugins/withReleaseSigning.js).
5. **Opcional:**
   - fixar o Java do Android Studio para o terminal (abrir um terminal novo depois):
     ```powershell
     [Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
     ```
   - no VS Code, se a extensão de Java reclamar do Gradle, escolher **"Use Java 21 as Gradle JVM"** (nunca atualizar o Gradle: o React Native 0.79 precisa do 8.x)
   - adicionar a pasta do projeto e `%USERPROFILE%\.gradle` às exclusões do antivírus (builds bem mais rápidos)
6. **Conferir:** `npm start` para desenvolver; build local:
   ```powershell
   npx expo prebuild --platform android --clean
   cd android
   .\gradlew.bat assembleRelease -PreactNativeArchitectures=x86,arm64-v8a
   ```
   (`x86` = emulador, `arm64-v8a` = celular; sem o parâmetro compila as 4 arquiteturas.)

## Publicar uma versão

1. Subir `version` e `android.versionCode` no `app.config.js` (e a linha "Versão atual" do README).
2. Commit e push.
3. Criar e enviar a tag (precisa bater com a `version`, senão o workflow falha):
   ```powershell
   git tag v4.0.1
   git push origin v4.0.1
   ```
4. Acompanhar **Actions → Build APK**. Ao terminar, a release com `CasualNoMore-vX.Y.Z.apk` está publicada e o botão **Perfil → Verificar atualização** do app já a encontra.

Para testar o build sem criar release: **Actions → Build APK → Run workflow** (gera só o artefato; o botão só aparece com o workflow na branch padrão).

## Secrets do GitHub

Settings → Secrets and variables → Actions. Só precisam ser recadastrados se a keystore mudar.

| Secret | Valor |
|---|---|
| `CNM_KEYSTORE_BASE64` | a keystore em base64: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\keys\casualnomore-release.jks")) \| Set-Clipboard` |
| `CNM_UPLOAD_STORE_PASSWORD` | senha da keystore |
| `CNM_UPLOAD_KEY_ALIAS` | `casualnomore` |
| `CNM_UPLOAD_KEY_PASSWORD` | senha da chave |

Detalhes do build em [`.github/workflows/release.yml`](./.github/workflows/release.yml).

## Trocar de keystore (só em último caso)

Se a keystore se perder, é preciso criar outra (comando abaixo), recadastrar os secrets e recriar o `gradle.properties`. Os apps já instalados **não** aceitam a atualização: cada pessoa precisa desinstalar e instalar de novo (os dados locais se perdem).

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v `
  -keystore C:\keys\casualnomore-release.jks -alias casualnomore -keyalg RSA -keysize 2048 -validity 10000
```
