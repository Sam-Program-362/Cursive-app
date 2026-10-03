package com.cursive.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.OpenableColumns;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/**
 * Real device file access so Cursive's project files can live in a normal
 * folder (Documents/Cursive by default) that any file manager can open,
 * instead of only inside the app's private storage.
 *
 * On Android 11+ this uses the "All files access" special permission
 * (MANAGE_EXTERNAL_STORAGE), which the user grants from system Settings. On
 * older versions it requests the classic READ/WRITE_EXTERNAL_STORAGE runtime
 * permission. The app works fine without it — this only unlocks the device
 * file browser.
 */
@CapacitorPlugin(
        name = "DeviceFiles",
        permissions = {
                @Permission(
                        strings = {
                                Manifest.permission.READ_EXTERNAL_STORAGE,
                                Manifest.permission.WRITE_EXTERNAL_STORAGE
                        },
                        alias = "storage")
        })
public class DeviceFilesPlugin extends Plugin {

    private static final long MAX_READ_BYTES = 2_000_000L; // 2 MB of text
    private static final String WORKSPACE_FOLDER = "Cursive";

    private boolean hasAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager();
        }
        return getPermissionState("storage") == PermissionState.GRANTED;
    }

    private File documentsDir() {
        return Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
    }

    private File workspaceDir() {
        return new File(documentsDir(), WORKSPACE_FOLDER);
    }

    private File resolveDir(String path) {
        if (path == null || path.isEmpty()) return workspaceDir();
        return new File(path);
    }

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasAccess());
        result.put("sdk", Build.VERSION.SDK_INT);
        result.put("needsSettings", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R);
        call.resolve(result);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            openAllFilesSettings();
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
            return;
        }
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("storage", call, "storagePermissionCallback");
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("storage") == PermissionState.GRANTED);
        call.resolve(result);
    }

    private void openAllFilesSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                getActivity().startActivity(fallback);
            } catch (Exception ignored) {
                // Some devices have neither screen; the user can grant from Settings manually.
            }
        }
    }

    @PluginMethod
    public void getPaths(PluginCall call) {
        JSObject result = new JSObject();
        result.put("documents", documentsDir().getAbsolutePath());
        result.put("workspace", workspaceDir().getAbsolutePath());
        result.put("granted", hasAccess());
        call.resolve(result);
    }

    @PluginMethod
    public void list(PluginCall call) {
        if (!hasAccess()) {
            call.reject("Storage permission not granted");
            return;
        }
        File dir = resolveDir(call.getString("path", null));
        if (!dir.exists() || !dir.isDirectory()) {
            call.reject("Folder not found: " + dir.getAbsolutePath());
            return;
        }
        File[] children = dir.listFiles();
        List<File> files = new ArrayList<>();
        if (children != null) {
            for (File child : children) {
                if (child.getName().startsWith(".")) continue;
                files.add(child);
            }
        }
        files.sort(new Comparator<File>() {
            @Override
            public int compare(File a, File b) {
                if (a.isDirectory() != b.isDirectory()) return a.isDirectory() ? -1 : 1;
                return a.getName().compareToIgnoreCase(b.getName());
            }
        });

        JSArray entries = new JSArray();
        for (File file : files) {
            JSObject entry = new JSObject();
            entry.put("name", file.getName());
            entry.put("path", file.getAbsolutePath());
            entry.put("isDirectory", file.isDirectory());
            entry.put("size", file.isDirectory() ? 0 : file.length());
            entries.put(entry);
        }

        JSObject result = new JSObject();
        result.put("path", dir.getAbsolutePath());
        result.put("parent", dir.getParent());
        result.put("entries", entries);
        call.resolve(result);
    }

    @PluginMethod
    public void readText(PluginCall call) {
        if (!hasAccess()) {
            call.reject("Storage permission not granted");
            return;
        }
        String path = call.getString("path", null);
        if (path == null || path.isEmpty()) {
            call.reject("path is required");
            return;
        }
        File file = new File(path);
        if (!file.isFile()) {
            call.reject("File not found: " + path);
            return;
        }
        if (file.length() > MAX_READ_BYTES) {
            call.reject("This file is too large to open (over 2 MB).");
            return;
        }
        try {
            byte[] bytes = readAll(file);
            for (byte b : bytes) {
                if (b == 0) {
                    call.reject("This looks like a binary file, so it can't be opened as text.");
                    return;
                }
            }
            JSObject result = new JSObject();
            result.put("path", file.getAbsolutePath());
            result.put("name", file.getName());
            result.put("content", new String(bytes, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void writeText(PluginCall call) {
        if (!hasAccess()) {
            call.reject("Storage permission not granted");
            return;
        }
        String path = call.getString("path", null);
        String content = call.getString("content", "");
        if (path == null || path.isEmpty()) {
            call.reject("path is required");
            return;
        }
        File file = new File(path);
        if (file.isDirectory()) {
            call.reject("That path is a folder.");
            return;
        }
        try {
            File parent = file.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                call.reject("Could not create folder: " + parent.getAbsolutePath());
                return;
            }
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write((content == null ? "" : content).getBytes(StandardCharsets.UTF_8));
            }
            JSObject result = new JSObject();
            result.put("path", file.getAbsolutePath());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not save file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void makeDirectory(PluginCall call) {
        if (!hasAccess()) {
            call.reject("Storage permission not granted");
            return;
        }
        String path = call.getString("path", null);
        if (path == null || path.isEmpty()) {
            call.reject("path is required");
            return;
        }
        File dir = new File(path);
        if (!dir.exists() && !dir.mkdirs()) {
            call.reject("Could not create folder: " + dir.getAbsolutePath());
            return;
        }
        JSObject result = new JSObject();
        result.put("path", dir.getAbsolutePath());
        call.resolve(result);
    }

    /**
     * Returns the file the app was opened with (e.g. tapping a .py file in a
     * file manager), or null. The web layer calls this once on startup.
     */
    @PluginMethod
    public void getInitialFile(PluginCall call) {
        JSObject result = new JSObject();
        try {
            Intent intent = getActivity().getIntent();
            Uri data = intent != null ? intent.getData() : null;
            if (data != null) {
                String name = queryName(data);
                String content = readUri(data);
                if (content != null) {
                    result.put("name", name != null ? name : "untitled.py");
                    result.put("path", data.toString());
                    result.put("content", content);
                    call.resolve(result);
                    return;
                }
            }
        } catch (Exception ignored) {
            // Fall through and report that there is no initial file.
        }
        result.put("name", null);
        call.resolve(result);
    }

    private String queryName(Uri uri) {
        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver()
                    .query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) return cursor.getString(index);
            }
        } catch (Exception ignored) {
            // fall through
        } finally {
            if (cursor != null) cursor.close();
        }
        String last = uri.getLastPathSegment();
        return last == null ? null : new File(last).getName();
    }

    private String readUri(Uri uri) {
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            byte[] bytes = readStream(in);
            if (bytes.length > MAX_READ_BYTES) return null;
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private static byte[] readAll(File file) throws Exception {
        try (FileInputStream in = new FileInputStream(file)) {
            return readStream(in);
        }
    }

    private static byte[] readStream(InputStream in) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int read;
        while ((read = in.read(chunk)) != -1) {
            buffer.write(chunk, 0, read);
        }
        return buffer.toByteArray();
    }
}
