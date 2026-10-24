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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

/**
 * On-duty location service: reliable 1-hour periodic tracking that survives
 * Android Doze mode and screen-off suspend using AlarmManager and WakeLock.
 */
public class DutyTrackingService extends Service {
  public static final String ACTION_START = "in.realtysmartz.hrms.DUTY_START";
  public static final String ACTION_STOP = "in.realtysmartz.hrms.DUTY_STOP";
  public static final String ACTION_ALARM_TICK = "in.realtysmartz.hrms.DUTY_ALARM_TICK";
  public static final String EXTRA_INTERVAL_MS = "intervalMs";
  public static final String EXTRA_API_URL = "apiUrl";

  private static final String CHANNEL_ID = "duty_location";
  private static final String PREFS = "duty_tracking";
  private static final String KEY_LAST_PING_AT = "last_ping_at";
  private static final String KEY_INTERVAL_MS = "interval_ms";
  private static final String KEY_API_URL = "api_url";
  private static final String KEY_RUNNING = "is_running";
  private static final int NOTIFICATION_ID = 4401;
  private static final int ALARM_REQUEST_CODE = 4402;
  private static final long MIN_INTERVAL_MS = 60 * 60 * 1000L; // 1 hour
  private static final long LOCATION_TIMEOUT_MS = 25_000L; // 25s for GPS/Network lock
  private static final long MAX_FIX_AGE_MS = 5 * 60 * 1000L; // 5 min fix validity
  private static final long WAKELOCK_TIMEOUT_MS = 60_000L; // 60s partial wake lock

  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private long intervalMs = MIN_INTERVAL_MS;
  private String apiUrl = "https://rshrms.in/api/native/location-ping";
  private boolean running = false;

