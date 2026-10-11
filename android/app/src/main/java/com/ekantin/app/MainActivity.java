package com.ekantin.app;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		hideSystemBars();
	}

	@Override
	public void onWindowFocusChanged(boolean hasFocus) {
		super.onWindowFocusChanged(hasFocus);
		if (hasFocus) {
			hideSystemBars();
		}
	}

	private void hideSystemBars() {
		WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(
				getWindow(), getWindow().getDecorView());
		controller.hide(WindowInsetsCompat.Type.systemBars());
		controller.setSystemBarsBehavior(
				WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
	}
}
