const next = require("eslint-config-next");

module.exports = [
  ...next,
  {
    ignores: [
      ".claude/**",
      "dashboard/project/**",
      "public/dashboard/**",
      "marketing/**",
    ],
  },
];
