package com.cursive.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Tiny encrypted key/value store for user secrets (GitHub token, AI API keys).
 *
 * Values are encrypted with an AES-256-GCM key that lives inside the Android
 * Keystore and never leaves the device. Only the ciphertext is written to
 * regular SharedPreferences, so reading the app's data folder does not reveal
 * the token. The key is generated on first use and re-used for later writes.
 */
@CapacitorPlugin(name = "SecureStore")
public class SecureStorePlugin extends Plugin {

    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String ALIAS = "cursive_secrets_key";
    private static final String PREFS = "cursive_secure_store";
    private static final String TRANSFORM = "AES/GCM/NoPadding";
    private static final int TAG_BITS = 128;

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE);
        ks.load(null);
        if (ks.containsAlias(ALIAS)) {
            return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key", "");
        String value = call.getString("value", "");
        if (key == null || key.isEmpty()) {
            call.reject("key is required");
            return;
        }
        if (value == null) {
            prefs().edit().remove(key).apply();
            call.resolve();
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));

            // Store [iv length][iv][ciphertext] so reads are self-describing.
            byte[] payload = new byte[1 + iv.length + encrypted.length];
            payload[0] = (byte) iv.length;
            System.arraycopy(iv, 0, payload, 1, iv.length);
            System.arraycopy(encrypted, 0, payload, 1 + iv.length, encrypted.length);

            prefs().edit()
                    .putString(key, Base64.encodeToString(payload, Base64.NO_WRAP))
                    .apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to store secret: " + e.getMessage());
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key", "");
        JSObject result = new JSObject();
        result.put("value", readValue(key));
        call.resolve(result);
    }

    private String readValue(String key) {
        String stored = prefs().getString(key, null);
        if (stored == null) return null;
        try {
            byte[] payload = Base64.decode(stored, Base64.NO_WRAP);
            int ivLength = payload[0] & 0xFF;
            byte[] iv = new byte[ivLength];
            byte[] encrypted = new byte[payload.length - 1 - ivLength];
            System.arraycopy(payload, 1, iv, 0, ivLength);
            System.arraycopy(payload, 1 + ivLength, encrypted, 0, encrypted.length);

            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(),
                    new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            // Key was rotated or data is corrupt — drop the unreadable entry.
            prefs().edit().remove(key).apply();
            return null;
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key", "");
        if (key != null) {
            prefs().edit().remove(key).apply();
        }
        call.resolve();
    }
}
