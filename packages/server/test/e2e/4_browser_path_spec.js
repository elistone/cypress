/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require("path");
const {
  exec
} = require("child_process");

const e2e = require("../support/helpers/e2e").default;
const Fixtures = require("../support/helpers/fixtures");
const launcher = require("@packages/launcher");

const absPath = pathStr => new Promise(function(resolve, reject) {
  if (path.basename(pathStr) !== pathStr) {
    return resolve(pathStr);
  }
  return exec(`which ${pathStr}`, function(err, stdout) {
    if (err) {
      return reject(err);
    }
    return resolve(stdout.trim());
  });
});

describe("e2e launching browsers by path", function() {
  e2e.setup();

  it("fails with bad browser path", function() {
    return e2e.exec(this, {
      project: Fixtures.projectPath("e2e"),
      spec: "simple_spec.coffee",
      browser: '/this/aint/gonna/be/found',
      expectedExitCode: 1
    })
    .then(res => {
      expect(res.stdout).to.contain("We could not identify a known browser at the path you provided: `/this/aint/gonna/be/found`");
      return expect(res.code).to.eq(1);
    });
  });

  return it("works with an installed browser path", function() {
    return launcher.detect().then(browsers => {
      return browsers.find(browser => {
        return browser.family === "chromium";
      });
  }).tap(browser => {
      if (!browser) {
        throw new Error("A 'chromium' family browser must be installed for this test");
      }
    }).get("path")
    //# turn binary browser names ("google-chrome") into their absolute paths
    //# so that server recognizes them as a path, not as a browser name
    .then((absPath))
    .then(foundPath => {
      return e2e.exec(this, {
        project: Fixtures.projectPath("e2e"),
        spec: "simple_spec.coffee",
        browser: foundPath,
        snapshot: true
      });
    });
  });
});
