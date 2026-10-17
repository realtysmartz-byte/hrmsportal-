package in.realtysmartz.hrms;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Criteria;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.webkit.CookieManager;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
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
 * On-duty location: at most one fresh GPS ping every 30 minutes.
 * Uses a real location fix (not cached lastKnownLocation).
 */
public class DutyTrackingService extends Service {
  public static final String ACTION_START = "in.realtysmartz.hrms.DUTY_START";
  public static final String ACTION_STOP = "in.realtysmartz.hrms.DUTY_STOP";
  public static final String EXTRA_INTERVAL_MS = "intervalMs";
  public static final String EXTRA_API_URL = "apiUrl";

  private static final String CHANNEL_ID = "duty_location";
  private static final String PREFS = "duty_tracking";
  private static final String KEY_LAST_PING_AT = "last_ping_at";
  private static final int NOTIFICATION_ID = 4401;
  private static final long MIN_INTERVAL_MS = 60 * 60 * 1000L; // 1 hour
  private static final long LOCATION_TIMEOUT_MS = 25_000L;
  private static final long MAX_FIX_AGE_MS = 2 * 60 * 1000L;

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
          executor.execute(() -> {
            sendLocationPingIfDue();
            handler.postDelayed(tick, intervalMs);
          });
        }
      };

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null) {
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
      startTracking();
    }

    return START_STICKY;
  }

  private void startTracking() {
    Notification notification = buildNotification();
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(
          NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }

    if (running) {
      return;
    }
    running = true;
    handler.removeCallbacks(tick);

    // Do not ping on every app reopen — only when 30 minutes have elapsed.
    long last = getLastPingAt();
    long elapsed = System.currentTimeMillis() - last;
    if (last <= 0 || elapsed >= intervalMs) {
      executor.execute(this::sendLocationPingIfDue);
      handler.postDelayed(tick, intervalMs);
    } else {
      handler.postDelayed(tick, intervalMs - elapsed);
    }
  }

  private void stopTracking() {
    running = false;
    handler.removeCallbacks(tick);
    stopForeground(true);
    stopSelf();
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
      if (loc == null) {
        return;
      }

      JSONObject body = new JSONObject();
      body.put("lat", loc.getLatitude());
      body.put("lng", loc.getLongitude());
      body.put("accuracyM", loc.hasAccuracy() ? loc.getAccuracy() : JSONObject.NULL);
      body.put(
          "address",
          String.format("%.5f, %.5f", loc.getLatitude(), loc.getLongitude()));

      URL url = new URL(apiUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setConnectTimeout(20000);
      conn.setReadTimeout(20000);
      conn.setRequestMethod("POST");
      conn.setDoOutput(true);
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setRequestProperty("Accept", "application/json");

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
      // Always advance local gate on success (including server "skipped" throttle)
      if (code >= 200 && code < 300) {
        setLastPingAt(System.currentTimeMillis());
      } else if (code == 400) {
        handler.post(this::stopTracking);
      }
      conn.disconnect();
    } catch (Exception e) {
      // Keep service alive; retry on next interval
    }
  }

  /** Request a fresh GPS/network fix; ignore stale lastKnownLocation. */
  private Location getFreshLocation() {
    final LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
    if (lm == null) return null;

    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
      return null;
    }

    final AtomicReference<Location> result = new AtomicReference<>();
    final CountDownLatch latch = new CountDownLatch(1);

    final LocationListener listener =
        new LocationListener() {
          @Override
          public void onLocationChanged(Location location) {
            if (location == null) return;
            Location prev = result.get();
            if (prev == null || location.getAccuracy() <= prev.getAccuracy()) {
              result.set(location);
            }
            if (location.getAccuracy() > 0 && location.getAccuracy() <= 50) {
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
            Criteria criteria = new Criteria();
            criteria.setAccuracy(Criteria.ACCURACY_FINE);
            criteria.setAltitudeRequired(false);
            criteria.setBearingRequired(false);
            criteria.setSpeedRequired(false);
            String best = lm.getBestProvider(criteria, true);
            if (best != null) {
              lm.requestLocationUpdates(best, 0L, 0f, listener, Looper.getMainLooper());
            }
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
              lm.requestLocationUpdates(
                  LocationManager.GPS_PROVIDER, 0L, 0f, listener, Looper.getMainLooper());
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
              lm.requestLocationUpdates(
                  LocationManager.NETWORK_PROVIDER, 0L, 0f, listener, Looper.getMainLooper());
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

    Location fresh = result.get();
    if (fresh != null) {
      return fresh;
    }

    // Fallback only if last known is recent (< 2 min)
    try {
      Location gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
      Location net = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
      Location best = null;
      if (gps != null) best = gps;
      if (net != null && (best == null || net.getAccuracy() < best.getAccuracy())) best = net;
      if (best != null && System.currentTimeMillis() - best.getTime() <= MAX_FIX_AGE_MS) {
        return best;
      }
    } catch (SecurityException ignored) {
    }
    return null;
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
    executor.shutdownNow();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
