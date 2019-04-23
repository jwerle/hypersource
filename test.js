const WebSocket = require('simple-websocket')
const hypercore = require('hypercore')
const test = require('tape')
const pump = require('pump')
const ram = require('random-access-memory')
const hs = require('./')

test('hs.createServer(onrequest) basic test', (t) => {
  {
    let key = null
    const request = hypercore(ram)
    const server = hs.createServer((req, res) => {
      t.equal(key, req.key.toString('hex'), 'request key')
      t.equal(`/${key}`, req.url, 'request url')

      const reader = hypercore(ram, req.key)
      const writer = hypercore(ram, res.key, { secretKey: res.secretKey })

      reader.replicate(req)
      writer.replicate(res)

      writer.once('upload', () => {
        t.pass('writer uploads')
        res.destroy()
      })

      reader.get(0, (err, buf) => writer.append(buf))
    })

    server.listen(0, (err) => {
      t.pass('listening')
    })

    request.ready(() => {
      key = request.key.toString('hex')

      const { port } = server.address()
      const socket = new WebSocket(`ws://localhost:${port}/${key}`)
      const stream = request.replicate({ live: true })

      pump(stream, socket, stream).once('handshake', () => {
        const remotePublicKey = stream.remoteUserData
        const response = hypercore(ram, remotePublicKey)

        request.append('hello world')
        response.replicate({ stream, live: true })
        response.get(0, (err, res) => {
          t.equal('hello world', res.toString())
          socket.destroy()
          server.close()
          t.end()
        })
      })
    })
  }
})
