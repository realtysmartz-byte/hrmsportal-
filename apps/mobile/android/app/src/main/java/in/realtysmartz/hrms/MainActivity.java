package in.realtysmartz.hrms;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final int LOCATION_PERMISSION_REQUEST = 1001;
  private static final int BG_LOCATION_PERMISSION_REQUEST = 1002;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(DutyTrackingPlugin.class);
    super.onCreate(savedInstanceState);
    requestLocationPermission();
  }

  private void requestLocationPermission() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return;
    }

    boolean fineGranted =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    boolean coarseGranted =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;

    java.util.ArrayList<String> needed = new java.util.ArrayList<>();
    if (!fineGranted) needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
    if (!coarseGranted) needed.add(Manifest.permission.ACCESS_COARSE_LOCATION);
    if (Build.VERSION.SDK_INT >= 33
        && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
      needed.add(Manifest.permission.POST_NOTIFICATIONS);
    }
    if (!needed.isEmpty()) {
      ActivityCompat.requestPermissions(
          this, needed.toArray(new String[0]), LOCATION_PERMISSION_REQUEST);
    } else {
      requestBackgroundLocationPermission();
    }
  }

  private void requestBackgroundLocationPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      boolean bgGranted =
          ContextCompat.checkSelfPermission(
                  this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
              == PackageManager.PERMISSION_GRANTED;
      if (!bgGranted) {
        try {
          new android.app.AlertDialog.Builder(this)
              .setTitle("Enable 'Allow all the time' Location")
              .setMessage(
                  "To track your attendance and hourly on-duty location accurately even when the app is closed or removed from recents, please choose 'Allow all the time' in Location permissions.\n\n(ऐप बंद होने पर भी लोकेशन व उपस्थिति रिकॉर्डिंग के लिए 'Allow all the time' चुनें)")
              .setPositiveButton(
                  "Open Settings",
                  (dialog, which) -> {
                    try {
                      Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                      intent.setData(Uri.parse("package:" + getPackageName()));
                      startActivity(intent);
                    } catch (Exception e) {
                      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ActivityCompat.requestPermissions(
                            this,
                            new String[] {Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                            BG_LOCATION_PERMISSION_REQUEST);
                      }
                    }
                  })
              .setNegativeButton("Later", (dialog, which) -> checkBatteryOptimization())
              .setCancelable(false)
              .show();
        } catch (Exception e) {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ActivityCompat.requestPermissions(
                this,
                new String[] {Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                BG_LOCATION_PERMISSION_REQUEST);
          }
        }
      } else {
        checkBatteryOptimization();
      }
    } else {
      checkBatteryOptimization();
    }
  }

  private void checkBatteryOptimization() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      try {
        android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
          Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
          intent.setData(android.net.Uri.parse("package:" + getPackageName()));
          startActivity(intent);
        }
      } catch (Exception ignored) {
        try {
          Intent intent = new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
          startActivity(intent);
        } catch (Exception ignored2) {}
      }
    }
  }

  @Override
  public void onResume() {
    super.onResume();
    try {
      android.content.SharedPreferences prefs =
          getSharedPreferences("duty_tracking", Context.MODE_PRIVATE);
      if (prefs.getBoolean("is_running", false)) {
        Intent intent = new Intent(this, DutyTrackingService.class);
        intent.setAction(DutyTrackingService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          startForegroundService(intent);
        } else {
          startService(intent);
        }
      }
    } catch (Exception ignored) {}
  }

  @Override
  public void onRequestPermissionsResult(
      int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == LOCATION_PERMISSION_REQUEST) {
      requestBackgroundLocationPermission();
    } else if (requestCode == BG_LOCATION_PERMISSION_REQUEST) {
      checkBatteryOptimization();
    }
  }
}
