"use strict";
var fs = require('fs'), tinytim = require('tinytim'), utils = require('./utils'), spawn = require('child_process').spawn, spawnSync = require('child_process').spawnSync;
var path = require('path');

module.exports = function (conf) {
    var _conf = {
        root: '.',
        logPathFormat: '{{root}}/{{prefix}}.{{date}}.log',
        splitFormat: 'yyyymmdd',
        allLogsFileName: false,
        maxLogFiles: 10
    };

    _conf = utils.union(_conf, [conf]);

    function LogFile(prefix, date) {
        this.date = date;
        this.path = tinytim.tim(_conf.logPathFormat, {root: _conf.root, prefix: prefix, date: date});
        spawnSync('mkdir', ['-p', _conf.root]);
        this.stream = fs.createWriteStream(this.path, {
            flags: "a",
            encoding: "utf8",
            mode: parseInt('0644', 8)
            // When engines node >= 4.0.0, following notation will be better:
            //mode: 0o644
        });
    }

    LogFile.prototype.write = function (str) {
        this.stream.write(str + "\n");
    };

    LogFile.prototype.destroy = function () {
        if (this.stream) {
            this.stream.end();
            this.stream.destroySoon();
            this.stream = null;
        }
    };

    var _logMap = {};

    function _push2File(str, title) {
        var logFile = _logMap[title], now = dateFormat(new Date(), _conf.splitFormat);
        if (logFile && logFile.date != now) {
            logFile.destroy();
            logFile = null;
        }
        if (!logFile) {
            logFile = _logMap[title] = new LogFile(title, now);
            spawn('find', [_conf.root, '-type', 'f', '-name', '*.log', '-mtime', '+' + _conf.maxLogFiles, '-exec', 'rm', '{}', '\;']);
        }
        logFile.write(str);
        if (_conf.allLogsFileName) {
            var allLogFile = _logMap.allLogFile, now = new Date().toISOString();
            if (allLogFile && allLogFile.date != now) {
                allLogFile.destroy();
                allLogFile = null;
            }
            if (!allLogFile) {
                allLogFile = _logMap.allLogFile = new LogFile(_conf.allLogsFileName, now);
                spawn('find', ['./', '-type', 'f', '-name', '*.log', '-mtime', '+' + _conf.maxLogFiles, '-exec', 'rm', '{}', '\;']);
            }
            allLogFile.write(str);
        }
    }

    function dailyFileTransport(data) {
        _push2File(data.output, data.title);
    }

    if (conf.transport) {
        conf.transport = Array.isArray(conf.transport) ? conf.transport : [conf.transport];
        conf.transport.push(dailyFileTransport)
    } else {
        conf.transport = [dailyFileTransport];
    }
    return require('./console')(conf);
};
