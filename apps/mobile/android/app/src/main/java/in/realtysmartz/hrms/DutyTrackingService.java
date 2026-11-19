package in.realtysmartz.hrms;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.webkit.CookieManager;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * On-duty location service: reliable periodic tracking that survives
 * Android Doze mode, app swipe from recents, and task close across all Android versions.
 * Runs silently without cluttering the status bar, and delivers real-time notifications
 * for target assignments and leave approvals immediately.
 */
public class DutyTrackingService extends Service {

  public static final String ACTION_START = "in.realtysmartz.hrms.DUTY_START";
  public static final String ACTION_STOP = "in.realtysmartz.hrms.DUTY_STOP";
  public static final String ACTION_ALARM_TICK = "in.realtysmartz.hrms.DUTY_ALARM_TICK";
  public static final String EXTRA_INTERVAL_MS = "intervalMs";
  public static final String EXTRA_API_URL = "apiUrl";

  private static final String CHANNEL_ID_SILENT = "duty_sync_silent_v2";
  private static final String CHANNEL_ID_ALERTS = "hrms_user_alerts_v2";
  private static final String PREFS = "duty_tracking";
  private static final String KEY_LAST_PING_AT = "last_ping_at";
  private static final String KEY_INTERVAL_MS = "interval_ms";
  private static final String KEY_API_URL = "api_url";
  private static final String KEY_RUNNING = "is_running";
  private static final int NOTIFICATION_ID = 4401;
  private static final int ALARM_REQUEST_CODE = 4402;
  private static final long DEFAULT_INTERVAL_MS = 60 * 60 * 1000L; // 1 hour

  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ExecutorService executor = Executors.newCachedThreadPool();
  private boolean running = false;
  private long intervalMs = DEFAULT_INTERVAL_MS;
  private String apiUrl = "https://rshrms.in/api/native/location-ping";

