"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const ANDROID_CHANNEL_ID = "qawmierp_alerts";
let channelInitialized = false;
let bridgeInitialized = false;

async function ensureChannelAndPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== "granted") {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== "granted") {
        return false;
      }
    }

    if (!channelInitialized && Capacitor.getPlatform() === "android") {
      await LocalNotifications.createChannel({
        id: ANDROID_CHANNEL_ID,
        name: "QawmiERP Notifications",
        description: "Alerts, fees, attendance, and system notifications",
        importance: 5,
        visibility: 1,
        sound: "default",
        vibration: true,
      });
      channelInitialized = true;
    }

    return true;
  } catch {
    return false;
  }
}

export async function sendNativeStatusBarNotification(params: {
  title: string;
  body: string;
  route?: string;
  id?: number;
}): Promise<void> {
  const allowed = await ensureChannelAndPermission();
  if (!allowed) return;

  const notifId =
    params.id ?? Math.floor((Date.now() % 100000000) + Math.random() * 1000);

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: params.title,
          body: params.body,
          channelId: ANDROID_CHANNEL_ID,
          extra: params.route ? { route: params.route } : undefined,
        },
      ],
    });
  } catch {
    // Ignore scheduling errors
  }
}

export function initWebNotificationBridge(): () => void {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform() || bridgeInitialized) {
    return () => {};
  }

  bridgeInitialized = true;
  ensureChannelAndPermission().catch(() => {});

  let actionHandle: { remove: () => Promise<void> } | null = null;
  LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const route = event.notification?.extra?.route;
    if (typeof route === "string" && route.startsWith("/")) {
      window.location.href = route;
    }
  })
    .then((handle) => {
      actionHandle = handle;
    })
    .catch(() => {});

  // Bridge standard browser `new Notification(title, options)` to Android Status Bar
  const OriginalNotification = window.Notification;
  if (typeof OriginalNotification !== "undefined") {
    const BridgedNotification = function (
      title: string,
      options?: NotificationOptions
    ) {
      sendNativeStatusBarNotification({
        title,
        body: options?.body || "",
      }).catch(() => {});

      try {
        return new OriginalNotification(title, options);
      } catch {
        return {} as Notification;
      }
    } as unknown as typeof Notification;

    Object.defineProperty(BridgedNotification, "permission", {
      get: () => "granted",
      configurable: true,
    });
    BridgedNotification.requestPermission = async () => {
      const ok = await ensureChannelAndPermission();
      return ok ? "granted" : "denied";
    };

    try {
      window.Notification = BridgedNotification;
    } catch {
      // Ignore if read-only in some WebViews
    }
  }

  return () => {
    actionHandle?.remove().catch(() => {});
  };
}
