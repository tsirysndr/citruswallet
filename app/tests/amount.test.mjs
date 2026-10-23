import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editAmount, amountWei, formatWei } from '../src/amount.ts';
test('keypad edits decimal amounts without floating-point rounding',()=>{
  let value='0';for(const key of ['0',',','0','0','1'])value=editAmount(value,key);
  assert.equal(value,'0.001');assert.equal(amountWei(value),1000000000000000n);
  assert.equal(editAmount(value,'.'),value);assert.equal(editAmount(value,'backspace'),'0.00');
  assert.equal(editAmount('0','backspace'),'0');assert.equal(editAmount('1','e'),'1');
  assert.equal(editAmount('0.123456789012345678','9'),'0.123456789012345678');
  assert.equal(amountWei('0.000000000000000001'),1n);
  assert.throws(()=>amountWei('1e5'));assert.throws(()=>amountWei('-1'));
  assert.equal(formatWei(1234567890123456789012n),'1,234.567890123456789012');
});
