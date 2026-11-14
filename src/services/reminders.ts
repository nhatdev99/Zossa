import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ReminderSettings } from '../store/useReminderStore';

// Thông báo hiện cả khi đang mở app
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'reminders';

export type ReminderResult = 'ok' | 'denied';

/**
 * Đặt lại toàn bộ lịch nhắc theo cài đặt hiện tại (thông báo cục bộ, không cần mạng).
 * Gọi lại bao nhiêu lần cũng được: luôn xoá lịch cũ trước khi đặt mới.
 */
export async function applyReminders(settings: ReminderSettings): Promise<ReminderResult> {
  const anyEnabled =
    settings.checkIn.enabled || settings.checkOut.enabled || settings.payroll.enabled;

  if (anyEnabled) {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      perm = await Notifications.requestPermissionsAsync();
    }
    if (!perm.granted) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return 'denied';
    }
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!anyEnabled) return 'ok';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Nhắc nhở chấm công',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const weekly = async (
    weekday: number,
    hour: number,
    minute: number,
    title: string,
    body: string
  ) =>
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour,
        minute,
        channelId: CHANNEL_ID,
      },
    });

  for (const weekday of settings.weekdays) {
    if (settings.checkIn.enabled) {
      await weekly(
        weekday,
        settings.checkIn.hour,
        settings.checkIn.minute,
        'Đến giờ vào ca',
        'Mở Rosala và bấm Check In để bắt đầu chấm công.'
      );
    }
    if (settings.checkOut.enabled) {
      await weekly(
        weekday,
        settings.checkOut.hour,
        settings.checkOut.minute,
        'Sắp hết ca làm',
        'Đừng quên Check Out để ghi đủ giờ làm hôm nay.'
      );
    }
  }

  if (settings.payroll.enabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Chốt bảng lương',
        body: 'Xem lại bảng lương tháng vừa rồi và xuất CSV nếu cần.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: Math.min(Math.max(settings.payroll.day, 1), 28),
        hour: 9,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
  }

  return 'ok';
}
