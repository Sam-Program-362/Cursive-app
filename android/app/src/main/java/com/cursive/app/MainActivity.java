package com.cursive.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register before super.onCreate so the bridge picks them up at startup.
        registerPlugin(PythonRunnerPlugin.class);
        registerPlugin(SecureStorePlugin.class);
        registerPlugin(DeviceFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
