'use strict'

var realFetch = require('node-fetch')
var redis = require('redis')
var bluebird = require('bluebird')

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

var client = redis.createClient() // creates a new client

client.on('connect', function () {
  console.log('connected')
})

module.exports = function (url, options) {
  var self = this
  if (/^\/\//.test(url)) {
    url = 'https:' + url
  }

  var key = url + JSON.stringify(options)

  return client.getAsync(key, function (reply) {
    if (reply) {
      return reply
    } else {
      return realFetch.call(self, url, options)
        .then(function (data) {
          // save to redis
          client.set(key, data)
          client.expire(key, 120)

          return data
        })
    }
  })
}

if (!global.fetch) {
  global.fetch = module.exports
  global.Response = realFetch.Response
  global.Headers = realFetch.Headers
  global.Request = realFetch.Request
}
