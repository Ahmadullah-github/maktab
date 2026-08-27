const { buildReleaseInputs } = require('./release-inputs');

exports.default = async function beforePack() {
  buildReleaseInputs({ write: true });
};
