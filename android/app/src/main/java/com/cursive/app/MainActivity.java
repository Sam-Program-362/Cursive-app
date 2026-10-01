package com.cursive.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register before super.onCreate so the bridge picks it up at startup.
        registerPlugin(PythonRunnerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
