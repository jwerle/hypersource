const hypercore = require('hypercore')
const WebSocket = require('simple-websocket')
const pump = require('pump')
const ram = require('random-access-memory')

const request = hypercore(ram)
request.ready(() => {
  const key = request.key.toString('hex')
  const stream = request.replicate({ live: true })
  const socket = new WebSocket(`ws://localhost:3000/${key}`)

  pump(stream, socket, stream).once('handshake', () => {
    const remotePublicKey = stream.remoteUserData
    const response = hypercore(ram, remotePublicKey)

    request.append('hello world')
    response.replicate({ stream, live: true })
    response.get(0, (err, res) => {
      console.log('response', res.toString());
    })
  })
})
