package in.realtysmartz.hrms;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.PowerManager;
import android.os.SystemClock;
import android.webkit.CookieManager;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

public class DutyTrackingReceiver extends BroadcastReceiver {
  public static final String ACTION_ALARM_TICK = "in.realtysmartz.hrms.DUTY_ALARM_TICK";
  public static final String ACTION_PROVIDERS_CHANGED = "android.location.PROVIDERS_CHANGED_ACTION";
  private static final int NOTIFICATION_ID = 4401;
  private static final int ALARM_REQUEST_CODE = 4402;
  private static final ExecutorService executor = Executors.newCachedThreadPool();

  @Override
  public void onReceive(Context context, Intent intent) {
    if (context == null) return;

    SharedPreferences prefs = context.getSharedPreferences("duty_tracking", Context.MODE_PRIVATE);
    boolean isRunning = prefs.getBoolean("is_running", false);
    if (!isRunning) return;

    // Shift window covers 08:00 AM to 21:00 PM (9:00 PM) IST
    java.util.Calendar cal =
        java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("Asia/Kolkata"));
    int hour = cal.get(java.util.Calendar.HOUR_OF_DAY);

    if (hour >= 21 || hour < 8) {
      prefs.edit().putBoolean("is_running", false).apply();
      cancelAlarm(context);
      showShiftEndNotification(context);
      return;
    }

    String action = intent != null ? intent.getAction() : null;

    // 1. Immediate trigger when employee turns GPS OFF in Android quick settings
    if (LocationManager.PROVIDERS_CHANGED_ACTION.equals(action)) {
      LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
      boolean isGpsEnabled =
          lm != null
              && (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                  || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));

