import gleam/list
import peachlet/xrpc/price

pub fn rates_must_be_positive_decimal_strings_test() {
  list.each(["1", "0.001", "2345.67"], fn(value) {
    assert price.valid_rate(value)
  })
  list.each(
    ["0", "-1", "NaN", "Infinity", "1e4", "1,234", "1.2.3", "", " 2 "],
    fn(value) {
      assert !price.valid_rate(value)
    },
  )
}
