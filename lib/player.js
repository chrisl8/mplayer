const spawn = require('child_process').spawn;
const EventEmitter = require('events');

const defaultArgs = ['-msglevel', 'global=6', '-msglevel', 'cplayer=4', '-idle', '-slave', '-fs', '-noborder', '-softvol', 'softvol-max=100'];

const Defaults = (...args) => args.reverse().reduce((acc, obj) => ({ ...acc, ...obj }), {});

class Player extends EventEmitter{
  constructor(options){
    super();

    this.options = options;
    this.spawn();
  }

  spawn(){
    var args = [];

    if(typeof this.options.args === 'string') {
      args = this.options.args.split(' ');
    } else if(Array.isArray(this.options.args)) {
      args = this.options.args
    }

    var instance = spawn('mplayer', defaultArgs.concat(args));

    this.setStatus();

    var startTime = Date.now();

    instance.stdout.on('data', this.onData.bind(this));
    instance.stderr.on('data', this.onError.bind(this));

    instance.on('exit', function() {
      if(Date.now() - startTime < 3000) {
        // Process is erroring too close to start up, abort.
        process.exit(1);
      }
      if(this.options.debug) {
        console.log('mplayer process exited, restarting...');
      }
      this.emit('playstop');
      this.spawn();
    }.bind(this));

    this.instance = instance;
  }

  cmd(command, cmd_args){
    cmd_args = cmd_args || [];

    if(typeof cmd_args.length === 'undefined') {
      cmd_args = [cmd_args];
    }

    if(this.options.debug) {
      console.log('>>>> COMMAND: ' + command, cmd_args);
    }
    this.instance.stdin.write([command].concat(cmd_args).join(' ') + '\n');
  }

  getStatus(){
    this.cmd('get_time_length');
    this.cmd('get_vo_fullscreen');
    this.cmd('get_sub_visibility');
  }

  setStatus(status){
    var defaults = {
      duration: 0,
      fullscreen: false,
      subtitles: false,
      filename: null,
      title: null
    };

    if(status) {
      var _this_status = this.status || {};
      var _status = status || {};
      this.status = Defaults({..._this_status, ..._status}, defaults);
    } else {
      this.status = Defaults({}, defaults);
    }

    this.emit('statuschange', this.status);
  }

  onData(data){
    if(this.options.debug) {
      console.log('stdout: ' + data);
    }

    data = data.toString();

    if(data.indexOf('MPlayer') === 0) {
      this.emit('ready');
      this.setStatus(false);
    }

    if(data.indexOf('StreamTitle') !== -1) {
      this.setStatus({
        title: data.match(/StreamTitle='([^']*)'/)[1]
      });
    }

    if(data.indexOf('Playing ') !== -1) {
      var file = data.match(/Playing\s(.+?)\.\s/)[1];
      this.setStatus(false);
      this.setStatus({
        filename: file
      });
      this.getStatus();
    }

    if(data.indexOf('Starting playback...') !== -1) {
      this.emit('playstart');
    }

    if(data.indexOf('EOF code:') > -1) {
      var codeStart, code;

      codeStart = data.indexOf('code:') + 5;
      code = data.substr(codeStart, 2).trim();
      code = parseInt(code, 10);

      this.emit('playstop', code);
      this.setStatus();
    }

    if(data.indexOf('A:') === 0) {
      var timeStart, timeEnd, time;

      if(data.indexOf(' V:') !== -1) {
        timeStart = data.indexOf(' V:') + 3;
        timeEnd = data.indexOf(' A-V:');
      } else {
        timeStart = data.indexOf('A:') + 2;
        timeEnd = data.indexOf(' (');
      }

      time = data.substring(timeStart, timeEnd).trim();

      this.emit('timechange', time)
    }

    if(data.indexOf('ANS_LENGTH') !== -1 && data.indexOf('ANS_VO_FULLSCREEN') !== -1 && data.indexOf('ANS_SUB_VISIBILITY') !== -1) {
      this.setStatus({
        duration: parseFloat(data.match(/ANS_LENGTH=([0-9\.]*)/)[1]),
        fullscreen: (parseInt(data.match(/ANS_VO_FULLSCREEN=([01])/)[1]) === 1),
        subtitles: (parseInt(data.match(/ANS_SUB_VISIBILITY=([01])/)[1]) === 1)
      });
    }else if(data.indexOf('ANS_LENGTH') !== -1){
      this.emit('medialength', parseFloat(data.match(/ANS_LENGTH=([0-9\.]*)/)[1]));
    }
  }

  onError(error){
    if(this.options.debug) {
      console.log('stderr: ' + error);
    }
  }
}

module.exports = Player;
