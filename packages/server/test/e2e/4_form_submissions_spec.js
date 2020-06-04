/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const rp = require("@cypress/request-promise");
const path = require("path");
const Promise = require("bluebird");
const bodyParser = require("body-parser");
const multiparty = require("multiparty");
const fs = require("../../lib/util/fs");
const e2e = require("../support/helpers/e2e").default;
const Fixtures = require("../support/helpers/fixtures");

const HTTPS_PORT = 11443;
const HTTP_PORT = 11180;
describe("e2e form submissions", () => e2e.setup());

const e2ePath = Fixtures.projectPath("e2e");
const pathToLargeImage = Fixtures.path("server/imgs/earth.jpg");

const getFormHtml = (formAttrs, textValue = '') => `\
<html>
<body>
  <form method="POST" ${formAttrs}>
    <input name="foo" type="text" value="${textValue}"/>
    <input name="bar" type="file"/>
    <input type="submit"/>
  </form>
</body>
</html>\
`;

const onServer = function(app) {
  app.post("/verify-attachment", function(req, res) {
    const form = new multiparty.Form();

    return form.parse(req, function(err, fields, files) {
      const fixturePath = path.resolve(e2ePath, "cypress", "fixtures", fields["foo"][0]);
      const filePath = files["bar"][0].path;

      return Promise.props({
        fixture: fs.readFileAsync(fixturePath),
        upload: fs.readFileAsync(filePath)
      })
      .then(function({ fixture, upload }) {
        const ret = fixture.compare(upload);

        if (ret === 0) {
          return res.send('files match');
        }

        return res.send(
          `\
file did not match. file at ${fixturePath} did not match ${filePath}.
<br/>
<hr/>
buffer compare yielded: ${ret}\
`
        );
      });
    });
  });

  //# all routes below this point will have bodies parsed
  app.use(bodyParser.text({
    type: '*/*' //# parse any content-type
  }));

  app.get("/", (req, res) => res
  .type('html')
  .send(getFormHtml('action="/dump-body"')));

  app.get("/multipart-form-data", (req, res) => res
  .type('html')
  .send(getFormHtml('action="/dump-body" enctype="multipart/form-data"')));

  app.get("/multipart-with-attachment", (req, res) => res
  .type('html')
  .send(getFormHtml('action="/verify-attachment" enctype="multipart/form-data"', req.query.fixturePath)));

  return app.post("/dump-body", (req, res) => res
  .type('html')
  .send(req.body));
};

describe("e2e forms", function() {
  context("submissions with jquery XHR POST", function() {
    e2e.setup();

    e2e.it("passing", {
      spec: "form_submission_passing_spec.coffee",
      snapshot: true
    });

    return e2e.it("failing", {
      spec: "form_submission_failing_spec.coffee",
      snapshot: true,
      expectedExitCode: 1,
      onStdout: stdout => {
        return stdout
        .replace(/((?:      -)+[^\n]+\n)/gm, '');
      } //# remove variable diff
    });
});

  return context("<form> submissions", function() {
    e2e.setup({
      settings: {
        env: {
          PATH_TO_LARGE_IMAGE: pathToLargeImage
        }
      },
      servers: [
        {
          port: HTTPS_PORT,
          https: true,
          onServer
        },
        {
          port: HTTP_PORT,
          onServer
        }
      ]
    });

    before(() => //# go out and fetch this image if we don't already have it
    fs
    .readFileAsync(pathToLargeImage)
    .catch({ code: "ENOENT"}, () => //# 16MB image, too big to include with git repo
    rp("https://test-page-speed.cypress.io/files/huge-image.jpg")
    .then(resp => fs.outputFileAsync(pathToLargeImage, resp))));

    e2e.it("passes with https on localhost", {
      config: {
        baseUrl: `https://localhost:${HTTPS_PORT}`
      },
      spec: "form_submission_multipart_spec.coffee",
      snapshot: true
    });

    return e2e.it("passes with http on localhost", {
      config: {
        baseUrl: `http://localhost:${HTTP_PORT}`
      },
      spec: "form_submission_multipart_spec.coffee",
      snapshot: true
    });
});
});
