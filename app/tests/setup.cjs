jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Ionicons: props => React.createElement(Text, props, props.name), Feather: props => React.createElement(Text, props, props.name) };
});
jest.mock('expo-image', () => ({ Image: require('react-native').Image }));

require('@testing-library/react-native').configure({ asyncUtilTimeout: 5000 });
