import React from 'react';
import { render, screen, fireEventAsync as fireEvent } from '@testing-library/react-native';
import { Field } from './Field';
test('labels the editable field and forwards user input', async () => {
  const change = jest.fn(); render(<Field label="Description" value="" onChangeText={change} multiline />);
  await fireEvent.changeText(screen.getByLabelText('Description'), 'Thanks for lunch');
  expect(change).toHaveBeenCalledWith('Thanks for lunch');
});
