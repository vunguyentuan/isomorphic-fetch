'use strict'

var realFetch = require('node-fetch')
var redis = require('redis')
var bluebird = require('bluebird')
var hash = require('object-hash')

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

  if (url.indexOf('theplatform.com') === -1) {
    return realFetch.call(this, url, options)
  }

  var key = hash([url, options])

  return client.getAsync(key)
    .then(function (reply) {
      if (reply) {
        reply = JSON.parse(reply)

        return {
          json: function () {
            return JSON.parse(reply)
          },
          status: 200,
          fromCache: true
        }
      } else {
        return realFetch.call(self, url, options)
      }
    })
    .then(function (data) {
      if (!data.fromCache) {
        var dataCloned = data.clone()
        if (dataCloned.status === 200) {
          // save to redis
          dataCloned.json().then(function (json) {
            client.set(key, JSON.stringify(json))
            client.expire(key, 100)
          })
        }
      }

      return data
    })
}

if (!global.fetch) {
  global.fetch = module.exports
  global.Response = realFetch.Response
  global.Headers = realFetch.Headers
  global.Request = realFetch.Request
}
