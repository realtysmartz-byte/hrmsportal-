package in.realtysmartz.hrms;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final int LOCATION_PERMISSION_REQUEST = 1001;

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
    }
  }
}
