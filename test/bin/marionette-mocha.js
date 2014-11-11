suite('mocha integration', function() {
  var fs = require('fs');
  var path = require('path');

  function aggregateOutput(childProcess) {
    var result = {
      stderr: '',
      stdout: ''
    };

    childProcess.stderr.on('data', function(out) {
      result.stderr += out;
    });

    childProcess.stdout.on('data', function(out) {
      result.stdout += out;
    });

    return result;
  }

  var MS_REGEXP = /(([0-9]+) ?ms)/;
  var NEW_LINES = /(\n|(\s{2,}))/g;
  function waitForProcess(child, done) {
    var result = aggregateOutput(child);
    child.on('exit', function(code) {
      // there are very small newline/whitespace differences between
      // mocha and our marionette reporter... these probably are not
      // bugs but prevent us from verifying real content so they are stripped.
      ['stderr', 'stdout'].forEach(function(field) {
        [MS_REGEXP, NEW_LINES].forEach(function(regex) {
          result[field + 'Raw'] = result[field];
          result[field] = result[field].replace(regex, '').trim();
        });
      });

      // exit status is _really_ important
      result.code = code;
      done();
    });

    return result;
  }

  var tests = [
    // this also tests picking up mocha.opts
    ['test', ['--reporter', 'spec']],
    ['pending', ['--reporter', 'spec']],
    ['with-helper', ['--require', __dirname + '/../fixtures/helper.js']]
  ];

  tests.forEach(function(pair) {
    var file = pair[0];
    var path = __dirname + '/fixtures/' + file;

    var argv = [path].concat(pair[1]);

    // run same test with same options on both mocha & our marionette proxy
    // runner.
    suite(file, function() {
      var mochaOut;
      var marionetteOut;

      setup(function(done) {
        var proc = spawnMocha(argv);
        mochaOut = waitForProcess(proc, done);
      });

      setup(function(done) {
        var proc = spawnMarionette(argv);
        marionetteOut = waitForProcess(proc, done);
      });

      test('code', function() {
        assert.equal(mochaOut.code, marionetteOut.code);
      });

      test('stdout', function() {
        assert.equal(mochaOut.stdout, marionetteOut.stdout);
      });

      test.skip('stderr', function() {
        assert.equal(mochaOut.stderr, marionetteOut.stderr);
      });
    });
  });

  suite('--host', function() {
    var result;
    var argv = ['--host', __dirname + '/fixtures/host'];
    var Host = require('./fixtures/host');

    suite('when passing --help', function() {
      setup(function(done) {
        var proc = spawnMarionette(argv.concat(['--help']));
        result = waitForProcess(proc, done);
      });

      test('custom help is shown', function() {
        assert.ok(result.stdoutRaw.indexOf(Host.help.group.title) !== -1);
        assert.ok(result.stdoutRaw.indexOf(Host.help.group.description) !== -1);
        assert.ok(result.stdoutRaw.indexOf('--code') !== -1);
      });
    });

    suite('run a test', function() {
      setup(function(done) {
        var proc = spawnMarionette(argv.concat([
          __dirname + '/fixtures/marionettetest',
          '--code',
          '55'
        ]));
        result = waitForProcess(proc, done);
      });

      test('exits with magic code', function() {
        assert.equal(result.code, 55, JSON.stringify(result));
      });
    });

  });

  suite('--profile-builder', function() {
    var result,
        argv = [
          '--profile-builder', __dirname + '/fixtures/builder',
          __dirname + '/fixtures/marionettetest'
        ];

    setup(function(done) {
      var proc = spawnMarionette(argv);
      result = waitForProcess(proc, done);
    });

    test('exits with magic code', function() {
      assert.equal(result.code, 66, JSON.stringify(result));
    });
  });
});
