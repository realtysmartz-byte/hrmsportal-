package in.realtysmartz.hrms;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class DutyTrackingReceiver extends BroadcastReceiver {
  public static final String ACTION_ALARM_TICK = "in.realtysmartz.hrms.DUTY_ALARM_TICK";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (context == null) return;

    SharedPreferences prefs = context.getSharedPreferences("duty_tracking", Context.MODE_PRIVATE);
    boolean isRunning = prefs.getBoolean("is_running", false);
    if (!isRunning) return;

    // Shift hours are 9:00 AM to 7:00 PM IST (09:00 to 19:00)
    java.util.Calendar cal =
        java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("Asia/Kolkata"));
    int hour = cal.get(java.util.Calendar.HOUR_OF_DAY);

    if (hour >= 19 || hour < 9) {
      prefs.edit().putBoolean("is_running", false).apply();
      showShiftEndNotification(context);
      return;
    }

    Intent serviceIntent = new Intent(context, DutyTrackingService.class);
    serviceIntent.setAction(DutyTrackingService.ACTION_ALARM_TICK);

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ContextCompat.startForegroundService(context, serviceIntent);
      } else {
        context.startService(serviceIntent);
      }
    } catch (Exception ignored) {
    }
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
              .setContentTitle("👋 Shift Concluded (7:00 PM)")
              .setContentText("Duty shift has ended for today. Please clock out if you haven't already. Background tracking stopped.")
              .setStyle(
                  new NotificationCompat.BigTextStyle()
                      .bigText("Duty shift has ended for today. Please clock out if you haven't already. Background tracking is now stopped."))
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
    } catch (Exception ignored) {
    }
  }
}
