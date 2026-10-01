package com.cursive.app;

import android.os.Handler;
import android.os.Looper;

import com.chaquo.python.PyObject;
import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.LinkedBlockingQueue;

/**
 * Runs Python on-device with Chaquopy (a real CPython interpreter).
 *
 * The user's project is written to app-private storage and executed on a
 * background thread, so Stop can interrupt infinite loops and the UI thread
 * never blocks. Output, input requests and the exit code are streamed to JS
 * as Capacitor events: stdout, stderr, inputRequest, exit.
 */
@CapacitorPlugin(name = "PythonRunner")
public class PythonRunnerPlugin extends Plugin {

    /** Sentinel pushed into the queue to unblock input() when stopping. */
    private static final String INPUT_STOP_SENTINEL = "\u0000__CURSIVE_STOP__";

    private static PythonRunnerPlugin instance;
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private final LinkedBlockingQueue<String> inputQueue = new LinkedBlockingQueue<>();
    private volatile boolean running = false;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Static bridge methods called from Python (cursive_runner.py)        */
    /* ------------------------------------------------------------------ */

    public static void onStdout(String text) {
        emit("stdout", "text", text);
    }

    public static void onStderr(String text) {
        emit("stderr", "text", text);
    }

    public static void onExit(int code) {
        PythonRunnerPlugin target = instance;
        if (target == null) return;
        JSObject data = new JSObject();
        data.put("code", code);
        MAIN.post(() -> target.notifyListeners("exit", data));
    }

    /**
     * Blocks the Python thread until the UI submits a line of input.
     * Returns null when the program was stopped or the queue was interrupted.
     */
    public static String requestInput(String prompt) {
        PythonRunnerPlugin target = instance;
        if (target == null) return null;

        JSObject data = new JSObject();
        data.put("prompt", prompt == null ? "" : prompt);
        MAIN.post(() -> target.notifyListeners("inputRequest", data));

        try {
            String value = target.inputQueue.take();
            if (INPUT_STOP_SENTINEL.equals(value)) return null;
            return value;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
    }

    private static void emit(String event, String key, String value) {
        PythonRunnerPlugin target = instance;
        if (target == null) return;
        JSObject data = new JSObject();
        data.put(key, value);
        MAIN.post(() -> target.notifyListeners(event, data));
    }

    /* ------------------------------------------------------------------ */
    /* Plugin API                                                          */
    /* ------------------------------------------------------------------ */

    @PluginMethod
    public void run(PluginCall call) {
        JSArray projectFiles = call.getArray("projectFiles");
        String entryFile = call.getString("entryFile", "main.py");

        if (projectFiles == null) {
            call.reject("projectFiles is required");
            return;
        }

        File projectDir = new File(getContext().getFilesDir(), "python_project");
        deleteRecursively(projectDir);
        if (!projectDir.exists() && !projectDir.mkdirs()) {
            call.reject("Could not create the project directory");
            return;
        }

        String entryPath = null;
        try {
            for (int i = 0; i < projectFiles.length(); i++) {
                JSONObject file = projectFiles.getJSONObject(i);
                String path = file.getString("path");
                String content = file.optString("content", "");

                File target = new File(projectDir, path);
                File parent = target.getParentFile();
                if (parent != null) {
                    //noinspection ResultOfMethodCallIgnored
                    parent.mkdirs();
                }
                try (FileOutputStream out = new FileOutputStream(target)) {
                    out.write(content.getBytes(StandardCharsets.UTF_8));
                }

                if (path.equals(entryFile)) {
                    entryPath = target.getAbsolutePath();
                }
            }
        } catch (Exception e) {
            call.reject("Failed to write project files: " + e.getMessage());
            return;
        }

        if (entryPath == null) {
            entryPath = new File(projectDir, entryFile).getAbsolutePath();
        }

        inputQueue.clear();
        running = true;

        final String finalEntryPath = entryPath;
        final String projectPath = projectDir.getAbsolutePath();

        Thread worker = new Thread(() -> {
            try {
                if (!Python.isStarted()) {
                    Python.start(new AndroidPlatform(getContext().getApplicationContext()));
                }
                PyObject runner = Python.getInstance().getModule("cursive_runner");
                runner.callAttr("run", finalEntryPath, projectPath);
            } catch (Throwable t) {
                String message = t.getMessage() == null ? t.toString() : t.getMessage();
                onStderr(message + "\n");
                onExit(1);
            } finally {
                running = false;
            }
        }, "cursive-python");
        worker.start();

        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    @PluginMethod
    public void sendInput(PluginCall call) {
        String text = call.getString("text", "");
        inputQueue.offer(text == null ? "" : text);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            if (Python.isStarted()) {
                Python.getInstance()
                        .getModule("cursive_runner")
                        .callAttr("request_stop");
            }
        } catch (Exception ignored) {
            // Python may not have started yet; the queue sentinel still unblocks input().
        }
        inputQueue.offer(INPUT_STOP_SENTINEL);
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", running);
        call.resolve(result);
    }

    private static void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursively(child);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }
}
