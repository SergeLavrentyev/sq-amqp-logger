/* eslint-disable */
const bunyan = require('bunyan')
const bunyanLogstashUdp = require('./amqp/logstash')
const config = require('config')

/**
 * @param config
 * @return {boolean}
 * @private
 */
function _isValidLogstashConfig (config) {
  if (!config) {
    console.error('Logstash config is not defined')
    return false
  }
  const requiredFields = ['host', 'port', 'application', 'stand', 'project']
  let missingFields = []
  for (let field of requiredFields) {
    if (config[field] === undefined) {
      missingFields.push(field)
    }
  }

  if (missingFields.length > 0) {
    console.error('Missing required fields for logstash config - ', missingFields.join(', '))
    return false
  } else {
    return true
  }
}

/**
 * @param {String} path
 * @return {String|boolean}
 * @private
 */
function _getConfigValue(path) {
  if (config.has(path)) {
    return config.get(path)
  }

  return false;
}

/**
 * @return {Object}
 * @private
 */
function _getTransport () {
  const streamConfig = {
    server: _getConfigValue('logstash.server') || '',
    app: _getConfigValue('logstash.application'),
    stand: _getConfigValue('logstash.stand'),
    project: _getConfigValue('logstash.project'),
    version: _getConfigValue('logstash.version') || 1,
    amqp: _getConfigValue('amqp')
  }

  const transportConfig = {
    type: 'raw',
    reemitErrorEvents: true
  }

  Object.assign(transportConfig, {
    stream: bunyanLogstashUdp.createStream(streamConfig)
  })
  console.log(`Logger transport - amqp`)

  return transportConfig
}

let logger = console

if (_isValidLogstashConfig(config.logstash)) {
  const loggerConfig = {
    name: _getConfigValue('logstash.application'),
    streams: [
      {
        stream: process.stdout
      }
    ]
  }
  const transport = _getTransport()

  loggerConfig.streams.push(transport)

  logger = bunyan.createLogger(loggerConfig)

  logger.on('error', (err) => {
    console.error(err)
  })
}

module.exports = logger
/* eslint-enable */