      if (!isGpsEnabled) {
        final PendingResult pr = goAsync();
        executor.execute(
            () -> {
              try {
                reportLocationDisabled(
                    context,
                    "Device GPS / Location switched OFF in Android quick settings while on active duty");
              } finally {
                pr.finish();
              }
            });
      }
      return;
    }

    // 2. Scheduled hourly tick or boot wake-up
    long intervalMs = prefs.getLong("interval_ms", 60 * 60 * 1000L);
    scheduleNextAlarm(context, intervalMs);

    // Ensure any leftover ongoing notification (ID 4401) is canceled
    try {
      NotificationManager nm =
          (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm != null) {
        nm.cancel(NOTIFICATION_ID);
      }
    } catch (Exception ignored) {}

    final PendingResult pendingResult = goAsync();
    executor.execute(
        () -> {
          PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
          PowerManager.WakeLock wakeLock = null;
          if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "rshrms:duty_receiver_tick");
            wakeLock.acquire(45_000L);
          }
          try {
            sendLocationPing(context);
          } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
              wakeLock.release();
            }
            pendingResult.finish();
          }
        });
  }

  public static void scheduleNextAlarm(Context context, long delayMs) {
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;

    Intent intent = new Intent(context, DutyTrackingReceiver.class);
    intent.setAction(ACTION_ALARM_TICK);

    PendingIntent pi =
        PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    long nextTriggerElapsed = SystemClock.elapsedRealtime() + Math.max(60_000L, delayMs);

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (am.canScheduleExactAlarms()) {
          am.setExactAndAllowWhileIdle(
              AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
        } else {
          am.setAndAllowWhileIdle(
              AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
        }
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setExactAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
      } else {
        am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
      }
    } catch (Throwable t) {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
        } else {
          am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
        }
      } catch (Throwable ignored) {
        am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
      }
    }
  }

  public static void cancelAlarm(Context context) {
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;

    Intent intent = new Intent(context, DutyTrackingReceiver.class);
    intent.setAction(ACTION_ALARM_TICK);
    PendingIntent pi =
        PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
    if (pi != null) {
      am.cancel(pi);
      pi.cancel();
    }
  }

  private static void reportLocationDisabled(Context context, String reason) {
    SharedPreferences prefs = context.getSharedPreferences("duty_tracking", Context.MODE_PRIVATE);
    long lastAlertAt = prefs.getLong("last_location_disabled_alert_at", 0L);
    long now = System.currentTimeMillis();
    if (now - lastAlertAt < 15 * 60 * 1000L) {
      return;
    }
    prefs.edit().putLong("last_location_disabled_alert_at", now).apply();

    try {
      JSONObject body = new JSONObject();
      body.put("reason", reason);
      body.put(
          "deviceInfo",
          "Android App ("
              + Build.MANUFACTURER
              + " "
              + Build.MODEL
              + ", Android "
              + Build.VERSION.RELEASE
              + ")");

      String employeeId = prefs.getString("employee_id", "");
      String dutyToken = prefs.getString("duty_token", "");
      if (!employeeId.isEmpty()) {
        body.put("employeeId", employeeId);
      }
      if (!dutyToken.isEmpty()) {
        body.put("dutyToken", dutyToken);
      }

      URL url = new URL("https://rshrms.in/api/native/location-disabled");
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setConnectTimeout(15000);
      conn.setReadTimeout(15000);
      conn.setRequestMethod("POST");
      conn.setDoOutput(true);
      conn.setRequestProperty("Content-Type", "application/json");

      if (!employeeId.isEmpty()) {
        conn.setRequestProperty("x-employee-id", employeeId);
      }
      if (!dutyToken.isEmpty()) {
        conn.setRequestProperty("x-duty-token", dutyToken);
      }

      String cookie = null;
      try {
        cookie = CookieManager.getInstance().getCookie("https://rshrms.in");
      } catch (Exception ignored) {}
      if (cookie == null || cookie.isEmpty()) {
        cookie = prefs.getString("auth_cookie", null);
      }
      if (cookie != null && !cookie.isEmpty()) {
        conn.setRequestProperty("Cookie", cookie);
      }

      byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
      conn.setRequestProperty("Content-Length", String.valueOf(bytes.length));
      try (OutputStream os = conn.getOutputStream()) {
        os.write(bytes);
      }
      conn.getResponseCode();
      conn.disconnect();
    } catch (Exception ignored) {}

    showLocationAlertNotification(context, reason);
  }

  private static void sendLocationPing(Context context) {
    SharedPreferences prefs = context.getSharedPreferences("duty_tracking", Context.MODE_PRIVATE);
    LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);

    boolean finePerm =
        ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    boolean coarsePerm =
        ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    boolean isGpsEnabled =
        lm != null
            && (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));

    if (!finePerm && !coarsePerm) {
      reportLocationDisabled(context, "Location permission revoked on device while on active duty");
      return;
    }

    if (!isGpsEnabled) {
      reportLocationDisabled(
          context, "Device GPS / Location switched OFF in Android quick settings while on active duty");
      return;
    }

    Location loc = getFreshLocation(context);
    if (loc == null || !loc.hasAccuracy() || loc.getAccuracy() <= 0 || loc.getAccuracy() >= 50_000) {
      return;
    }

    if (DutyTrackingService.isMockFix(loc, context) || (loc.getLatitude() == 0.0 && loc.getLongitude() == 0.0)) {
      reportLocationDisabled(context, "Fake GPS / Mock Location detected on device during active duty");
      showMockLocationWarningNotification(context);
      return;
    }

    try {
      String apiUrl = prefs.getString("api_url", "https://rshrms.in/api/native/location-ping");
      JSONObject body = new JSONObject();
      body.put("lat", loc.getLatitude());
      body.put("lng", loc.getLongitude());
      body.put("accuracyM", loc.getAccuracy());
      body.put("fixTimestamp", System.currentTimeMillis());
      body.put("isMockLocation", false);
      body.put("address", String.format("%.5f, %.5f", loc.getLatitude(), loc.getLongitude()));

      String employeeId = prefs.getString("employee_id", "");
      String dutyToken = prefs.getString("duty_token", "");
      if (!employeeId.isEmpty()) {
        body.put("employeeId", employeeId);
      }
      if (!dutyToken.isEmpty()) {
        body.put("dutyToken", dutyToken);
      }

      URL url = new URL(apiUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setConnectTimeout(25000);
      conn.setReadTimeout(25000);
      conn.setRequestMethod("POST");
      conn.setDoOutput(true);
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setRequestProperty("Accept", "application/json");

      if (!employeeId.isEmpty()) {
        conn.setRequestProperty("x-employee-id", employeeId);
      }
      if (!dutyToken.isEmpty()) {
        conn.setRequestProperty("x-duty-token", dutyToken);
      }

      String cookie = null;
      try {
        cookie = CookieManager.getInstance().getCookie("https://rshrms.in");
      } catch (Exception ignored) {}
      if (cookie == null || cookie.isEmpty()) {
        cookie = prefs.getString("auth_cookie", null);
      }
      if (cookie != null && !cookie.isEmpty()) {
        conn.setRequestProperty("Cookie", cookie);
      }

      byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
      conn.setRequestProperty("Content-Length", String.valueOf(bytes.length));
      try (OutputStream os = conn.getOutputStream()) {
        os.write(bytes);
      }

      int code = conn.getResponseCode();
      if (code >= 200 && code < 300) {
        prefs.edit().putLong("last_ping_at", System.currentTimeMillis()).apply();
        // Silent success: location ping recorded in DB without permanent/hourly notification
      } else if (code == 400) {
        try {
          InputStream es = conn.getErrorStream();
          if (es != null) {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[1024];
            int n;
            while ((n = es.read(buf)) != -1) {
              baos.write(buf, 0, n);
            }
            String resp = baos.toString("UTF-8");
            JSONObject errJson = new JSONObject(resp);
            if (errJson.optBoolean("stopTracking", false)) {
              prefs.edit().putBoolean("is_running", false).apply();
              cancelAlarm(context);
              NotificationManager nm =
                  (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
              if (nm != null) nm.cancel(NOTIFICATION_ID);
            }
          }
        } catch (Exception ignored) {}
      }
      conn.disconnect();
    } catch (Exception ignored) {}
  }

  private static void showMockLocationWarningNotification(Context context) {
    try {
      NotificationManager nm =
          (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm == null) return;
      String channelId = "hrms_security_alerts_v1";
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        NotificationChannel channel =
            new NotificationChannel(
                channelId, "Duty Security Alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Security warnings like mock location or GPS tampering");
        channel.setShowBadge(true);
        channel.enableVibration(true);
        nm.createNotificationChannel(channel);
      }
      Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
      PendingIntent pi =
          PendingIntent.getActivity(
              context,
              4403,
              launch != null ? launch : new Intent(),
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      Notification notif =
          new NotificationCompat.Builder(context, channelId)
              .setContentTitle("⚠️ Fake GPS / Mock Location Detected")
              .setContentText("Mock location detected. Duty tracking will not accept fake coordinates.")
              .setStyle(
                  new NotificationCompat.BigTextStyle()
                      .bigText(
                          "Mock location detected. Hourly duty tracking will not accept fake coordinates. Please turn off mock location apps."))
              .setSmallIcon(R.drawable.ic_stat_notification)
              .setAutoCancel(true)
              .setContentIntent(pi)
              .setPriority(NotificationCompat.PRIORITY_HIGH)
              .build();
      nm.notify(4403, notif);
    } catch (Exception ignored) {}
  }

  private static Location getFreshLocation(Context context) {
    final LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
    if (lm == null) return null;

    if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
      return null;
    }

    long now = System.currentTimeMillis();
    Location gps = null;
    Location net = null;
    Location passive = null;
    try {
      gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
      net = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
      passive = lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
    } catch (SecurityException ignored) {}

    Location best = null;
    if (gps != null && (now - gps.getTime() <= 5 * 60 * 1000L)) {
      best = gps;
    }
    if (net != null && (now - net.getTime() <= 5 * 60 * 1000L)) {
      if (best == null
          || (net.hasAccuracy() && (!best.hasAccuracy() || net.getAccuracy() < best.getAccuracy()))) {
        best = net;
      }
    }
    if (passive != null && (now - passive.getTime() <= 5 * 60 * 1000L)) {
      if (best == null
          || (passive.hasAccuracy() && (!best.hasAccuracy() || passive.getAccuracy() < best.getAccuracy()))) {
        best = passive;
      }
    }

    if (best != null && best.hasAccuracy() && best.getAccuracy() <= 100) {
      return best;
    }

    final AtomicReference<Location> result = new AtomicReference<>(best);
    final CountDownLatch latch = new CountDownLatch(1);

    HandlerThread ht = new HandlerThread("duty_receiver_loc");
    ht.start();
    Handler handler = new Handler(ht.getLooper());

    final LocationListener listener =
        new LocationListener() {
          @Override
          public void onLocationChanged(Location location) {
            if (location == null || !location.hasAccuracy()) return;
            Location prev = result.get();
            if (prev == null || location.getAccuracy() <= prev.getAccuracy()) {
              result.set(location);
            }
            if (location.getAccuracy() > 0 && location.getAccuracy() <= 100) {
              latch.countDown();
            }
          }

          @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
          @Override public void onProviderEnabled(String provider) {}
          @Override public void onProviderDisabled(String provider) {}
        };

    handler.post(
        () -> {
          try {
            boolean gpsOk = false, netOk = false;
            try { gpsOk = lm.isProviderEnabled(LocationManager.GPS_PROVIDER); } catch (Exception ignored) {}
            try { netOk = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) {}

            if (gpsOk) lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, listener, ht.getLooper());
            if (netOk) lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 1000L, 0f, listener, ht.getLooper());
            if (!gpsOk && !netOk) latch.countDown();
          } catch (SecurityException se) {
            latch.countDown();
          }
        });

    try {
      latch.await(25000L, TimeUnit.MILLISECONDS);
    } catch (InterruptedException ignored) {}

    handler.post(
        () -> {
          try { lm.removeUpdates(listener); } catch (Exception ignored) {}
          ht.quitSafely();
        });

    Location finalLoc = result.get();
    return finalLoc != null ? finalLoc : best;
  }

  private static void updateDutyNotification(Context context, long pingTime) {
    // Duty location pings run silently in the background without status bar notifications
  }

  private static void showLocationAlertNotification(Context context, String reason) {
    try {
      NotificationManager nm =
          (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm == null) return;
      String channelId = "hrms_punch_alerts_v5";
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        NotificationChannel channel =
            new NotificationChannel(
                channelId, "Attendance & Duty Alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Clock In, Clock Out and System notifications");
        channel.enableVibration(true);
        channel.setShowBadge(true);
        nm.createNotificationChannel(channel);
      }

      Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
      PendingIntent pi =
          PendingIntent.getActivity(
              context,
              (int) System.currentTimeMillis(),
              launch != null ? launch : new Intent(),
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

      Notification notification =
          new NotificationCompat.Builder(context, channelId)
              .setContentTitle("⚠️ Location Services Disabled")
              .setContentText("GPS turned OFF on active duty. Alert email sent to HR & Employee.")
              .setStyle(
                  new NotificationCompat.BigTextStyle()
                      .bigText(
                          "GPS / Location was turned off on device while on active duty. Please enable device GPS. Alert notification sent to HR Operations."))
              .setSmallIcon(R.drawable.ic_stat_notification)
              .setAutoCancel(true)
              .setContentIntent(pi)
              .setPriority(NotificationCompat.PRIORITY_MAX)
              .setCategory(NotificationCompat.CATEGORY_ALARM)
              .setDefaults(NotificationCompat.DEFAULT_ALL)
              .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
              .build();

      nm.notify(4409, notification);
    } catch (Exception ignored) {}
  }

  private void showShiftEndNotification(Context context) {
    try {
      NotificationManager nm =
          (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
      String channelId = "hrms_punch_alerts_v5";
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
        NotificationChannel channel =
            new NotificationChannel(
                channelId, "Attendance & Duty Alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Clock In, Clock Out and System notifications");
        channel.enableVibration(true);
        channel.setShowBadge(true);
        nm.createNotificationChannel(channel);
      }

      Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
      PendingIntent pi =
          PendingIntent.getActivity(
              context,
              (int) System.currentTimeMillis(),
              launch != null ? launch : new Intent(),
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

      NotificationCompat.Builder builder =
          new NotificationCompat.Builder(context, channelId)
              .setContentTitle("👋 Shift Concluded")
              .setContentText("Duty shift has ended for today. Background tracking is now stopped.")
              .setStyle(
                  new NotificationCompat.BigTextStyle()
                      .bigText(
                          "Duty shift has ended for today. Please clock out if you haven't already. Background tracking is now stopped."))
              .setSmallIcon(R.drawable.ic_stat_notification)
              .setAutoCancel(true)
              .setContentIntent(pi)
              .setPriority(NotificationCompat.PRIORITY_HIGH)
              .setCategory(NotificationCompat.CATEGORY_EVENT)
              .setDefaults(NotificationCompat.DEFAULT_ALL)
              .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

      if (nm != null) {
        nm.notify(7001, builder.build());
      }
    } catch (Exception ignored) {}
  }
}
