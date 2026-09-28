package com.karelisio.komorebi;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KomorebiNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
