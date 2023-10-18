const bunyan = require('bunyan')
const os = require('os')
const {clone} = require('./helpers')
const uuid = require('uuid')
const amqplib = require('amqplib/callback_api')

const LEVELS = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal'
}

/**
 * @typedef AmpqOptions
 * @property {String} [hostname]
 * @property {String|Number} [port]
 * @property {String} [username]
 * @property {String} [password]
 * @property {String} [logQueue]
 */

/**
 * @typedef Options
 * @property {String} [level]
 * @property {String} [server]
 * @property {String} [host]
 * @property {String|Number} [port]
 * @property {String} [app]
 * @property {String|Number} [pid]
 * @property {String} [type]
 * @property {String} [stand]
 * @property {String} [project]
 * @property {AmpqOptions} [amqp]
 */

class LogstashStream {
  /**
   * @param {Options} options
   */
  constructor(options) {
    this.name = 'bunyan'
    this.level = options.level || 'info'
    this.server = options.server || os.hostname()
    this.application = options.app || process.title
    this.pid = options.pid || process.pid
    this.type = options.type
    this.stand = options.stand || ''
    this.project = options.project || ''
    this.amqpHostname = options.amqp.hostname || 'localhost'
    this.amqpPort = options.amqp.port || 5672
    this.amqpUsername = options.amqp.username || 'rabbitmq'
    this.amqpPassword = options.amqp.password || 'rabbitmq'
    this.amqpQueue = options.amqp.logQueue || 'elk'
  }

  /**
   *
   * @param {Object|String} entry
   * @return {{"@timestamp": string, level: (*|string|number|String), project: (*|String|string), pid: string, source: string, message: *, stand: (*|String|string), type: String}}
   */
  generateMessageObject(entry) {
    if (typeof (entry) === 'string') {
      entry = JSON.parse(entry)
    }
    let preparedOriginalMessageObject = clone(entry, 0)
    delete preparedOriginalMessageObject.time
    delete preparedOriginalMessageObject.msg
    delete preparedOriginalMessageObject.v
    delete preparedOriginalMessageObject.level

    const originalLevelCode = entry.level
    const preparedLevel = LEVELS[originalLevelCode] || originalLevelCode

    return {
      '@timestamp': new Date(entry.time).toISOString(),
      message: entry.msg,
      level: preparedLevel,
      source: `${this.server}/${this.application}`,
      stand: this.stand,
      project: this.project,
      pid: this.pid + '',
      ...typeof (this.type) === 'string' ? {type: this.type} : {},
      ...preparedOriginalMessageObject
    }
  }

  /**
   * @return {string}
   */
  getHost() {
    return `amqp://${this.amqpUsername}:${this.amqpPassword}@${this.amqpHostname}:${this.amqpPort}`
  }

  /**
   * @param {string|Object} entry
   */
  write(entry) {
    const messageObject = this.generateMessageObject(entry)
    this.send(JSON.stringify(messageObject, bunyan.safeCycles()))
  }

  /**
   * @param {String} message
   */
  send(message) {
    const self = this
    const buf = new Buffer.from(message)
    const messageId = Date.now() + uuid.v4();
    const url = this.getHost()

    amqplib.connect(url, (err, conn) => {
      if (err) return bail(err)
      conn.createChannel((err, ch) => {
        if (err) return bail(err, conn)
        ch.assertQueue(self.amqpQueue, {durable: true}, (err) => {
          if (err) return bail(err, conn)
          ch.sendToQueue(self.amqpQueue, buf, {persistent: true, messageId})
          console.log(" [x] Sent %s", message);

          setTimeout(function () {
            ch.close(() => {
              conn.close();
            })
          }, 500);
        })
      })

      function bail(err, conn) {
        console.error(err)

        if (conn) conn.close(() => {
          console.log('Connection closed on error/')
        })
      }
    })
  }
}

/**
 * @param options
 * @return {LogstashStream}
 */
function createLogstashStream(options) {
  return new LogstashStream(options)
}

module.exports = {
  createStream: createLogstashStream
}
