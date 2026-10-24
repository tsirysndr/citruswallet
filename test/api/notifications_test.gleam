import peachlet/notification_worker
import peachlet/notifications

pub fn expo_tokens_reject_urls_and_invalid_characters_test() {
  assert notifications.valid_expo_token("ExpoPushToken[abc_123-XYZ]")
  assert notifications.valid_expo_token("ExponentPushToken[abc_123-XYZ]")
  assert !notifications.valid_expo_token("ExpoPushToken[]")
  assert !notifications.valid_expo_token("ExpoPushToken[hello world]")
  assert !notifications.valid_expo_token("https://example.com")
}

pub fn notification_retry_policy_is_bounded_and_preserves_receipts_test() {
  assert notification_worker.retry_delay(1) == 10_000
  assert notification_worker.retry_delay(2) == 20_000
  assert notification_worker.retry_delay(30) == 3_600_000
  assert notification_worker.retry_state(1, False) == "pending"
  assert notification_worker.retry_state(1, True) == "receipt"
  assert notification_worker.retry_state(8, True) == "failed"
  assert notification_worker.retry_state(8, False) == "failed"
}
