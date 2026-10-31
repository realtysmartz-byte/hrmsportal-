package in.realtysmartz.hrms;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DutyTracking")
public class DutyTrackingPlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    int intervalMs = call.getInt("intervalMs", 60 * 60 * 1000);
    String apiUrl = call.getString("apiUrl", "https://rshrms.in/api/native/location-ping");

    Intent intent = new Intent(getContext(), DutyTrackingService.class);
    intent.setAction(DutyTrackingService.ACTION_START);
    intent.putExtra(DutyTrackingService.EXTRA_INTERVAL_MS, intervalMs);
    intent.putExtra(DutyTrackingService.EXTRA_API_URL, apiUrl);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getContext().startForegroundService(intent);
    } else {
      getContext().startService(intent);
    }

    JSObject result = new JSObject();
    result.put("started", true);
    call.resolve(result);
  }

  @PluginMethod
  public void lastKnownFix(PluginCall call) {
    try {
      android.location.LocationManager lm =
          (android.location.LocationManager)
              getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
      if (lm == null) {
        call.resolve(new JSObject());
        return;
      }
      android.location.Location gps =
          lm.getLastKnownLocation(android.location.LocationManager.GPS_PROVIDER);
      android.location.Location net =
          lm.getLastKnownLocation(android.location.LocationManager.NETWORK_PROVIDER);
      android.location.Location best = gps;
      if (net != null && (best == null || net.getAccuracy() < best.getAccuracy())) best = net;
      JSObject result = new JSObject();
      if (best != null) {
        result.put("lat", best.getLatitude());
        result.put("lng", best.getLongitude());
        if (best.hasAccuracy()) result.put("accuracy", best.getAccuracy());
        result.put("timestamp", best.getTime());
        result.put("isMockLocation", DutyTrackingService.isMockFix(best));
      }
      call.resolve(result);
    } catch (SecurityException e) {
      call.resolve(new JSObject());
    }
  }

  @PluginMethod
  public void stop(PluginCall call) {
    Intent intent = new Intent(getContext(), DutyTrackingService.class);
    intent.setAction(DutyTrackingService.ACTION_STOP);
    getContext().startService(intent);

    JSObject result = new JSObject();
    result.put("stopped", true);
    call.resolve(result);
  }

  @PluginMethod
  public void showNotification(PluginCall call) {
    String title = call.getString("title", "RS HRMS");
    String body = call.getString("body", "");
    if (body == null || body.isEmpty()) {
      call.resolve();
      return;
    }

    try {
      String channelId = "hrms_alerts";
      NotificationManager nm =
          (NotificationManager)
              getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
        NotificationChannel channel =
            new NotificationChannel(
                channelId, "Attendance & Duty Alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Clock In, Clock Out and System notifications");
        channel.enableVibration(true);
        nm.createNotificationChannel(channel);
      }

      Intent launch =
          getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
      PendingIntent pi =
          PendingIntent.getActivity(
              getContext(),
              (int) System.currentTimeMillis(),
              launch != null ? launch : new Intent(),
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

      NotificationCompat.Builder builder =
          new NotificationCompat.Builder(getContext(), channelId)
              .setContentTitle(title)
              .setContentText(body)
              .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
              .setSmallIcon(R.mipmap.ic_launcher)
              .setAutoCancel(true)
              .setContentIntent(pi)
              .setPriority(NotificationCompat.PRIORITY_HIGH)
              .setDefaults(NotificationCompat.DEFAULT_ALL);

      if (nm != null) {
        nm.notify((int) (System.currentTimeMillis() % 100000), builder.build());
      }
      JSObject res = new JSObject();
      res.put("shown", true);
      call.resolve(res);
    } catch (Exception e) {
      call.reject("Failed to show notification: " + e.getMessage());
    }
  }
}
