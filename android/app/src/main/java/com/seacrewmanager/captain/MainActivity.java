package com.seacrewmanager.captain;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.seacrewmanager.wakeword.WakeWordPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register wake-word plugin
        registerPlugin(WakeWordPlugin.class);
    }
}
