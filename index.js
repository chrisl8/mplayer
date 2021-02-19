const Player = require('./lib/player');
const EventEmitter = require('events');

const defaults = {
  verbose: false,
  debug: false
};

const Defaults = (...args) => args.reverse().reduce((acc, obj) => ({ ...acc, ...obj }), {});

class MPlayer extends EventEmitter{
  constructor(options){
    super();

    this.options = Defaults(options || {}, defaults);

    this.player = new Player(this.options);
    this.status = {
      muted: false,
      playing: false,
      volume: 0
    };

    this.pauseTimeout;
    this.paused = false;

    this.player.once('ready', function() {
        if(this.options.verbose) {
          console.log('player.ready');
        }
        this.emit('ready');
    }.bind(this));

    this.player.on('statuschange', function(status) {
        this.status = { ...this.status, ...status };

        if(this.options.verbose) {
          console.log('player.status', this.status);
        }
        this.emit('status', this.status);
    }.bind(this));

    this.player.on('playstart', function() {
        if(this.options.verbose) {
          console.log('player.start');
        }
        this.emit('start');
    }.bind(this));

    this.player.on('playstop', function(code) {
        if(this.options.verbose) {
          console.log('player.stop', code);
        }
        this.emit('stop', code)
    }.bind(this));

    this.player.on('timechange', function(time) {
        clearTimeout(this.pauseTimeout);
        this.pauseTimeout = setTimeout(function() {
            this.paused = true;
            this.status.playing = false;
            this.emit('pause');
            if(this.options.verbose) {
              console.log('player.pause');
            }
        }.bind(this), 100);

        if(this.paused) {
          this.paused = false;
          this.status.playing = true;
          this.emit('play');
          if(this.options.verbose) {
            console.log('player.play');
          }
        }

        this.status.position = time;
        this.emit('time', time);
        if(this.options.verbose) {
          console.log('player.time', time);
        }
    }.bind(this));
  }

  setOptions(options){
    if(options && options.length) {
      options.forEach(function(value, key) {
        this.player.cmd('set_property', [key, value]);
      }.bind(this));
    }
  }

  openFile(file, options){
    this.player.cmd('stop');

    this.setOptions(options);
    this.player.cmd('loadfile', ['"' + file + '"']);

    this.status.playing = true;
  }

  openPlaylist(file, options){
    this.player.cmd('stop');

    this.setOptions(options);
    this.player.cmd('loadlist', ['"' + file + '"']);

    this.status.playing = true;
  }

  play(){
    if(!this.status.playing) {
      this.player.cmd('pause');
      this.status.playing = true;
    }
  }

  pause(){
    if(this.status.playing) {
      this.player.cmd('pause');
      this.status.playing = false;
    }
  }

  stop(){
    this.player.cmd('stop');
    this.status.playing = false;
  }

  next(){
    this.player.cmd('pt_step 1');
  }

  previous(){
    this.player.cmd('pt_step -1');
  }

  seek(seconds){
    this.player.cmd('seek', [seconds, 2]);
  }

  seekPercent(percent){
    this.player.cmd('seek', [percent, 1]);
  }

  volume(percent){
    this.status.volume = percent;
    this.player.cmd('volume', [percent, 1]);
  }

  mute(){
    this.status.muted = !this.status.muted;
    this.player.cmd('mute');
  }

  fullscreen(){
    this.status.fullscreen = !this.status.fullscreen;
    this.player.cmd('vo_fullscreen');
  }

  hideSubtitles(){
    this.player.cmd('sub_visibility', [-1]);
  }

  showSubtitles(){
    this.player.cmd('sub_visibility', [1]);
  }

  cycleSubtitles(){
    this.player.cmd('sub_select');
  }

  speedUpSubtitles(){
    this.player.cmd('sub_step', [1]);
  }

  slowDownSubtitles(){
    this.player.cmd('sub_step', [-1]);
  }

  adjustSubtitles(seconds){
    this.player.cmd('sub_delay', [seconds]);
  }

  adjustAudio(seconds){
    this.player.cmd('audio_delay', [seconds]);
  }

  mediaLength(){
    return new Promise(function(resolve){
        this.player.cmd('get_time_length');

        this.player.once('medialength', function(time){
            resolve(time);
        }.bind(this));
    }.bind(this))
  }
}

module.exports = MPlayer;
