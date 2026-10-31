package in.realtysmartz.hrms;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DutyTracking")
public class DutyTrackingPlugin extends Plugin {

    private void showDeviceNotification(String title, String body) {
    if (body == null || body.trim().isEmpty()) return;
    try {
      if (Build.VERSION.SDK_INT >= 33 && getActivity() != null) {
        if (androidx.core.content.ContextCompat.checkSelfPermission(
                getActivity(), Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
          androidx.core.app.ActivityCompat.requestPermissions(
              getActivity(),
              new String[] {Manifest.permission.POST_NOTIFICATIONS},
              1003);
        }
      }

      String channelId = "hrms_alerts_v3";
      NotificationManager nm =
          (NotificationManager)
              getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
        NotificationChannel channel =
            new NotificationChannel(
                channelId, "Attendance & Duty Alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Clock In, Clock Out and System notifications");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] {0, 250, 150, 250});
        channel.setShowBadge(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        android.media.AudioAttributes audioAttributes =
            new android.media.AudioAttributes.Builder()
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                .build();
        channel.setSound(
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes);
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
              .setContentTitle(title != null ? title : "RS HRMS")
              .setContentText(body)
              .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
              .setSmallIcon(R.mipmap.ic_launcher)
              .setAutoCancel(true)
              .setContentIntent(pi)
              .setPriority(NotificationCompat.PRIORITY_MAX)
              .setDefaults(NotificationCompat.DEFAULT_ALL)
              .setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI)
              .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

      if (nm != null) {
        int notifId = (int) (System.currentTimeMillis() % 100000);
        nm.notify(notifId, builder.build());
      }
    } catch (Exception e) {
      android.util.Log.e("DutyTracking", "Failed to show notification: " + e.getMessage());
    }
  }

  @PluginMethod
  public void start(PluginCall call) {
    int intervalMs = call.getInt("intervalMs", 60 * 60 * 1000);
    String apiUrl = call.getString("apiUrl", "https://rshrms.in/api/native/location-ping");

    String title = call.getString("title", null);
    String body = call.getString("body", null);
    if (body != null && !body.trim().isEmpty()) {
      showDeviceNotification(title != null ? title : "✨ Clocked In Successfully!", body);
    }

    Intent intent = new Intent(getContext(), DutyTrackingService.class);
    intent.setAction(DutyTrackingService.ACTION_START);
    intent.putExtra(DutyTrackingService.EXTRA_INTERVAL_MS, intervalMs);
    intent.putExtra(DutyTrackingService.EXTRA_API_URL, apiUrl);

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        getContext().startForegroundService(intent);
      } else {
        getContext().startService(intent);
      }
    } catch (Exception e) {
      try {
        getContext().startService(intent);
      } catch (Exception ignored) {}
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
    String title = call.getString("title", null);
    String body = call.getString("body", null);
    if (body != null && !body.trim().isEmpty()) {
      showDeviceNotification(title != null ? title : "👋 Clocked Out Successfully!", body);
    }

    Intent intent = new Intent(getContext(), DutyTrackingService.class);
    intent.setAction(DutyTrackingService.ACTION_STOP);
    try {
      getContext().startService(intent);
    } catch (Exception ignored) {}

    JSObject result = new JSObject();
    result.put("stopped", true);
    call.resolve(result);
  }

  @PluginMethod
  public void showNotification(PluginCall call) {
    String title = call.getString("title", "RS HRMS");
    String body = call.getString("body", "");
    if (body == null || body.trim().isEmpty()) {
      call.resolve();
      return;
    }

    showDeviceNotification(title, body);
    JSObject res = new JSObject();
    res.put("shown", true);
    call.resolve(res);
  }
}
