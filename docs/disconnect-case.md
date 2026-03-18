Working case:
LOG Simulating characteristic error for 12ead13c-4d06-48b7-a3f9-cdf725acdd87
WARN 📡 Device disconnected during monitoring - BLE error: Device was disconnected
LOG 🔌 Handling unexpected disconnection...
LOG 🧹 Clearing device reference: 11:22:33:44:55:FF
LOG 📡 Emitting DISCONNECTION event with reason: unexpected
WARN 📡 Device disconnected: unexpected
LOG 📱 Navigating to unexpected-disconnect page
LOG ✅ Navigation to unexpected-disconnect successful
LOG ✅ Unexpected disconnection cleanup complete
LOG 🛑 Unsubscribing from BLE status events...
LOG 🔍 SetupBle starts...

Non working case:
LOG Simulating characteristic error for 12ead13c-4d06-48b7-a3f9-cdf725acdd87
WARN 📡 Device disconnected during monitoring - BLE error: Device was disconnected
LOG 🔌 Handling unexpected disconnection...
LOG 🧹 Clearing device reference: 11:22:33:44:55:EE
LOG 📡 Emitting DISCONNECTION event with reason: unexpected
WARN 📡 Device disconnected: unexpected
LOG 📱 Navigating to unexpected-disconnect page
LOG ✅ Navigation to unexpected-disconnect successful
LOG ✅ Unexpected disconnection cleanup complete
LOG 🛑 Unsubscribing from BLE status events...
LOG ℹ️ No selected device context in controller, returning to home (likely after reset/disconnect)
LOG 🔍 SetupBle starts...
