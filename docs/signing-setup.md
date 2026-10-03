# Android signing key (Cursive)

Cursive is signed with **one permanent key** so that every new `Cursive.apk`
installs *over* the previous one and keeps the user's files. Without this, each
GitHub Actions run generated a fresh debug key, and Android refused the update
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).

The key itself is **never committed**. It lives only as a GitHub Actions secret.

## Secrets the build needs

Two repository secrets in **Settings → Secrets and variables → Actions**:

| Secret name | What it is |
| --- | --- |
| `SIGNING_KEYSTORE_BASE64` | The keystore file, base64-encoded onto a single line |
| `SIGNING_PASSWORD` | The keystore password (PKCS12 uses the same password for the key) |

The key alias is not secret and is hard-coded as `cursive` in the workflow.

## How the build uses them

`.github/workflows/android.yml`:

1. Decodes `SIGNING_KEYSTORE_BASE64` to `$RUNNER_TEMP/cursive-release.keystore`
   and validates it with `keytool`. If the secret is missing the job **fails
   loudly** instead of shipping a differently-signed APK.
2. Runs `./gradlew assembleRelease` with these environment variables, which
   `android/app/build.gradle` reads:
   - `CURSIVE_KEYSTORE_FILE`
   - `CURSIVE_STORE_PASSWORD`
   - `CURSIVE_KEY_ALIAS` (`cursive`)
   - `CURSIVE_KEY_PASSWORD`
3. Publishes `android/app/build/outputs/apk/release/app-release.apk` as
   `Cursive.apk` on the `cursive-latest` release.

When the env vars are absent (a local build without secrets), the release build
falls back to the debug key so `assembleRelease` still produces an APK. That
build is only for testing — do not publish it.

## Rotating the key (only if it is lost)

Because the key is permanent, losing it means future updates can no longer
install over the existing app (users would have to uninstall once, losing their
files). Keep a backup of the keystore file and the password somewhere safe
outside the repository (e.g. a password manager).

Generate a replacement with:

```bash
keytool -genkeypair -v \
  -keystore cursive-release.keystore -storetype PKCS12 -alias cursive \
  -keyalg RSA -keysize 2048 -validity 10950 \
  -storepass "$SIGNING_PASSWORD" -keypass "$SIGNING_PASSWORD" \
  -dname "CN=Cursive, OU=Mobile, O=Cursive, C=US"

base64 -w0 cursive-release.keystore   # paste the output into SIGNING_KEYSTORE_BASE64
```

Bump `versionCode` in `android/app/build.gradle` for every release.