  private boolean isWithinDutyHours() {
    java.util.Calendar cal =
        java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("Asia/Kolkata"));
    int hour = cal.get(java.util.Calendar.HOUR_OF_DAY);
    // Active duty window covers morning punch-ins through late shift (08:00 to 21:00 IST)
    return hour >= 8 && hour < 21;
  }

  // Periodic notification checker (every 45s) to deliver target and leave alerts immediately
  private final Runnable notificationSyncRunnable =
      new Runnable() {
        @Override
        public void run() {
          if (!running) return;
          executor.execute(
              () -> {
                try {
                  syncPendingNotifications();
                } catch (Exception ignored) {
                } finally {
                  if (running) {
                    handler.postDelayed(notificationSyncRunnable, 45_000L);
                  }
                }
              });
        }
      };

  @Override
  public void onCreate() {
    super.onCreate();
    ensureSilentChannel();
    ensureAlertsChannel();
    startForegroundNotification();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    restoreState();
    String action = intent != null ? intent.getAction() : null;

    if (ACTION_STOP.equals(action)) {
      stopTracking();
      return START_NOT_STICKY;
    }

    if (intent != null) {
      long customInterval = intent.getLongExtra(EXTRA_INTERVAL_MS, 0L);
      if (customInterval >= 60_000L) {
        intervalMs = customInterval;
      }
      String customUrl = intent.getStringExtra(EXTRA_API_URL);
      if (customUrl != null && !customUrl.trim().isEmpty()) {
        apiUrl = customUrl.trim();
      }
    }

    startTracking();
    return START_STICKY;
  }

  private void restoreState() {
    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    running = prefs.getBoolean(KEY_RUNNING, false);
    intervalMs = prefs.getLong(KEY_INTERVAL_MS, DEFAULT_INTERVAL_MS);
    apiUrl = prefs.getString(KEY_API_URL, "https://rshrms.in/api/native/location-ping");
  }

  private void saveState() {
    getSharedPreferences(PREFS, MODE_PRIVATE)
        .edit()
        .putBoolean(KEY_RUNNING, running)
        .putLong(KEY_INTERVAL_MS, intervalMs)
        .putString(KEY_API_URL, apiUrl)
        .apply();
  }

  private void ensureSilentChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) {
        NotificationChannel channel =
            new NotificationChannel(
                CHANNEL_ID_SILENT,
                "Duty Sync Service",
                NotificationManager.IMPORTANCE_MIN);
        channel.setDescription("Silent background location and notification sync");
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
        channel.enableVibration(false);
        channel.setSound(null, null);
        nm.createNotificationChannel(channel);
      }
    }
  }

  private void ensureAlertsChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) {
        NotificationChannel channel =
            new NotificationChannel(
                CHANNEL_ID_ALERTS,
                "HRMS Tasks & Alerts",
                NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Real-time notifications for target assignments, approvals, and duty alerts");
        channel.setShowBadge(true);
        channel.enableVibration(true);
        nm.createNotificationChannel(channel);
      }
    }
  }

  private Notification buildNotification() {
    ensureSilentChannel();
    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent pi =
        PendingIntent.getActivity(
            this,
            0,
            launch != null ? launch : new Intent(),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    return new NotificationCompat.Builder(this, CHANNEL_ID_SILENT)
        .setContentTitle("Realty Smartz HRMS")
        .setContentText("Background service active")
        .setSmallIcon(R.drawable.ic_stat_notification)
        .setOngoing(true)
        .setAutoCancel(false)
        .setShowWhen(false)
        .setOnlyAlertOnce(true)
        .setContentIntent(pi)
        .setPriority(NotificationCompat.PRIORITY_MIN)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setVisibility(NotificationCompat.VISIBILITY_SECRET)
        .build();
  }

  private void startForegroundNotification() {
    Notification notification = buildNotification();
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(
          NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }
  }

  private void startTracking() {
    startForegroundNotification();
    running = true;
    saveState();

    handler.removeCallbacks(notificationSyncRunnable);
    handler.post(notificationSyncRunnable);

    DutyTrackingReceiver.scheduleNextAlarm(this, intervalMs);
  }

  private void stopTracking() {
    running = false;
    saveState();
    handler.removeCallbacks(notificationSyncRunnable);
    DutyTrackingReceiver.cancelAlarm(this);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(Service.STOP_FOREGROUND_REMOVE);
    } else {
      stopForeground(true);
    }
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) {
      nm.cancel(NOTIFICATION_ID);
    }
    stopSelf();
  }

  /**
   * CRITICAL: Called when user swipes the app away from recent apps.
   * Immediately takes a location punch ("App closed / swiped from recents")
   * and schedules the restart of the service & alarms so tracking continues seamlessly.
   */
  @Override
  public void onTaskRemoved(Intent rootIntent) {
    super.onTaskRemoved(rootIntent);

    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
    PowerManager.WakeLock wakeLock = null;
    if (pm != null) {
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "rshrms:app_close_punch");
      wakeLock.acquire(30_000L);
    }
    final PowerManager.WakeLock wl = wakeLock;

    executor.execute(
        () -> {
          try {
            sendLocationPingInternal(true /* isAppClose */);
            syncPendingNotifications();
          } finally {
            if (wl != null && wl.isHeld()) {
              wl.release();
            }
          }
        });

    // Ensure next alarm is scheduled to continue hourly tracking
    DutyTrackingReceiver.scheduleNextAlarm(this, intervalMs);

    // Restart service so Android doesn't kill the background tracking on aggressive skins (MIUI, ColorOS, etc.)
    try {
      Intent restartServiceIntent = new Intent(getApplicationContext(), DutyTrackingService.class);
      restartServiceIntent.setPackage(getPackageName());
      PendingIntent restartServicePendingIntent =
          PendingIntent.getService(
              getApplicationContext(),
              1,
              restartServiceIntent,
              PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
      AlarmManager alarmService = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
      if (alarmService != null) {
        alarmService.set(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 1500L,
            restartServicePendingIntent);
      }
    } catch (Exception ignored) {}
  }

  public void sendLocationPingInternal(boolean isAppClose) {
    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);

    boolean finePerm =
        ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    boolean coarsePerm =
        ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    boolean isGpsEnabled =
        lm != null
            && (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));

    if (!finePerm && !coarsePerm) {
      DutyTrackingReceiver.reportLocationDisabled(this, "Location permission revoked on device");
      DutyTrackingReceiver.sendNullLocationPing(this, "Location permission revoked");
      return;
    }

    if (!isGpsEnabled) {
      DutyTrackingReceiver.reportLocationDisabled(
          this, "Device GPS / Location switched OFF in Android quick settings while on active duty");
      DutyTrackingReceiver.sendNullLocationPing(
          this, isAppClose ? "App closed with GPS turned OFF" : "Device GPS turned OFF");
      return;
    }

    Location loc = getFreshLocationWithFallback();
    if (loc == null || (loc.getLatitude() == 0.0 && loc.getLongitude() == 0.0)) {
      return;
    }

    if (isMockFix(loc, this)) {
      DutyTrackingReceiver.reportLocationDisabled(this, "Fake GPS / Mock Location detected on device");
      return;
    }

    try {
      String pingApi = prefs.getString(KEY_API_URL, apiUrl);
      JSONObject body = new JSONObject();
      body.put("lat", loc.getLatitude());
      body.put("lng", loc.getLongitude());
      body.put("accuracyM", loc.hasAccuracy() ? loc.getAccuracy() : 25.0);
      body.put("fixTimestamp", System.currentTimeMillis());
      body.put("isMockLocation", false);
      body.put("isAppClose", isAppClose);
      body.put("force", isAppClose);
      body.put(
          "address",
          String.format("%.5f, %.5f%s", loc.getLatitude(), loc.getLongitude(), isAppClose ? " · App closed / swiped from recents" : ""));

      String employeeId = prefs.getString("employee_id", "");
      String dutyToken = prefs.getString("duty_token", "");
      String employeeEmail = prefs.getString("employee_email", "");
      if (!employeeId.isEmpty()) body.put("employeeId", employeeId);
      if (!dutyToken.isEmpty()) body.put("dutyToken", dutyToken);
      if (!employeeEmail.isEmpty()) body.put("employeeEmail", employeeEmail);

      URL url = new URL(pingApi);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setConnectTimeout(20000);
      conn.setReadTimeout(20000);
      conn.setRequestMethod("POST");
      conn.setDoOutput(true);
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setRequestProperty("Accept", "application/json");

      if (!employeeId.isEmpty()) conn.setRequestProperty("x-employee-id", employeeId);
      if (!dutyToken.isEmpty()) conn.setRequestProperty("x-duty-token", dutyToken);

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
        prefs.edit().putLong(KEY_LAST_PING_AT, System.currentTimeMillis()).apply();
      }
      conn.disconnect();
    } catch (Exception ignored) {}
  }

  /**
   * Resilient location resolver: attempts GPS, Network, and Passive providers.
   * If GPS fix is slow/indoors, falls back to best available last known fix so pings are NEVER lost.
   */
  private Location getFreshLocationWithFallback() {
    final LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
    if (lm == null) return null;

    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
      return null;
    }

    Location gps = null, net = null, passive = null;
    try {
      gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
      net = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
      passive = lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
    } catch (SecurityException ignored) {}

    Location best = null;
    if (gps != null) best = gps;
    if (net != null) {
      if (best == null || (net.getTime() > best.getTime())) best = net;
    }
    if (passive != null) {
      if (best == null || (passive.getTime() > best.getTime())) best = passive;
    }

    long now = System.currentTimeMillis();
    // If we have a very fresh fix (under 2 minutes old with decent accuracy), use it immediately
    if (best != null && (now - best.getTime() < 2 * 60 * 1000L) && best.hasAccuracy() && best.getAccuracy() <= 80) {
      return best;
    }

    final AtomicReference<Location> result = new AtomicReference<>(best);
    final CountDownLatch latch = new CountDownLatch(1);

    HandlerThread ht = new HandlerThread("duty_loc_fallback");
    ht.start();
    Handler locHandler = new Handler(ht.getLooper());

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

    locHandler.post(
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
      latch.await(12000L, TimeUnit.MILLISECONDS);
    } catch (InterruptedException ignored) {}

    locHandler.post(
        () -> {
          try { lm.removeUpdates(listener); } catch (Exception ignored) {}
          ht.quitSafely();
        });

    Location finalLoc = result.get();
    return finalLoc != null ? finalLoc : best;
  }

  /**
   * Syncs real-time notifications (target assignments, leave approvals, etc.)
   * and fires an immediate HIGH PRIORITY heads-up alert with sound and banner.
   */
  public void syncPendingNotifications() {
    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    String employeeId = prefs.getString("employee_id", "");
    String employeeEmail = prefs.getString("employee_email", "");
    if (employeeId.isEmpty() && employeeEmail.isEmpty()) return;

    try {
      String syncUrl = "https://rshrms.in/api/native/sync-notifications?employeeId="
          + java.net.URLEncoder.encode(employeeId, "UTF-8")
          + "&employeeEmail="
          + java.net.URLEncoder.encode(employeeEmail, "UTF-8");

      URL url = new URL(syncUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setConnectTimeout(12000);
      conn.setReadTimeout(12000);
      conn.setRequestMethod("GET");
      conn.setRequestProperty("Accept", "application/json");

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

      int code = conn.getResponseCode();
      if (code == 200) {
        InputStream is = conn.getInputStream();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[1024];
        int n;
        while ((n = is.read(buf)) != -1) {
          baos.write(buf, 0, n);
        }
        String resp = baos.toString("UTF-8");
        JSONObject json = new JSONObject(resp);
        if (json.optBoolean("ok", false)) {
          JSONArray arr = json.optJSONArray("notifications");
          if (arr != null && arr.length() > 0) {
            Set<String> shown =
                new HashSet<>(prefs.getStringSet("shown_notification_ids", new HashSet<>()));
            boolean modified = false;

            for (int i = 0; i < arr.length(); i++) {
              JSONObject item = arr.getJSONObject(i);
              String notifId = item.getString("id");
              if (!shown.contains(notifId)) {
                String title = item.optString("title", "HRMS Notification");
                String body = item.optString("body", "");
                showUserAlertNotification(title, body, Math.abs(notifId.hashCode()));
                shown.add(notifId);
                modified = true;
              }
            }

            if (modified) {
              prefs.edit().putStringSet("shown_notification_ids", shown).apply();
            }
          }
        }
      }
      conn.disconnect();
    } catch (Exception ignored) {}
  }

  private void showUserAlertNotification(String title, String body, int notifId) {
    try {
      NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm == null) return;
      ensureAlertsChannel();

      Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
      PendingIntent pi = PendingIntent.getActivity(
          this,
          notifId,
          launch != null ? launch : new Intent(),
          PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

      Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID_ALERTS)
          .setContentTitle(title)
          .setContentText(body)
          .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
          .setSmallIcon(R.drawable.ic_stat_notification)
          .setAutoCancel(true)
          .setContentIntent(pi)
          .setPriority(NotificationCompat.PRIORITY_HIGH)
          .setDefaults(Notification.DEFAULT_ALL)
          .build();

      nm.notify(notifId, notif);
    } catch (Exception ignored) {}
  }

  public static boolean isMockFix(Location loc, Context ctx) {
    if (loc == null) return false;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (loc.isMock()) return true;
    } else if (Build.VERSION.SDK_INT >= 18) {
      if (loc.isFromMockProvider()) return true;
    }
    Bundle extras = loc.getExtras();
    if (extras != null && extras.getBoolean("mockLocation", false)) {
      return true;
    }
    return ctx != null && isMockLocationAppActive(ctx);
  }

  public static boolean isMockLocationAppActive(Context context) {
    if (context == null) return false;
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        android.app.AppOpsManager appOps =
            (android.app.AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
        if (appOps != null) {
          int mode = appOps.checkOpNoThrow(
              android.app.AppOpsManager.OPSTR_MOCK_LOCATION,
              android.os.Process.myUid(),
              context.getPackageName());
          return mode == android.app.AppOpsManager.MODE_ALLOWED;
        }
      } else {
        return !android.provider.Settings.Secure.getString(
            context.getContentResolver(),
            android.provider.Settings.Secure.ALLOW_MOCK_LOCATION).equals("0");
      }
    } catch (Exception ignored) {}
    return false;
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(notificationSyncRunnable);
    executor.shutdownNow();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
