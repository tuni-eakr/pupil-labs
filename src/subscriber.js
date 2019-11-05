// Imports

const zmq = require( 'zeromq' );
const serializer = require( 'msgpack-lite' );

const log = require( './log' )( 'SUBS' );


/// Pupil supported topics
const TOPICS = [
  'pupil',
  'gaze',
  'fixation',
  'surfaces',
  'blinks',      // unreliable, offset may be missing, onset comes with delays
  'annotation',
  'frame',
  'logging',
  'notify',
];

/// Subscriber factory
const _factory = {};
TOPICS.forEach( topic => _factory[ topic ] = cb => new Subscriber( topic, cb ) );
_factory[ 'other' ] = cb => new Subscriber( '', cb );


/// Received messages of a given topic
class Subscriber {

  /// Constructor. Consider using a subscriber factory (Subscriber.create.*) instead of creating a subscriber as new Subscriber(..).
  /// Args:
  ///  - topic: String - one of TOPICS value, or '' for other topics
  ///  - cb: Function( data: {}, extras?: * ) - a callback that receives decoded payload (see messages.js), and optional secondary data
  constructor( topic, cb ) {
    
    if (!TOPICS.includes( topic ) && '' !== topic ) {
      throw new Error( 'Invalid topic' );
    }

    if ((typeof cb) !== 'function') {
      throw new Error( 'Invalid callback function' );
    }

    this._topic = topic;
    this._cb = cb;
    this._subscriber = null;
  }
  
  
  /// Connects the subscriber to Pupil
  /// Args:
  ///  - url: String - URL to connect to
  connect( url ) {
    
    if (this._subscriber) {
      return;
    }
    
    this._subscriber = zmq.socket('sub'); 
    this._subscriber.connect( url );
    this._subscriber.subscribe( this._topic );
    
    if (this._topic === '') {     // sink all unknown topics here
      this._subscriber.on( 'message', (topic, payload, extras) => {
        
        const data = serializer.decode( payload );
        
        if (!data.topic) {
          return log.debug( `unknown topic in "${topic}: ${JSON.stringify( data )}"` );
        }
        if (TOPICS.includes( data.topic.split('.')[0] )) {
          return;
        }
        
        this._cb( data, extras );
      });
    }
    else {     // sink all known topics here
      this._subscriber.on( 'message', (topic, payload, extras) => {
        const data = serializer.decode( payload );
        this._cb( data, extras );
      });
    }
    
    log.debug( `  created subscriber for "${this._topic}".` );
    
    return this;
  }

  
  /// Closes the subscriber communication channel
  close() {
    if (this._subscriber) {
      this._subscriber.close();
    }
  }
  
  
  /// [readonly] Subscriber topic
  get topic() { return this._topic; }

  
  /// Subscriber factory. Use it to create a subscriber for one of the topics listed in TOPICS, as well as other topics.
  /// For example, Subscriber.create.gaze( data => <callback> );
  static get create() {
    return _factory;
  }
}

module.exports = Subscriber;