  private final Runnable tick =
      new Runnable() {
        @Override
        public void run() {
          if (!running) return;
          performWakefulPing();
        }
      };

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
    restoreState();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null) {
      if (running) {
        startForegroundNotification();
        scheduleNextAlarm(intervalMs);
      }
      return START_STICKY;
    }

    String action = intent.getAction();
    if (ACTION_STOP.equals(action)) {
      stopTracking();
      return START_NOT_STICKY;
    }

    if (ACTION_START.equals(action)) {
      long requested = intent.getLongExtra(EXTRA_INTERVAL_MS, MIN_INTERVAL_MS);
      intervalMs = Math.max(MIN_INTERVAL_MS, requested);
      String url = intent.getStringExtra(EXTRA_API_URL);
      if (url != null && url.length() > 0) {
        apiUrl = url;
      }
      saveState();
      startTracking();
      return START_STICKY;
    }

    if (ACTION_ALARM_TICK.equals(action)) {
      if (running) {
        startForegroundNotification();
        performWakefulPing();
      }
      return START_STICKY;
    }

    return START_STICKY;
  }

  private void restoreState() {
    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    running = prefs.getBoolean(KEY_RUNNING, false);
    intervalMs = prefs.getLong(KEY_INTERVAL_MS, MIN_INTERVAL_MS);
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

    if (running) {
      return;
    }
    running = true;
    saveState();
    handler.removeCallbacks(tick);

    long last = getLastPingAt();
    long elapsed = System.currentTimeMillis() - last;
    long delay;
    if (last <= 0 || elapsed >= intervalMs) {
      delay = 0L;
      performWakefulPing();
      scheduleNextAlarm(intervalMs);
    } else {
      delay = intervalMs - elapsed;
      scheduleNextAlarm(delay);
    }

    // Secondary UI-thread fallback if awake
    if (delay > 0) {
      handler.postDelayed(tick, delay);
    } else {
      handler.postDelayed(tick, intervalMs);
    }
  }

  private void stopTracking() {
    running = false;
    saveState();
    handler.removeCallbacks(tick);
    cancelAlarm();
    stopForeground(true);
    stopSelf();
  }

  private void scheduleNextAlarm(long delayMs) {
    AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;

    Intent intent = new Intent(this, DutyTrackingService.class);
    intent.setAction(ACTION_ALARM_TICK);
    intent.putExtra(EXTRA_INTERVAL_MS, intervalMs);
    intent.putExtra(EXTRA_API_URL, apiUrl);

    PendingIntent pi =
        PendingIntent.getService(
            this,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    long nextTriggerElapsed = SystemClock.elapsedRealtime() + Math.max(30_000L, delayMs);

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setExactAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
      } else {
        am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
      }
    } catch (SecurityException se) {
      // If exact alarm permission is restricted on Android 12+, fall back to windowed alarm
      am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTriggerElapsed, pi);
    }
  }

  private void cancelAlarm() {
    AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    Intent intent = new Intent(this, DutyTrackingService.class);
    intent.setAction(ACTION_ALARM_TICK);
    PendingIntent pi =
        PendingIntent.getService(
            this,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
    if (pi != null) {
      am.cancel(pi);
      pi.cancel();
    }
  }

  private void performWakefulPing() {
    executor.execute(
        () -> {
          PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
          PowerManager.WakeLock wakeLock = null;
          if (pm != null) {
            wakeLock =
                pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "rshrms:duty_location_tick");
            wakeLock.acquire(WAKELOCK_TIMEOUT_MS);
          }
          try {
            sendLocationPingIfDue();
          } finally {
            if (running) {
              scheduleNextAlarm(intervalMs);
              handler.removeCallbacks(tick);
              handler.postDelayed(tick, intervalMs);
            }
            if (wakeLock != null && wakeLock.isHeld()) {
              wakeLock.release();
            }
          }
        });
  }

  private long getLastPingAt() {
    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    return prefs.getLong(KEY_LAST_PING_AT, 0L);
  }

  private void setLastPingAt(long at) {
    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putLong(KEY_LAST_PING_AT, at).apply();
  }

  private void sendLocationPingIfDue() {
    long last = getLastPingAt();
    long now = System.currentTimeMillis();
    if (last > 0 && now - last < intervalMs - 5_000L) {
      return;
    }
    sendLocationPing();
  }

  private void sendLocationPing() {
    try {
      if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
              != PackageManager.PERMISSION_GRANTED
          && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
              != PackageManager.PERMISSION_GRANTED) {
        return;
      }

      Location loc = getFreshLocation();
      if (loc == null
          || !loc.hasAccuracy()
          || loc.getAccuracy() <= 0
          || loc.getAccuracy() >= 50_000) {
        return;
      }

      JSONObject body = new JSONObject();
      body.put("lat", loc.getLatitude());
      body.put("lng", loc.getLongitude());
      body.put("accuracyM", loc.getAccuracy());
      body.put("fixTimestamp", loc.getTime());
      body.put("isMockLocation", isMockFix(loc));
      body.put(
          "address",
          String.format("%.5f, %.5f", loc.getLatitude(), loc.getLongitude()));

      URL url = new URL(apiUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setConnectTimeout(25000);
      conn.setReadTimeout(25000);
      conn.setRequestMethod("POST");
      conn.setDoOutput(true);
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setRequestProperty("Accept", "application/json");

      try {
        CookieManager.getInstance().flush();
      } catch (Exception ignored) {
      }

      String cookie = CookieManager.getInstance().getCookie("https://rshrms.in");
      if (cookie == null || cookie.length() == 0) {
        cookie = CookieManager.getInstance().getCookie(apiUrl);
      }
      if (cookie != null && cookie.length() > 0) {
        conn.setRequestProperty("Cookie", cookie);
      }

      byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
      conn.setRequestProperty("Content-Length", String.valueOf(bytes.length));
      try (OutputStream os = conn.getOutputStream()) {
        os.write(bytes);
      }

      int code = conn.getResponseCode();
      if (code >= 200 && code < 300) {
        setLastPingAt(System.currentTimeMillis());
      } else if (code == 400) {
        // Only stop tracking if server explicitly returned { stopTracking: true }
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
              handler.post(this::stopTracking);
            }
          }
        } catch (Exception ignored) {
        }
      }
      conn.disconnect();
    } catch (Exception ignored) {
      // Keep service alive; retry on next interval
    }
  }

  static boolean isMockFix(Location loc) {
    if (loc == null) return false;
    if (Build.VERSION.SDK_INT >= 31) {
      return loc.isMock();
    }
    return loc.isFromMockProvider();
  }

  /** Last known fix if newer than MAX_FIX_AGE_MS. Must not run on the UI thread. */
  Location recentLastKnown() {
    final LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
    if (lm == null) return null;
    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
      return null;
    }
    try {
      Location gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
      Location net = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
      long now = System.currentTimeMillis();
      Location best = isRecentFix(gps, now) ? gps : null;
      if (isRecentFix(net, now)
          && (best == null
              || (net.hasAccuracy()
                  && (!best.hasAccuracy() || net.getAccuracy() < best.getAccuracy())))) {
        best = net;
      }
      return best;
    } catch (SecurityException ignored) {
    }
    return null;
  }

  private boolean isRecentFix(Location location, long now) {
    if (location == null) return false;
    long age = now - location.getTime();
    return age >= 0 && age <= MAX_FIX_AGE_MS;
  }

  /**
   * Balanced-power fresh fix: requests both GPS & Network updates, waits up to 25s,
   * counts down early if accuracy <= 100m.
   */
  private Location getFreshLocation() {
    Location recent = recentLastKnown();
    if (recent != null && recent.hasAccuracy() && recent.getAccuracy() <= 100) {
      return recent;
    }

    final LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
    if (lm == null) return recent;

    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
      return recent;
    }

    final AtomicReference<Location> result = new AtomicReference<>(recent);
    final CountDownLatch latch = new CountDownLatch(1);

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

          @Override
          public void onStatusChanged(String provider, int status, Bundle extras) {}

          @Override
          public void onProviderEnabled(String provider) {}

          @Override
          public void onProviderDisabled(String provider) {}
        };

    handler.post(
        () -> {
          try {
            boolean gpsAvailable = false;
            boolean netAvailable = false;
            try {
              gpsAvailable = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
            } catch (Exception ignored) {
            }
            try {
              netAvailable = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            } catch (Exception ignored) {
            }

            if (gpsAvailable) {
              lm.requestLocationUpdates(
                  LocationManager.GPS_PROVIDER, 1000L, 0f, listener, Looper.getMainLooper());
            }
            if (netAvailable) {
              lm.requestLocationUpdates(
                  LocationManager.NETWORK_PROVIDER, 1000L, 0f, listener, Looper.getMainLooper());
            }
            if (!gpsAvailable && !netAvailable) {
              latch.countDown();
            }
          } catch (SecurityException e) {
            latch.countDown();
          }
        });

    try {
      latch.await(LOCATION_TIMEOUT_MS, TimeUnit.MILLISECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    handler.post(
        () -> {
          try {
            lm.removeUpdates(listener);
          } catch (Exception ignored) {
          }
        });

    Location finalLoc = result.get();
    return finalLoc != null ? finalLoc : recent;
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel =
        new NotificationChannel(
            CHANNEL_ID, "On-duty location", NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("Shows while attendance location tracking is active");
    channel.setShowBadge(false);
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm != null) nm.createNotificationChannel(channel);
  }

  private Notification buildNotification() {
    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent pi =
        PendingIntent.getActivity(
            this,
            0,
            launch != null ? launch : new Intent(),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    return new NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("RS HRMS")
        .setContentText("On duty — location every 1 hour")
        .setSmallIcon(R.mipmap.ic_launcher)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setContentIntent(pi)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build();
  }

  @Override
  public void onDestroy() {
    running = false;
    handler.removeCallbacks(tick);
    cancelAlarm();
    executor.shutdownNow();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
