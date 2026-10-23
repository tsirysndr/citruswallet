module.exports = api => {
  const testing = api.env('test');
  return { presets: testing ? ['babel-preset-expo'] : [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'] };
};
