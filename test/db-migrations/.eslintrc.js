module.exports = {
  extends: '../.eslintrc.js',
  rules: {
    'no-use-before-define': 'off',
  },
  globals: {
    db: false,
    log: false,
    sql: false,
  },
};
