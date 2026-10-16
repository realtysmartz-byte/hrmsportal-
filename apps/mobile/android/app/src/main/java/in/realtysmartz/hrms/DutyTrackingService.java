package in.realtysmartz.hrms;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.webkit.CookieManager;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Foreground service: while the employee is on duty, send GPS to the HRMS API
 * every 30 minutes. Android requires a persistent notification for this —
 * it is not a push reminder, only a system "location in use" indicator.
 */
public class DutyTrackingService extends Service {
  public static final String ACTION_START = "in.realtysmartz.hrms.DUTY_START";
  public static final String ACTION_STOP = "in.realtysmartz.hrms.DUTY_STOP";
  public static final String EXTRA_INTERVAL_MS = "intervalMs";
  public static final String EXTRA_API_URL = "apiUrl";

  private static final String CHANNEL_ID = "duty_location";
  private static final int NOTIFICATION_ID = 4401;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private long intervalMs = 30 * 60 * 1000L;
  private String apiUrl = "https://rshrms.in/api/native/location-ping";
  private boolean running = false;

  private final Runnable tick =
      new Runnable() {
        @Override
        public void run() {
          if (!running) return;
          executor.execute(() -> sendLocationPing());
          handler.postDelayed(this, intervalMs);
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
      intervalMs = intent.getLongExtra(EXTRA_INTERVAL_MS, 30 * 60 * 1000L);
      if (intervalMs < 5 * 60 * 1000L) {
        intervalMs = 5 * 60 * 1000L;
      }
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
    // Immediate ping, then every interval
    executor.execute(this::sendLocationPing);
    handler.postDelayed(tick, intervalMs);
  }

  private void stopTracking() {
    running = false;
    handler.removeCallbacks(tick);
    stopForeground(true);
    stopSelf();
  }

  private void sendLocationPing() {
    try {
      if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
              != PackageManager.PERMISSION_GRANTED
          && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
              != PackageManager.PERMISSION_GRANTED) {
        return;
      }

      LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
      Location loc = null;
      if (lm != null) {
        loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        if (loc == null) {
          loc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
        }
      }
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
      if (code == 400) {
        // Not on duty anymore — stop service
        handler.post(this::stopTracking);
      }
      conn.disconnect();
    } catch (Exception e) {
      // Keep service alive; retry on next interval
    }
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
        .setContentText("On duty — location tracking active")
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
